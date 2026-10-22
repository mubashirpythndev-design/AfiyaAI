"use client";

/**
 * Afiya AI — Prescription OCR Results & Availability Highlight Component
 * Author / Developer: Mubashir (Lead Developer)
 */

import AppIcon from "@/components/shared/AppIcon";
import { useEffect, useState } from "react";
import type { MedicineCandidate, Language } from "@/lib/types";
import { t, localizeDirections } from "@/lib/i18n";
import SaveToCabinetButton from "@/components/medicine/SaveToCabinetButton";
import { addToCabinet } from "@/lib/api";

function getFormBadge(form?: string | null, language: Language = "en") {
  const f = (form || "").toLowerCase();
  if (f.includes("injection") || f.includes("inj") || f.includes("amp") || f.includes("vial")) {
    return {
      icon: "💉",
      label: t(language, "form.injection"),
      classes: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    };
  }
  if (f.includes("capsule") || f.includes("cap")) {
    return {
      icon: "💊",
      label: t(language, "form.capsule"),
      classes: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    };
  }
  if (f.includes("syrup") || f.includes("syp")) {
    return {
      icon: "🧪",
      label: t(language, "form.syrup"),
      classes: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    };
  }
  if (f.includes("suspension") || f.includes("susp")) {
    return {
      icon: "🧪",
      label: t(language, "form.suspension"),
      classes: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    };
  }
  if (f.includes("inhaler") || f.includes("inh") || f.includes("puff")) {
    return {
      icon: "💨",
      label: t(language, "form.inhaler"),
      classes: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    };
  }
  if (f.includes("drops") || f.includes("drop")) {
    return {
      icon: "💧",
      label: t(language, "form.drops"),
      classes: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    };
  }
  return {
    icon: "⚪",
    label: t(language, "form.tablet"),
    classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  };
}

interface OCRResultsProps {
  candidates: MedicineCandidate[];
  rawText: string;
  clinicalSummary?: string | null;
  globalSafetyNotes?: string[] | null;
  onSelectCandidate: (candidate: MedicineCandidate) => void;
  onAskAI?: (prompt: string) => void;
  language?: Language;
}

export default function OCRResults({
  candidates,
  rawText,
  clinicalSummary,
  globalSafetyNotes,
  onSelectCandidate,
  onAskAI,
  language = "en",
}: OCRResultsProps) {
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">("all");
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [allSaved, setAllSaved] = useState(false);

  useEffect(() => { setFilter("all"); setAllSaved(false); setSaveError(null); }, [candidates]);

  const isCandidateAvailable = (c: MedicineCandidate) =>
    Boolean(
      c.is_verified && c.reviewed && !c.needs_confirmation &&
      c.matched_medicine &&
      c.strength_assessment?.status !== "STRENGTH_MISMATCH" &&
      c.form_assessment?.status !== "FORM_MISMATCH"
    );

  const availableCandidates = candidates.filter(isCandidateAvailable);
  const unavailableCandidates = candidates.filter((c) => !isCandidateAvailable(c));

  const displayedCandidates =
    filter === "available"
      ? availableCandidates
      : filter === "unavailable"
      ? unavailableCandidates
      : candidates;

  const handleSaveAll = async () => {
    if (savingAll || !availableCandidates.length) return;
    setSavingAll(true);
    setSaveError(null);
    try {
      for (const candidate of availableCandidates) {
        if (candidate.matched_medicine) {
          await addToCabinet(
            candidate.matched_medicine.id,
            candidate.dosage_instruction || undefined
          );
        }
      }
      setAllSaved(true);
      setTimeout(() => setAllSaved(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save medicines. Please try again. Some entries may already have been saved.");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="animate-slide-up space-y-4">
      {saveError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{saveError}</p>}
      {/* Header & Status Counters */}
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t(language, "ocr.extractedTitle")}
              </h3>
              <p className="text-xs text-muted">
                {candidates.length} {t(language, "ocr.foundCount")}
              </p>
            </div>
          </div>

          {/* Quick Availability Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {availableCandidates.length} {t(language, "ocr.available")}
            </span>
            {unavailableCandidates.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning border border-warning/30">
                <span className="w-2 h-2 rounded-full bg-warning" />
                {unavailableCandidates.length} {t(language, "ocr.unavailable")}
              </span>
            )}
          </div>
        </div>

        {/* Filter Pills & Batch Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === "all"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-background/60 text-muted hover:text-foreground"
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setFilter("available")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                filter === "available"
                  ? "bg-success text-white shadow-sm"
                  : "bg-background/60 text-muted hover:text-foreground"
              }`}
            >
              ✓ Ready ({availableCandidates.length})
            </button>
            {unavailableCandidates.length > 0 && (
              <button
                onClick={() => setFilter("unavailable")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  filter === "unavailable"
                    ? "bg-warning text-white shadow-sm"
                    : "bg-background/60 text-muted hover:text-foreground"
                }`}
              >
                <AppIcon symbol="⚠️" /> Review / Unmatched ({unavailableCandidates.length})
              </button>
            )}
          </div>

          {availableCandidates.length > 0 && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={savingAll || allSaved}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                allSaved
                  ? "bg-success/20 text-success border-success/40"
                  : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 "
              }`}
            >
              {savingAll ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>{language === "ur" ? "محفوظ ہو رہا ہے..." : "Saving All..."}</span>
                </>
              ) : allSaved ? (
                <>
                  <span>✓</span>
                  <span>{language === "ur" ? "تمام محفوظ ہو گئے!" : "Saved All to Cabinet!"}</span>
                </>
              ) : (
                <>
                  <span><AppIcon symbol="⭐" /></span>
                  <span>
                    {language === "ur"
                      ? `تمام (${availableCandidates.length}) کیبنٹ میں محفوظ کریں`
                      : language === "roman_ur"
                      ? `Tamam (${availableCandidates.length}) cabinet mein save karein`
                      : `Save All to Cabinet (${availableCandidates.length})`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Clinical Prescription Analysis & Instructions Banner */}
      {clinicalSummary && (
        <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <span className="text-base"><AppIcon symbol="🩺" /></span>
              <span>
                {language === "ur"
                  ? "ڈاکٹر کے نسخے کا طبی جائزہ اور ہدایات"
                  : language === "roman_ur"
                  ? "Doctor ke nuskhe ka tibbi jaiza aur hidayat"
                  : "Clinical Prescription Analysis & Doctor's Guidance"}
              </span>
            </div>
            {onAskAI && (
              <button
                type="button"
                onClick={() =>
                  onAskAI(
                    language === "ur"
                      ? "براہ کرم اس نسخے کو آسان زبان میں سمجھائیں، ہر دوا کس مقصد کے لیے ہے اور اسے کیسے لینا چاہیے؟"
                      : language === "roman_ur"
                      ? "Barahe karam is nuskhe ko aasan zaban mein samjhayein, har dawa kis cheez ke liye hai aur kaise lena hai?"
                      : "Please explain this prescription in simple terms, including what each medicine is for, how to take them, and what precautions to take."
                  )
                }
                className="text-xs font-semibold text-primary hover:text-primary-dark inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span><AppIcon symbol="💬" /> {language === "ur" ? "چیٹ میں پوچھیں" : "Ask in Chat"}</span>
              </button>
            )}
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed font-normal">
            {clinicalSummary}
          </p>
        </div>
      )}

      {/* Global Prescription Safety Notes */}
      {globalSafetyNotes && globalSafetyNotes.length > 0 && (
        <div className="bg-amber-500/10 rounded-2xl border border-amber-500/30 p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
            <span className="text-base"><AppIcon symbol="🛡️" /></span>
            <span>
              {language === "ur"
                ? "نسخے کے حفاظتی رہنما اصول (Safety Guardrails)"
                : "Prescription Safety & Legitimacy Guardrails"}
            </span>
          </div>
          <ul className="space-y-1 text-xs text-foreground/90 list-disc list-inside">
            {globalSafetyNotes.map((note, idx) => (
              <li key={idx} className="leading-relaxed font-medium">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw Prescription Text Snippet (if available and no duplicate json) */}
      {rawText && !rawText.trim().startsWith("[") && !rawText.trim().startsWith("{") && (
        <div className="bg-surface/90 rounded-2xl border border-border/80 p-4 sm:p-5 shadow-sm">
          <span className="font-semibold text-muted text-xs block mb-1">Prescription Summary:</span>
          <p className="text-sm font-semibold text-foreground leading-relaxed">{rawText}</p>
        </div>
      )}

      {/* Candidates List with Clear Availability Highlighting */}
      <div className="space-y-3 stagger-children">
        {displayedCandidates.map((candidate, i) => {
          const isAvailable = isCandidateAvailable(candidate);

          return (
            <div
              key={`${candidate.raw_text}-${i}`}
              className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                isAvailable
                  ? "bg-surface hover:bg-surface-hover border-emerald-500/30 hover:border-emerald-500/60 shadow-sm group"
                  : "bg-surface/80 border-amber-500/25 hover:border-amber-500/40 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Status Indicator Icon */}
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      isAvailable
                        ? "bg-success/15 border-success/30 text-success"
                        : "bg-warning/15 border-warning/30 text-warning"
                    }`}
                  >
                    {isAvailable ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base sm:text-lg font-bold text-foreground">
                        {candidate.raw_text}
                      </h4>
                      {/* Show form badge only if form is not already part of raw_text */}
                      {(() => {
                        if (!candidate.detected_form) return null;
                        const formBadge = getFormBadge(candidate.detected_form, language);
                        const alreadyContainsForm =
                          candidate.detected_form &&
                          candidate.raw_text.toLowerCase().includes(candidate.detected_form.toLowerCase());
                        if (alreadyContainsForm) return null;
                        return (
                          <span
                            className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${formBadge.classes}`}
                          >
                            <span><AppIcon symbol={formBadge.icon} /></span>
                            <span>{formBadge.label}</span>
                          </span>
                        );
                      })()}
                      {/* Availability or Strength / Form Mismatch Tag */}
                      {candidate.form_assessment?.status === "FORM_MISMATCH" ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                          <AppIcon symbol="⚠️" /> {language === "ur" ? "خوراک کی شکل میں فرق" : "Dosage Form Mismatch"}
                        </span>
                      ) : candidate.strength_assessment?.status === "STRENGTH_MISMATCH" ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                          <AppIcon symbol="⚠️" /> {language === "ur" ? "طاقت میں فرق" : "Strength Mismatch"}
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                            isAvailable
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-warning/15 text-warning border-warning/30"
                          }`}
                        >
                          {isAvailable
                            ? `✓ ${t(language, "ocr.available")}`
                            : candidate.reviewed ? `⚠️ ${t(language, "ocr.unavailable")}` : language === "ur" ? "تصدیق ضروری ہے" : language === "roman_ur" ? "Review zaroori hai" : "Review required"}
                        </span>
                      )}

                      {/* No Strength Detected Badge */}
                      {candidate.strength_assessment?.status === "NO_STRENGTH_DETECTED" && candidate.matched_medicine && (
                        <span
                          className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                          title="Prescription strength could not be confirmed from image. Showing database record strength."
                        >
                          <span><AppIcon symbol="ℹ️" /></span>
                          <span>
                            {language === "ur"
                              ? `طاقت غیر تصدیق شدہ (ڈیٹا بیس: ${candidate.matched_medicine.strength})`
                              : `Strength Unconfirmed (DB: ${candidate.matched_medicine.strength})`}
                          </span>
                        </span>
                      )}

                      {/* DRAP Legitimacy Badge */}
                      {candidate.safety?.drap_status && (
                        <span
                          className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                            candidate.safety.drap_status.is_verified
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                          }`}
                        >
                          <span><AppIcon symbol={candidate.safety.drap_status.is_verified ? "🛡️" : "⚠️"} /></span>
                          <span>{candidate.safety.drap_status.is_verified ? "DRAP Verified" : "Unverified"}</span>
                        </span>
                      )}

                      {/* Risk Tier Badge */}
                      {candidate.safety?.risk_tier && (
                        <span
                          title={candidate.safety.risk_tier.advisory}
                          className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                            candidate.safety.risk_tier.tier === 3
                              ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                              : candidate.safety.risk_tier.tier === 2
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30"
                          }`}
                        >
                          <span>{candidate.safety.risk_tier.tier === 3 ? "🔴" : candidate.safety.risk_tier.tier === 2 ? "🟡" : "🟢"}</span>
                          <span>{candidate.safety.risk_tier.tier === 3 ? "Rx Only" : candidate.safety.risk_tier.tier === 2 ? "Caution" : "OTC"}</span>
                        </span>
                      )}
                    </div>

                    {/* Clinical Purpose Badge */}
                    {candidate.clinical_purpose && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl">
                        <span><AppIcon symbol="💡" /></span>
                        <span>{candidate.clinical_purpose}</span>
                      </div>
                    )}

                    {candidate.form_assessment?.status === "FORM_MISMATCH" ? (
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                          <span><AppIcon symbol="⚠️" /></span>
                          <span>
                            {language === "ur"
                              ? "خوراک کی شکل (فارم) میں فرق کی تنبیہ"
                              : language === "roman_ur"
                              ? "Dosage Form Mismatch Caution"
                              : "Dosage Form Mismatch Caution"}
                          </span>
                        </div>
                        <p className="mt-1 text-foreground/90 font-medium leading-relaxed">
                          {language === "ur" || language === "roman_ur"
                            ? (candidate.form_assessment.urdu_warning_message || candidate.form_assessment.warning_message)
                            : candidate.form_assessment.warning_message}
                        </p>
                        {candidate.matched_medicine && (
                          <p className="mt-1.5 text-muted text-[11px]">
                            {language === "ur"
                              ? "قریب ترین دستیاب ڈیٹا بیس ریکارڈ:"
                              : language === "roman_ur"
                              ? "Closest database match:"
                              : "Closest database match:"}{" "}
                            <span className="font-semibold text-foreground">{candidate.matched_medicine.brand_name}</span>{" "}
                            ({candidate.matched_medicine.generic_name} &bull; {candidate.matched_medicine.dosage_form} &bull; {candidate.matched_medicine.strength})
                          </p>
                        )}
                      </div>
                    ) : candidate.strength_assessment?.status === "STRENGTH_MISMATCH" ? (
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                          <span><AppIcon symbol="⚠️" /></span>
                          <span>
                            {language === "ur"
                              ? "طاقت / خوراک میں فرق کی تنبیہ"
                              : language === "roman_ur"
                              ? "Strength Mismatch Caution"
                              : "Strength Mismatch Caution"}
                          </span>
                        </div>
                        <p className="mt-1 text-foreground/90 font-medium leading-relaxed">
                          {language === "ur" || language === "roman_ur"
                            ? (candidate.strength_assessment.urdu_warning_message || candidate.strength_assessment.warning_message)
                            : candidate.strength_assessment.warning_message}
                        </p>
                        {candidate.matched_medicine && (
                          <p className="mt-1.5 text-muted text-[11px]">
                            {language === "ur"
                              ? "قریب ترین دستیاب ڈیٹا بیس ریکارڈ:"
                              : language === "roman_ur"
                              ? "Closest database match:"
                              : "Closest database match:"}{" "}
                            <span className="font-semibold text-foreground">{candidate.matched_medicine.brand_name}</span>{" "}
                            ({candidate.matched_medicine.generic_name} &bull; {candidate.matched_medicine.dosage_form} &bull; {candidate.matched_medicine.strength})
                          </p>
                        )}
                      </div>
                    ) : isAvailable && candidate.matched_medicine ? (
                      <p className="text-xs text-primary font-medium mt-1.5">
                        Matched Database Medicine:{" "}
                        <span className="font-bold text-foreground">
                          {candidate.matched_medicine.brand_name}
                        </span>{" "}
                        ({candidate.matched_medicine.generic_name} &bull; {candidate.matched_medicine.dosage_form} &bull; {candidate.matched_medicine.strength})
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted mt-1.5 leading-relaxed">
                          {candidate.matched_medicine
                            ? language === "ur" ? "ڈیٹا بیس میں ممکنہ ریکارڈ ملا ہے۔ استعمال یا محفوظ کرنے سے پہلے اوپر ریڈنگ چیک اور کنفرم کریں۔" : language === "roman_ur" ? "Catalog mein mumkin record mila hai. Use ya save se pehle upar reading check aur confirm karein." : "A possible catalog record was found. Review and confirm the reading above before using or saving it."
                            : t(language, "ocr.unavailableDesc")}
                        </p>
                        {candidate.safety?.drap_status?.warning && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium leading-relaxed">
                            <AppIcon symbol="⚠️" /> {language === "ur" || language === "roman_ur"
                              ? candidate.safety.drap_status.urdu_warning
                              : candidate.safety.drap_status.warning}
                          </p>
                        )}
                      </>
                    )}
                    {candidate.dosage_instruction && (
                      <div className="mt-3 inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-950/40 border border-teal-500/30 text-xs">
                        <span className="text-teal-400 font-bold flex items-center gap-1.5 shrink-0">
                          <span><AppIcon symbol="🕒" /></span>
                          <span>{t(language, "ocr.directions")}:</span>
                        </span>
                        <span className="text-foreground/90 font-medium leading-relaxed">
                          {localizeDirections(candidate.dosage_instruction, language, candidate.detected_form)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reported legibility is not a calibrated correctness probability. */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                      candidate.confidence >= 0.85
                        ? "bg-success/15 text-success border-success/30"
                        : candidate.confidence >= 0.70
                        ? "bg-warning/15 text-warning border-warning/30"
                        : "bg-danger/15 text-danger border-danger/30"
                    }`}
                  title="Model-reported legibility, not measured accuracy. Catalog similarity is separate."
                  >
                    {candidate.user_edited ? "User reviewed" : `Reported legibility: ${Math.round(candidate.confidence * 100)}%`}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                {onAskAI && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAskAI(
                        language === "ur"
                          ? `${candidate.raw_text} کے بارے میں بتائیں: یہ کس مقصد کے لیے ہے، خوراک اور احتیاطی تدابیر کیا ہیں؟`
                          : language === "roman_ur"
                          ? `${candidate.raw_text} ke baare mein batayein: yeh kis cheez ke liye hai, iski khurak aur ehtiat kya hain?`
                          : `Explain ${candidate.raw_text} from my prescription: what is its clinical purpose, dosage timing, and precautions?`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark bg-accent/10 hover:bg-accent/20 px-3 py-1.5 rounded-xl border border-accent/20 transition-all  cursor-pointer"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>
                      {language === "ur"
                        ? "AI سے اس دوا کا پوچھیں"
                        : language === "roman_ur"
                        ? "AI se is dawa ka poochein"
                        : "Ask AI About This Medicine"}
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  {isAvailable && candidate.matched_medicine && (
                    <SaveToCabinetButton
                      medicineId={candidate.matched_medicine.id}
                      dosageInstruction={candidate.dosage_instruction || undefined}
                      variant="compact"
                    />
                  )}

                  {isAvailable && (
                    <button
                      type="button"
                      onClick={() => onSelectCandidate(candidate)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20 transition-all  cursor-pointer"
                    >
                      <span>
                        {language === "ur"
                          ? "قیمتیں اور متبادل دیکھیں"
                          : language === "roman_ur"
                          ? "Prices aur alternatives dekhein"
                          : "View Prices & Alternatives"}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
