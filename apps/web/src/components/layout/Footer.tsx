import { MEDICAL_DISCLAIMER } from "@/lib/constants";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";

interface FooterProps {
  language?: Language;
}

export default function Footer({ language = "en" }: FooterProps) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Disclaimer */}
        <div className="bg-warning/8 border border-warning/15 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-warning text-sm">&#9888;</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">{t(language, "footer.disclaimerTitle")}</h4>
              <p className="text-sm text-muted leading-relaxed">
                {MEDICAL_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>

        {/* Footer content */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2v20M2 12h20" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold text-foreground">
                Afiya <span className="text-primary">AI</span>
              </span>
              <p className="text-[10px] text-muted font-medium tracking-wider uppercase">
                Medicine Assistant
              </p>
            </div>
          </div>

          {/* Center info */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {t(language, "footer.drapVerified")}
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span>{t(language, "footer.builtFor")}</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>{new Date().getFullYear()}</span>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted bg-primary/5 rounded-full px-3 py-1.5 border border-primary/10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-medium">{t(language, "footer.safetyFirst")}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
