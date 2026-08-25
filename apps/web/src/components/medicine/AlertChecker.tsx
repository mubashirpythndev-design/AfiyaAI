"use client";

import { useState } from "react";
import { checkAlerts } from "@/lib/api";
import { t } from "@/lib/i18n";
import type {
  AlertCheckResponse,
  AlertEntry,
  Language,
  MedicineDetail,
} from "@/lib/types";

interface AlertCheckerProps {
  /** The medicine already resolved on screen (spec-04 verified match). */
  medicine: MedicineDetail;
  language: Language;
}

/** Status -> visual tone only. The status/verdict comes from the API; the
 *  client never decides authenticity itself (spec 08 / spec 09 §10). */
const STATUS_TONE: Record<
  string,
  { border: string; badgeBg: string; badgeText: string; icon: string }
> = {
  ALERT_FOUND: {
    border: "border-danger/30",
    badgeBg: "bg-danger/10",
    badgeText: "text-danger",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z",
  },
  // Calm neutral tone: absence of an alert is NOT a proof of authenticity.
  NO_ALERT: {
    border: "border-border",
    badgeBg: "bg-surface-hover",
    badgeText: "text-muted",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

const FALLBACK_TONE = {
  border: "border-border",
  badgeBg: "bg-surface-hover",
  badgeText: "text-muted",
  icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

export default function AlertChecker({ medicine, language }: AlertCheckerProps) {
  const [batchInput, setBatchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<AlertCheckResponse | null>(null);

  // The backend re-resolves the query via the spec-04 matcher; the
  // brand+strength form is the exact key the matcher resolves on (same as
  // MrpChecker). Batch is OPTIONAL — an empty batch is a valid name-only
  // check, so it is never validated or blocked client-side.
  const runCheck = async (query: string) => {
    setRequestError(null);
    setLoading(true);
    try {
      const batch = batchInput.trim();
      const resp = await checkAlerts({
        medicine_query: query,
        batch_no: batch || undefined, // omit when empty
        lang: language, // "en" | "ur" | "roman_ur" — accepted as-is by the API
      });
      setResult(resp);
    } catch {
      setRequestError(t(language, "alert.error"));
    } finally {
      setLoading(false);
    }
  };

  const tone =
    (result?.status && STATUS_TONE[result.status]) || FALLBACK_TONE;

  return (
    <div className="animate-slide-up mt-6">
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-surface-hover border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t(language, "alert.title")}
              </h3>
              <p className="text-xs text-muted">{t(language, "alert.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Input + button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="alert-batch-input" className="block text-xs font-medium text-muted mb-1.5">
                {t(language, "alert.inputLabel")}
              </label>
              <input
                id="alert-batch-input"
                type="text"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  runCheck(`${medicine.brand_name} ${medicine.strength}`)
                }
                placeholder={t(language, "alert.placeholder")}
                disabled={loading}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
              />
            </div>
            <div className="sm:self-end">
              <button
                onClick={() => runCheck(`${medicine.brand_name} ${medicine.strength}`)}
                disabled={loading}
                className="w-full sm:w-auto bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
              >
                {loading ? t(language, "alert.checking") : t(language, "alert.checkBtn")}
              </button>
            </div>
          </div>

          {/* Request failed */}
          {requestError && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-sm text-danger">{requestError}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 text-sm text-muted py-2">
              <svg className="animate-spin w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {t(language, "loading.text")}
            </div>
          )}

          {/* Result — rendered STRICTLY from the API response */}
          {result && !loading && (
            <div className={`rounded-xl border ${tone.border} p-4 space-y-3`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${tone.badgeBg} flex items-center justify-center shrink-0`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tone.badgeText}>
                    <path d={tone.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  {/* Status badge — the API's status, verbatim */}
                  {result.status ? (
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${tone.badgeBg} ${tone.badgeText} mb-1`}>
                      {result.status}
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-warning/10 text-warning mb-1">
                      ?
                    </span>
                  )}
                  {result.matched_name && (
                    <p className="text-sm font-semibold text-foreground">{result.matched_name}</p>
                  )}
                  {/* The API's localized message — never rephrased client-side */}
                  <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{result.message}</p>
                </div>
              </div>

              {/* Active alerts — every fact displayed exactly as returned by
                  the API (DB rows only, never generated client-side). */}
              {result.alerts.length > 0 && (
                <div className="space-y-2">
                  {result.alerts.map((alert, idx) => (
                    <AlertCard key={idx} alert={alert} language={language} />
                  ))}
                </div>
              )}

              {/* Low-confidence: show the API's candidates for confirmation */}
              {result.needs_confirmation && result.candidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {t(language, "alert.confirmPrompt")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.candidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => runCheck(`${c.brand_name} ${c.strength}`)}
                        className="text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full px-3 py-1.5 transition-colors"
                      >
                        {c.brand_name} {c.strength}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandatory disclaimer — the API's own localized safety line
                  ("no alert found does NOT guarantee authenticity", spec 09
                  §10). Rendered on EVERY branch, never a verdict without it. */}
              <p className="text-xs text-muted border-t border-border/60 pt-2.5 leading-relaxed">
                {result.disclaimer}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, language }: { alert: AlertEntry; language: Language }) {
  return (
    <div className="bg-background/50 rounded-xl border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Alert type — verbatim from the API */}
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-danger/10 text-danger">
          {alert.alert_type}
        </span>
        {/* HOW it matched — from the API's match_basis, never inferred */}
        {alert.match_basis === "batch_no" ? (
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
            {t(language, "alert.matchedByBatch")}
          </span>
        ) : (
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning">
            {t(language, "alert.possibleMatch")}
          </span>
        )}
        {/* Demo rows can never be mistaken for a confirmed real notice */}
        {alert.is_demo && (
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30">
            {t(language, "alert.demoBadge")}
          </span>
        )}
      </div>

      {/* Description verbatim — never rewritten or summarized client-side */}
      {alert.description && (
        <p className="text-sm text-foreground/80 leading-relaxed">{alert.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {alert.batch_no && (
          <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
            <p className="text-muted mb-0.5">{t(language, "alert.batchLabel")}</p>
            <p className="font-semibold text-foreground">{alert.batch_no}</p>
          </div>
        )}
        {alert.issued_at && (
          <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
            <p className="text-muted mb-0.5">{t(language, "alert.issuedLabel")}</p>
            <p className="font-semibold text-foreground">{alert.issued_at}</p>
          </div>
        )}
        {alert.source && (
          <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
            <p className="text-muted mb-0.5">{t(language, "alert.sourceLabel")}</p>
            {alert.source.url ? (
              <a
                href={alert.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                {alert.source.name}
              </a>
            ) : (
              <p className="font-semibold text-foreground">{alert.source.name}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
