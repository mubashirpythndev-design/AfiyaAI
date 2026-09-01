"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMsg, Language, Source } from "@/lib/types";
import { sendMessage } from "@/lib/api";
import { MEDICAL_DISCLAIMER } from "@/lib/constants";
import { t } from "@/lib/i18n";

interface ChatInterfaceProps {
  language: Language;
  medicineId?: string;
  onSelectMedicine?: (medicine: any) => void;
}

export default function ChatInterface({ language, medicineId, onSelectMedicine }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    t(language, "chat.suggestion1"),
    t(language, "chat.suggestion2"),
    t(language, "chat.suggestion3"),
    t(language, "chat.suggestion4"),
  ];

  useEffect(() => {
    // Scroll only the chat messages container, never the whole page.
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSend = async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || loading || isStreaming) return;
    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendMessage({
        message: messageText,
        medicine_id: medicineId,
        language,
        conversation_history: history,
      });

      setLoading(false);
      setIsStreaming(true);

      const msgId = crypto.randomUUID();
      const initialAssistantMsg: ChatMsg = {
        id: msgId,
        role: "assistant",
        content: "",
        sources: [],
        medicine: res.medicine,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);

      // Stream text chunk-by-chunk (Approach 2: Progressive typing stream)
      const fullText = res.message || "";
      const words = fullText.split(" ");
      let currentWordIndex = 0;
      const chunkSize = 2; // Stream 2 words per tick

      const streamTimer = setInterval(() => {
        currentWordIndex += chunkSize;
        const currentSlice = words.slice(0, currentWordIndex).join(" ");

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === msgId
              ? {
                  ...msg,
                  content: currentSlice,
                }
              : msg
          )
        );

        if (currentWordIndex >= words.length) {
          clearInterval(streamTimer);
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === msgId
                ? {
                    ...msg,
                    content: fullText,
                    sources: res.sources,
                  }
                : msg
            )
          );
          if (res.disclaimer) setDisclaimer(res.disclaimer);
        }
      }, 20);

    } catch {
      setLoading(false);
      setIsStreaming(false);
      const errorMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t(language, "chat.errorMsg"),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <div className="flex flex-col h-[460px] sm:h-[520px] bg-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border bg-gradient-to-r from-surface to-primary/[0.03] flex items-center gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse-glow shadow-md shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">{t(language, "chat.headerTitle")}</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <p className="text-[10px] sm:text-[11px] text-muted">{t(language, "chat.headerStatus")}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 sm:px-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-3 sm:mb-5 animate-float">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary sm:w-7 sm:h-7">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm sm:text-base font-semibold text-foreground mb-1">{t(language, "chat.emptyTitle")}</p>
            <p className="text-xs text-muted max-w-xs mb-4 sm:mb-6">
              {t(language, "chat.emptySubtitle")}
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-[11px] sm:text-xs bg-surface border border-border hover:border-primary/30 hover:bg-primary/5 text-muted hover:text-primary rounded-full px-2.5 sm:px-3.5 py-1.5 sm:py-2 transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
            <div className={`max-w-[90%] sm:max-w-[85%]`}>
              {/* Avatar for assistant */}
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-4 h-4 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <path d="M12 2v20M2 12h20" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold text-muted">Afiya AI</span>
                </div>
              )}
              <div className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary-dark text-white rounded-br-md shadow-md shadow-primary/10"
                  : "bg-background text-foreground border border-border rounded-bl-md"
              }`}>
                {msg.content}
                {isStreaming && msg.role === "assistant" && msg.content && (
                  <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                )}
              </div>

              {/* Interactive Medicine Action Pill */}
              {msg.medicine && (
                <div className="mt-2 flex items-center">
                  <button
                    type="button"
                    onClick={() => onSelectMedicine && onSelectMedicine(msg.medicine)}
                    className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm hover:scale-[1.02]"
                  >
                    <span>🔍</span>
                    <span>View {msg.medicine.brand_name} {msg.medicine.strength} Details & Prices</span>
                  </button>
                </div>
              )}

              {/* Source badges */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.sources.map((s: Source, i: number) => (
                    <span key={i} className="text-[9px] sm:text-[10px] bg-primary/8 text-primary rounded-full px-2 py-0.5 font-medium">
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold text-muted">Afiya AI</span>
            </div>
            <div className="bg-background border border-border rounded-2xl rounded-bl-md px-4 sm:px-5 py-2.5 sm:py-3.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-warning/5 border-t border-warning/10">
          <p className="text-[9px] sm:text-[10px] text-muted leading-relaxed">{disclaimer}</p>
        </div>
      )}

      {/* Input */}
      <div className="p-2.5 sm:p-3 border-t border-border bg-surface">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t(language, "chat.inputPlaceholder")}
            className="flex-1 bg-background border border-border rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 transition-all duration-200 hover:shadow-md hover:shadow-primary/20 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-[18px] sm:h-[18px]">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
