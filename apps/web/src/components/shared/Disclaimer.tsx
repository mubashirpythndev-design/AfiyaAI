import { MEDICAL_DISCLAIMER } from "@/lib/constants";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";

interface DisclaimerProps {
  language?: Language;
}

export default function Disclaimer({ language = "en" }: DisclaimerProps) {
  return (
    <div className="bg-warning/8 border border-warning/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning mt-0.5 shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-xs text-muted leading-relaxed">
        <strong className="text-foreground/80">{t(language, "disclaimer.label")}</strong> {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
