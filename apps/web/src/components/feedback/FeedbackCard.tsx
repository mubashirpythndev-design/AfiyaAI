"use client";

interface FeedbackCardProps {
  onOpenModal: () => void;
  language?: "en" | "ur" | "roman_ur";
}

export default function FeedbackCard({ onOpenModal, language = "en" }: FeedbackCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface to-accent/10 border-2 border-primary/20 p-6 sm:p-8 shadow-xl shadow-primary/5 animate-fade-in">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left max-w-xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-3.5 py-1.5 rounded-full border border-primary/20">
            <span>✨</span> Community & Healthcare Survey
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Help Shape the Future of Afiya AI in Pakistan 🇵🇰
          </h3>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            What features do you need most? Share your feedback on medicine price comparisons, prescription scanning, and healthcare needs. Your comments go directly to our team!
          </p>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={onOpenModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95 cursor-pointer text-sm"
          >
            <span>✍️</span> Give Feedback & Comments
          </button>
        </div>
      </div>
    </div>
  );
}
