"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMsg, Language, Source } from "@/lib/types";
import { sendMessage } from "@/lib/api";
import { MEDICAL_DISCLAIMER } from "@/lib/constants";
import { t } from "@/lib/i18n";

interface ChatInterfaceProps {
  language: Language;
  medicineId?: string;
}

export default function ChatInterface({ language, medicineId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;
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
      const assistantMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.message,
        sources: res.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (res.disclaimer) setDisclaimer(res.disclaimer);
    } catch {
      const errorMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t(language, "chat.errorMsg"),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-surface overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-surface to-primary/[0.03] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse-glow shadow-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t(language, "chat.headerTitle")}</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <p className="text-[11px] text-muted">{t(language, "chat.headerStatus")}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 animate-float">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-foreground mb-1">{t(language, "chat.emptyTitle")}</p>
            <p className="text-xs text-muted max-w-xs mb-6">
              {t(language, "chat.emptySubtitle")}
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-surface border border-border hover:border-primary/30 hover:bg-primary/5 text-muted hover:text-primary rounded-full px-3.5 py-2 transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
            <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
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
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary-dark text-white rounded-br-md shadow-md shadow-primary/10"
                  : "bg-background text-foreground border border-border rounded-bl-md"
              }`}>
                {msg.content}
              </div>

              {/* Source badges */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.sources.map((s: Source, i: number) => (
                    <span key={i} className="text-[10px] bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">
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
            <div className="bg-background border border-border rounded-2xl rounded-bl-md px-5 py-3.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="px-4 py-2 bg-warning/5 border-t border-warning/10">
          <p className="text-[10px] text-muted leading-relaxed">{disclaimer}</p>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-surface">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t(language, "chat.inputPlaceholder")}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
