"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMsg, Language, Source, MedicineDetail } from "@/lib/types";
import { sendMessage } from "@/lib/api";
import { t } from "@/lib/i18n";
import VoiceButton from "@/components/shared/VoiceButton";

interface ChatInterfaceProps {
  language: Language;
  medicineId?: string;
  onSelectMedicine?: (medicine: MedicineDetail) => void;
  externalPrompt?: string;
  prescriptionContext?: string;
}

export default function ChatInterface({
  language,
  medicineId,
  onSelectMedicine,
  externalPrompt,
  prescriptionContext,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortStreamRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const initialSuggestedQuestions = [
    t(language, "chat.suggestion1"),
    t(language, "chat.suggestion2"),
    t(language, "chat.suggestion3"),
    t(language, "chat.suggestion4"),
  ];

  const prescriptionSuggestions = language === "ur"
    ? [
        "یہ دوائیں کس وقت اور کیسے لینی ہیں؟",
        "کیا یہ کھانے سے پہلے یا بعد میں لینی ہیں؟",
        "کیا ان کے کوئی خاص سائیڈ ایفیکٹس ہیں؟",
        "کیا ان کے سستے متبادل برانڈز دستیاب ہیں؟",
      ]
    : language === "roman_ur"
    ? [
        "Yeh dawaiyan kab aur kaise leni hain?",
        "Khane se pehle ya baad mein leni hain?",
        "Kya koi side effects ya ehtiyat hain?",
        "Kya inke koi saste alternatives hain?",
      ]
    : [
        "How & when should I take these medicines?",
        "Should I take them before or after meals?",
        "Are there any side effects or precautions?",
        "Can I find cheaper alternatives for these?",
      ];

  // Handle external prompts (e.g. clicking "Ask AI" on an OCR medicine card)
  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      void handleSend(externalPrompt.trim());
    }
  }, [externalPrompt]);

  useEffect(() => {
    // Scroll only the chat messages container smoothly
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming, loading]);

  // Clean up any ongoing TTS when unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSpeak = (id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]()]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || loading || isStreaming || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    abortStreamRef.current = false;
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
        prescription_context: prescriptionContext,
      });

      setLoading(false);
      setIsStreaming(true);

      const msgId = crypto.randomUUID();
      const initialAssistantMsg: ChatMsg = {
        id: msgId,
        role: "assistant",
        content: "",
        sources: res.sources || [],
        medicine: res.medicine,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);

      // Progressive character/word streaming with natural typing cadence
      const fullText = res.message || "";
      const words = fullText.split(" ");
      let currentWordIndex = 0;

      const streamTimer = setInterval(() => {
        if (abortStreamRef.current) {
          clearInterval(streamTimer);
          setIsStreaming(false);
          return;
        }

        currentWordIndex += 1; // Stream 1 word per tick for a visible, smooth stream
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
                    medicine: res.medicine,
                  }
                : msg
            )
          );
          if (res.disclaimer) setDisclaimer(res.disclaimer);
        }
      }, 45); // 45ms per word (~22 words/sec) provides an ideal reading pace

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
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Dynamic follow-up suggestion generator
  const getFollowUpSuggestions = (medName?: string) => {
    const name = medName || "is dawa";
    if (language === "ur") {
      return [
        `${name} کے نقصانات کیا ہیں؟`,
        `${name} کو کھانے کے ساتھ لینا چاہیے؟`,
        `${name} کا سب سے سستا متبادل کونسا ہے؟`,
      ];
    }
    if (language === "roman_ur") {
      return [
        `${name} ke side effects kya hain?`,
        `${name} khane ke sath lein ya khali pait?`,
        `${name} ka sab se sasta brand konsa hai?`,
      ];
    }
    return [
      `What are the side effects of ${name}?`,
      `Should ${name} be taken with or without food?`,
      `What is the cheapest alternative to ${name}?`,
    ];
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-[560px] bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border bg-gradient-to-r from-surface via-primary/[0.04] to-accent/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                {t(language, "chat.headerTitle")}
              </h3>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                DRAP Grounded
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <p className="text-[10px] sm:text-[11px] text-muted font-medium">
                {t(language, "chat.headerStatus")}
              </p>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setDisclaimer(null);
            }}
            className="text-[11px] text-muted hover:text-danger font-medium transition-colors px-2 py-1 rounded-lg hover:bg-danger/5"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 sm:px-8 py-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 flex items-center justify-center mb-3 shadow-inner">
              <span className="text-2xl">{prescriptionContext ? "📋" : "🩺"}</span>
            </div>
            <p className="text-sm sm:text-base font-bold text-foreground mb-1">
              {prescriptionContext
                ? (language === "ur" ? "نسخے کے متعلق رہنمائی" : language === "roman_ur" ? "Prescription AI Assistant" : "Prescription Assistant Ready")
                : t(language, "chat.emptyTitle")}
            </p>
            <p className="text-xs text-muted max-w-sm mb-5 leading-relaxed">
              {prescriptionContext
                ? (language === "ur" ? "دوائیوں کے اوقات، کھانے سے پہلے یا بعد، احتیاطی تدابیر، یا سستے متبادل کے بارے میں پوچھیں۔" : language === "roman_ur" ? "Dawaiyon ke auqaat, khane se pehle ya baad, ehtiyat, ya saste generic alternatives ke bare mein poochein." : "Ask about dosages, meal timings (before/after food), precautions, or cheaper generic alternatives.")
                : t(language, "chat.emptySubtitle")}
            </p>

            {/* Starter Suggestion Chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {(prescriptionContext ? prescriptionSuggestions : initialSuggestedQuestions).map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-background hover:bg-primary/10 border border-border hover:border-primary/40 text-foreground/80 hover:text-primary font-medium rounded-xl px-3 py-1.5 transition-all shadow-sm hover:scale-[1.02] text-left"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div className="max-w-[92%] sm:max-w-[85%] space-y-2">
              {/* Assistant Header */}
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] text-white font-bold">
                      A
                    </span>
                    <span className="text-[11px] font-bold text-foreground/80">Afiya AI Assistant</span>
                  </div>

                  {/* Actions: Copy & TTS */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSpeak(msg.id, msg.content)}
                      aria-label="Listen"
                      className="p-1 rounded hover:bg-surface-hover text-muted hover:text-primary transition-colors text-xs"
                      title={speakingId === msg.id ? "Stop voice" : "Listen to answer"}
                    >
                      {speakingId === msg.id ? "⏹️" : "🔊"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      aria-label="Copy"
                      className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors text-xs"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? "✓ Copied" : "📋"}
                    </button>
                  </div>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary-dark text-white rounded-br-sm shadow-md shadow-primary/15 font-medium"
                    : "bg-background text-foreground border border-border/80 rounded-bl-sm shadow-sm"
                }`}
              >
                {msg.content}
                {isStreaming && msg.role === "assistant" && (
                  <span className="inline-block w-2 h-4 bg-primary ml-1.5 animate-pulse align-middle rounded-sm shadow-sm shadow-primary/50" />
                )}
              </div>

              {/* Interactive Rich Medicine Card */}
              {msg.medicine && (
                <div className="bg-surface rounded-2xl p-3.5 border-2 border-primary/20 shadow-md space-y-2.5 animate-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">💊</span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-foreground">
                          {msg.medicine.brand_name} {msg.medicine.strength}
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted font-medium mt-0.5">
                        Active Salt: <span className="font-bold text-foreground">{msg.medicine.generic_name}</span> ({msg.medicine.dosage_form})
                      </p>
                      {msg.medicine.manufacturer && (
                        <p className="text-[10px] text-muted">
                          Manufacturer: {msg.medicine.manufacturer}
                        </p>
                      )}
                    </div>
                    {msg.medicine.category && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                        {msg.medicine.category}
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => onSelectMedicine && msg.medicine && onSelectMedicine(msg.medicine)}
                    className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white rounded-xl py-2 px-3 text-xs font-bold transition-all shadow-md shadow-primary/20 hover:scale-[1.01]"
                  >
                    <span>🔍</span>
                    <span>View {msg.medicine.brand_name} Full Prices, MRP & Alternatives</span>
                    <span>→</span>
                  </button>
                </div>
              )}

              {/* Sources Provenance */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-muted">Sources:</span>
                  {msg.sources.map((s: Source, i: number) => (
                    <span
                      key={i}
                      className="text-[10px] bg-primary/10 text-primary font-bold rounded-md px-2 py-0.5 border border-primary/20"
                    >
                      🛡️ {s.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Follow-up Question Chips (Rendered on the latest assistant message) */}
              {!isStreaming && !loading && index === messages.length - 1 && msg.role === "assistant" && (
                <div className="pt-2 space-y-1.5 animate-fade-in">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    Suggested Next Questions:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getFollowUpSuggestions(msg.medicine?.brand_name).map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSend(q)}
                        className="text-[11px] bg-surface hover:bg-primary/10 text-foreground/80 hover:text-primary font-medium border border-border hover:border-primary/30 rounded-xl px-2.5 py-1 transition-all shadow-sm"
                      >
                        👉 {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1">
                <span className="w-4 h-4 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] text-white font-bold">
                  A
                </span>
                <span className="text-[11px] font-bold text-foreground/80">Afiya AI is typing...</span>
              </div>
              <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="px-4 py-2 bg-warning/5 border-t border-warning/15">
          <p className="text-[10px] text-muted leading-relaxed">
            🛡️ {disclaimer}
          </p>
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 border-t border-border bg-surface">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              language === "ur"
                ? "دوا کا نام یا سوال لکھیں..."
                : language === "roman_ur"
                ? "Dawa ka naam ya sawal yahan likhein..."
                : "Ask about uses, side effects, precautions, food interactions..."
            }
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
            disabled={loading}
          />
          <VoiceButton
            language={language}
            onTranscript={(spokenText) => {
              const trimmed = spokenText.trim();
              if (trimmed) {
                setInput(trimmed);
                handleSend(trimmed);
              }
            }}
            onInterimTranscript={(interim) => {
              setInput(interim);
            }}
            title={
              language === "ur"
                ? "بول کر سوال پوچھیں"
                : language === "roman_ur"
                ? "Bol kar sawal poochein"
                : "Speak your medical question"
            }
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 transition-all duration-200 hover:shadow-md hover:shadow-primary/20 font-bold text-xs flex items-center gap-1.5 shrink-0"
          >
            <span>Send</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
