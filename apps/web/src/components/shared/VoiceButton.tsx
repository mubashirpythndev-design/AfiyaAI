"use client";

import { useState, useRef } from "react";
import type { Language } from "@/lib/types";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

interface VoiceButtonProps {
  language: Language;
  onTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
  variant?: "icon" | "pill";
  label?: string;
}

export default function VoiceButton({
  language,
  onTranscript,
  onInterimTranscript,
  className = "",
  size = "md",
  title,
  variant = "icon",
  label,
}: VoiceButtonProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastDispatchedRef = useRef<string>("");
  const lastDispatchedTimeRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const dispatchFinalTranscript = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    // Prevent duplicate triggers within 1500ms for identical text
    if (trimmed === lastDispatchedRef.current && now - lastDispatchedTimeRef.current < 1500) {
      return;
    }
    lastDispatchedRef.current = trimmed;
    lastDispatchedTimeRef.current = now;
    onTranscript(trimmed);
  };

  const {
    isListening,
    isTranscribing,
    audioLevel,
    isSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    language,
    onResult: (currentTranscript, isFinal) => {
      if (isFinal) {
        dispatchFinalTranscript(currentTranscript);
      } else {
        onInterimTranscript?.(currentTranscript);
      }
    },
    onEnd: (finalTranscript) => {
      if (finalTranscript) {
        dispatchFinalTranscript(finalTranscript);
      }
    },
    onError: (err) => {
      showToast(err);
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isTranscribing) {
      return;
    }

    if (!isSupported) {
      showToast(
        language === "ur"
          ? "اس براؤزر میں مائیکروفون دستیاب نہیں ہے۔"
          : "Microphone access is not supported on this device."
      );
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      void startListening();
    }
  };

  // Dimensions based on size
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  }[size];

  // Dynamic bar heights responsive to live audio volume (audioLevel 0..100)
  const baseLevel = Math.max(12, audioLevel);
  const barHeight1 = isListening ? `${Math.min(22, Math.max(6, Math.round(baseLevel * 0.17)))}px` : "6px";
  const barHeight2 = isListening ? `${Math.min(26, Math.max(10, Math.round(baseLevel * 0.25)))}px` : "12px";
  const barHeight3 = isListening ? `${Math.min(28, Math.max(14, Math.round(baseLevel * 0.28)))}px` : "16px";
  const barHeight4 = isListening ? `${Math.min(24, Math.max(8, Math.round(baseLevel * 0.20)))}px` : "8px";

  const defaultTitle = isTranscribing
    ? language === "ur"
      ? "آواز کو متن میں بدلا جا رہا ہے..."
      : language === "roman_ur"
      ? "Awaz ko text mein badla ja raha hai..."
      : "Transcribing audio with Gemini AI..."
    : isListening
    ? language === "ur"
      ? "سن رہا ہوں... (مکمل کرنے کے لیے کلک کریں)"
      : language === "roman_ur"
      ? "Sun raha hoon... (Finish karne ke liye click karein)"
      : "Listening... (Click to finish)"
    : title ||
      (language === "ur"
        ? "بول کر دوا تلاش کریں یا سوال پوچھیں"
        : language === "roman_ur"
        ? "Bol kar dawa talash karein ya sawal poochein"
        : "Speak medicine name or ask a question");

  // Floating status tag when active
  const statusBadge = isTranscribing ? (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[11px] font-medium shadow-lg shadow-amber-500/30 whitespace-nowrap border border-amber-400/40">
        <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>
          {language === "ur"
            ? "AI سمجھ رہا ہے..."
            : language === "roman_ur"
            ? "AI samajh raha hai..."
            : "AI Transcribing..."}
        </span>
      </div>
    </div>
  ) : isListening ? (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-600 to-red-600 text-white text-[11px] font-medium shadow-lg shadow-red-500/30 whitespace-nowrap border border-rose-400/40">
        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
        <span>
          {language === "ur"
            ? "بولیں... (کلک پر ختم)"
            : language === "roman_ur"
            ? "Bolein... (Click to finish)"
            : "Listening... (Click to stop)"}
        </span>
      </div>
    </div>
  ) : null;

  if (variant === "pill") {
    const pillClasses = isTranscribing
      ? "bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-2 ring-amber-500/20"
      : isListening
      ? "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.45)] ring-2 ring-red-500/30"
      : "bg-surface/80 hover:bg-surface text-foreground/80 hover:text-primary border-border hover:border-primary/50 shadow-sm hover:shadow-md hover:shadow-primary/10";

    return (
      <div className="relative inline-flex items-center">
        {statusBadge}

        <button
          type="button"
          onClick={handleClick}
          disabled={isTranscribing}
          title={defaultTitle}
          aria-label={defaultTitle}
          className={`relative group flex items-center gap-2 px-3.5 py-1.5 rounded-full font-medium text-xs border transition-all duration-300 backdrop-blur-sm ${pillClasses} ${
            isTranscribing ? "cursor-wait opacity-90" : "cursor-pointer active:scale-95"
          } ${className}`}
        >
          {isListening && !isTranscribing && (
            <span className="absolute -inset-1 rounded-full bg-rose-500/30 animate-ping opacity-60 pointer-events-none" />
          )}

          {isTranscribing ? (
            <svg className="animate-spin h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isListening ? (
            <div className="flex items-center gap-0.5 h-4 px-0.5">
              <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: barHeight1 }} />
              <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: barHeight2 }} />
              <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: barHeight3 }} />
              <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: barHeight4 }} />
            </div>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 transition-transform duration-200 group-hover:scale-110 text-primary"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}

          <span>
            {isTranscribing
              ? language === "ur"
                ? "سمجھ رہا ہوں..."
                : language === "roman_ur"
                ? "Samajh raha hoon..."
                : "Processing..."
              : isListening
              ? language === "ur"
                ? "سن رہا ہوں..."
                : language === "roman_ur"
                ? "Sun raha hoon..."
                : "Listening..."
              : label ||
                (language === "ur"
                  ? "وائس تلاش"
                  : language === "roman_ur"
                  ? "Voice Search"
                  : "Voice")}
          </span>
        </button>

        {toastMessage && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap bg-foreground text-background text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-xl animate-fade-in border border-border">
            ⚠️ {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // Icon variant styling
  const iconActiveClasses = isTranscribing
    ? "bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.45)] border-amber-300 scale-105"
    : isListening
    ? "bg-gradient-to-tr from-rose-600 via-red-500 to-pink-600 text-white shadow-[0_0_25px_rgba(244,63,94,0.55)] border-rose-300 scale-105"
    : "bg-surface/80 hover:bg-gradient-to-br hover:from-primary/15 hover:via-primary/5 hover:to-accent/10 text-muted hover:text-primary border-border hover:border-primary/50 shadow-sm hover:shadow-[0_0_15px_rgba(13,148,136,0.2)]";

  return (
    <div className="relative inline-flex items-center">
      {statusBadge}

      <button
        type="button"
        onClick={handleClick}
        disabled={isTranscribing}
        title={defaultTitle}
        aria-label={defaultTitle}
        className={`relative group flex items-center justify-center rounded-xl border backdrop-blur-sm transition-all duration-300 ${sizeClasses} ${iconActiveClasses} ${
          isTranscribing ? "cursor-wait opacity-90" : "cursor-pointer active:scale-95"
        } ${className}`}
      >
        {isListening && !isTranscribing && (
          <>
            <span className="absolute -inset-1.5 rounded-2xl bg-rose-500/30 animate-ping opacity-60 pointer-events-none" />
            <span className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 blur-sm opacity-50 pointer-events-none" />
          </>
        )}

        {isTranscribing ? (
          <svg className="animate-spin h-4 w-4 text-white pointer-events-none" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isListening ? (
          <div className="relative flex items-center justify-center gap-0.5 h-5 px-1 pointer-events-none">
            <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out shadow-sm" style={{ height: barHeight1 }} />
            <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out shadow-sm" style={{ height: barHeight2 }} />
            <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out shadow-sm" style={{ height: barHeight3 }} />
            <span className="w-1 bg-white rounded-full transition-all duration-75 ease-out shadow-sm" style={{ height: barHeight4 }} />
          </div>
        ) : (
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 transition-transform duration-200 group-hover:scale-110"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>

      {toastMessage && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap bg-foreground text-background text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-xl animate-fade-in border border-border">
          ⚠️ {toastMessage}
        </div>
      )}
    </div>
  );
}
