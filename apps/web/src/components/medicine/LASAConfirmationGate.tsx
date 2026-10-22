"use client";

import type { LASAWarning, Language, LASACandidate } from "@/lib/types";

interface LASAConfirmationGateProps {
  warning: LASAWarning;
  language: Language;
  onSelectCandidate: (candidate: LASACandidate) => void;
  onCancel?: () => void;
}

export default function LASAConfirmationGate({
  warning,
  language,
  onSelectCandidate,
  onCancel,
}: LASAConfirmationGateProps) {
  const isUrdu = language === "ur" || language === "roman_ur";

  return (
    <div className="w-full rounded-2xl border-2 border-amber-500/40 bg-surface    p-6 shadow-xl backdrop-blur-sm animate-fade-in my-6">
      {/* Header with warning icon */}
      <div className="flex items-start gap-3.5 mb-5">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {language === "ur" ? "سیفٹی الرٹ (LASA)" : "Safety Verification Gate"}
            </span>
            <span className="text-xs text-muted-foreground">
              {language === "ur" ? "انتخاب درکار ہے" : "Action Required"}
            </span>
          </div>
          <h3 className="text-lg font-bold text-foreground mt-1">
            {language === "ur"
              ? "مشابہ ادویات کی احتیاطی تصدیق"
              : language === "roman_ur"
              ? "Milti Julti Dawayon ki Ehtiyati Tasdeeq"
              : "Look-Alike / Sound-Alike (LASA) Drug Verification"}
          </h3>
          <p className="text-sm text-foreground/85 mt-1 leading-relaxed">
            {isUrdu ? warning.urdu_warning_message : warning.warning_message}
          </p>
        </div>
      </div>

      {/* Comparison Cards: Candidate A vs Candidate B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Candidate A */}
        <div className="relative flex flex-col justify-between rounded-xl border-2 border-border/80 hover:border-primary/60 bg-surface/90 p-5 transition-all shadow-sm hover:shadow-md">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2 py-0.5 rounded bg-primary/10">
                Option 1
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {warning.candidate_a.dosage_form}
              </span>
            </div>

            <div>
              <h4 className="text-xl font-bold text-foreground">
                {warning.candidate_a.brand_name}
              </h4>
              <p className="text-sm font-semibold text-primary/90 mt-0.5">
                Formula: {warning.candidate_a.generic_name}
              </p>
            </div>

            <div className="pt-2 border-t border-border/50 text-xs space-y-1 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Strength:</span> {warning.candidate_a.strength || "Standard"}
              </div>
              <div>
                <span className="font-medium text-foreground">Therapeutic Use:</span> {warning.candidate_a.category || "General"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectCandidate(warning.candidate_a)}
            className="mt-5 w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>
              {language === "ur"
                ? `میں '${warning.candidate_a.brand_name}' لینا چاہتا ہوں`
                : language === "roman_ur"
                ? `Main '${warning.candidate_a.brand_name}' chahta hoon`
                : `Select ${warning.candidate_a.brand_name}`}
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>

        {/* Candidate B */}
        <div className="relative flex flex-col justify-between rounded-xl border-2 border-border/80 hover:border-accent/60 bg-surface/90 p-5 transition-all shadow-sm hover:shadow-md">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent px-2 py-0.5 rounded bg-accent/10">
                Option 2
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {warning.candidate_b.dosage_form}
              </span>
            </div>

            <div>
              <h4 className="text-xl font-bold text-foreground">
                {warning.candidate_b.brand_name}
              </h4>
              <p className="text-sm font-semibold text-accent/90 mt-0.5">
                Formula: {warning.candidate_b.generic_name}
              </p>
            </div>

            <div className="pt-2 border-t border-border/50 text-xs space-y-1 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Strength:</span> {warning.candidate_b.strength || "Standard"}
              </div>
              <div>
                <span className="font-medium text-foreground">Therapeutic Use:</span> {warning.candidate_b.category || "General"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectCandidate(warning.candidate_b)}
            className="mt-5 w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-accent text-accent-foreground hover:bg-accent/90 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>
              {language === "ur"
                ? `میں '${warning.candidate_b.brand_name}' لینا چاہتا ہوں`
                : language === "roman_ur"
                ? `Main '${warning.candidate_b.brand_name}' chahta hoon`
                : `Select ${warning.candidate_b.brand_name}`}
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      {onCancel && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
          >
            {language === "ur" ? "تلاش منسوخ کریں" : "Neither of these (Refine search)"}
          </button>
        </div>
      )}
    </div>
  );
}
