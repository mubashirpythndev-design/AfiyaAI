"use client";

import { useState } from "react";
import { checkPrice, createOverchargeReport } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Language, MedicineDetail, PriceCheckResponse } from "@/lib/types";

interface MrpCheckerProps {
  /** The medicine already resolved on screen (spec-04 verified match). */
  medicine: MedicineDetail;
  language: Language;
}

/** Status -> visual tone only. The status itself comes from the API; the
 *  client never computes or re-derives it. */
const STATUS_TONE: Record<
  string,
  { border: string; badgeBg: string; badgeText: string; icon: string }
> = {
  OVERCHARGED: {
    border: "border-danger/30",
    badgeBg: "bg-danger/10",
    badgeText: "text-danger",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z",
  },
  OK_AT_MRP: {
    border: "border-success/30",
    badgeBg: "bg-success/10",
    badgeText: "text-success",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  BELOW_MRP: {
    border: "border-success/30",
    badgeBg: "bg-success/10",
    badgeText: "text-success",
    icon: "M23 6l-9.5 9.5-5-5L1 18",
  },
  NO_DATA: {
    border: "border-warning/30",
    badgeBg: "bg-warning/10",
    badgeText: "text-warning",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

const FALLBACK_TONE = {
  border: "border-border",
  badgeBg: "bg-surface-hover",
  badgeText: "text-muted",
  icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

export default function MrpChecker({ medicine, language }: MrpCheckerProps) {
  const [priceInput, setPriceInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceCheckResponse | null>(null);

  // Optional Overcharge Report State
  const [showReportForm, setShowReportForm] = useState(false);
  const [pharmacyName, setPharmacyName] = useState("");
  const [city, setCity] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  // The backend re-resolves the query via the spec-04 matcher; the
  // brand+strength form is the exact key the matcher resolves on.
  const runCheck = async (query: string) => {
    const parsed = Number(priceInput);
    if (!priceInput.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      // Reject <= 0 client-side, matching the API's Field(gt=0) -> 422.
      setValidationError(t(language, "mrp.invalidPrice"));
      return;
    }
    setValidationError(null);
    setRequestError(null);
    setLoading(true);
    try {
      const resp = await checkPrice({
        medicine_query: query,
        price_paid: parsed,
        lang: language, // "en" | "ur" | "roman_ur" — accepted as-is by the API
      });
      setResult(resp);
    } catch {
      setRequestError(t(language, "mrp.error"));
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
                <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t(language, "mrp.title")}
              </h3>
              <p className="text-xs text-muted">{t(language, "mrp.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Input + button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="mrp-price-input" className="block text-xs font-medium text-muted mb-1.5">
                {t(language, "mrp.inputLabel")}
              </label>
              <input
                id="mrp-price-input"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setValidationError(null);
                }}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  runCheck(`${medicine.brand_name} ${medicine.strength}`)
                }
                placeholder={t(language, "mrp.placeholder")}
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
                {loading ? t(language, "mrp.checking") : t(language, "mrp.checkBtn")}
              </button>
            </div>
          </div>

          {/* Local validation (must match the API's gt=0 rule) */}
          {validationError && (
            <p className="text-xs font-medium text-danger">{validationError}</p>
          )}

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

              {/* Facts grid — values exactly as returned by the API */}
              {(result.mrp !== null ||
                result.overcharge_amount !== null ||
                result.effective_date ||
                result.pack_size ||
                result.source) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {result.price_paid !== null && (
                    <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                      <p className="text-muted mb-0.5">{t(language, "mrp.paidLabel")}</p>
                      <p className="font-semibold text-foreground">
                        {result.currency} {result.price_paid}
                      </p>
                    </div>
                  )}
                  {result.mrp !== null && (
                    <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                      <p className="text-muted mb-0.5">{t(language, "mrp.mrpLabel")}</p>
                      <p className="font-semibold text-foreground">
                        {result.currency} {result.mrp}
                      </p>
                    </div>
                  )}
                  {result.overcharge_amount !== null && result.overcharge_amount > 0 && (
                    <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                      <p className="text-muted mb-0.5">{t(language, "mrp.overchargeLabel")}</p>
                      <p className="font-semibold text-danger">
                        {result.currency} {result.overcharge_amount}
                      </p>
                    </div>
                  )}
                  {result.effective_date && (
                    <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                      <p className="text-muted mb-0.5">{t(language, "mrp.effectiveLabel")}</p>
                      <p className="font-semibold text-foreground">{result.effective_date}</p>
                    </div>
                  )}
                  {result.pack_size && (
                    <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                      <p className="text-muted mb-0.5">{t(language, "mrp.packLabel")}</p>
                      <p className="font-semibold text-foreground">{result.pack_size}</p>
                    </div>
                  )}
                  {result.source && (
                    <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                      <p className="text-muted mb-0.5">{t(language, "mrp.sourceLabel")}</p>
                      {result.source.url ? (
                        <a
                          href={result.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          {result.source.name}
                        </a>
                      ) : (
                        <p className="font-semibold text-foreground">{result.source.name}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Low-confidence: show the API's candidates for confirmation */}
              {result.needs_confirmation && result.candidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {t(language, "mrp.confirmPrompt")}
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

              {/* Mandatory disclaimer — the API's own localized safety line.
                  Never show a verdict without it. */}
              <p className="text-xs text-muted border-t border-border/60 pt-2.5 leading-relaxed">
                {result.disclaimer}
              </p>

              {/* Optional Report Overcharge Action — strictly shown on OVERCHARGED status */}
              {result.status === "OVERCHARGED" && result.medicine_id && (
                <div className="border-t border-border/60 pt-3">
                  {!showReportForm && !reportSuccess ? (
                    <button
                      onClick={() => setShowReportForm(true)}
                      className="w-full flex items-center justify-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-xl py-2.5 px-4 text-xs font-semibold transition-all duration-300"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                      🚩 Report Pharmacy Overcharge (Optional)
                    </button>
                  ) : reportSuccess ? (
                    <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-center text-xs font-semibold text-success">
                      ✓ Thank you! Overcharge report logged for DRAP compliance audit.
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!pharmacyName.trim() || !city.trim()) return;
                        setReportSubmitting(true);
                        setReportError(null);
                        try {
                          await createOverchargeReport({
                            medicine_id: result.medicine_id!,
                            pharmacy_name: pharmacyName,
                            city: city,
                            price_paid: Number(priceInput),
                            note: reportNote || undefined,
                          });
                          setReportSuccess(true);
                          setShowReportForm(false);
                        } catch (err: any) {
                          setReportError(err.message || "Failed to log report. Please sign in.");
                        } finally {
                          setReportSubmitting(false);
                        }
                      }}
                      className="bg-surface-hover border border-border rounded-xl p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground">Report Overcharge Violation</h4>
                        <button
                          type="button"
                          onClick={() => setShowReportForm(false)}
                          className="text-xs text-muted hover:text-foreground"
                        >
                          ✕ Cancel
                        </button>
                      </div>

                      {reportError && (
                        <p className="text-xs text-danger font-medium">{reportError}</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">Pharmacy Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. City Pharmacy"
                            value={pharmacyName}
                            onChange={(e) => setPharmacyName(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">City *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Lahore, Karachi"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">Additional Note (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Refused receipt"
                          value={reportNote}
                          onChange={(e) => setReportNote(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={reportSubmitting}
                        className="w-full bg-danger hover:bg-danger/90 disabled:opacity-50 text-white font-semibold text-xs py-2 rounded-lg transition-colors"
                      >
                        {reportSubmitting ? "Submitting Report..." : "Submit Overcharge Report"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
