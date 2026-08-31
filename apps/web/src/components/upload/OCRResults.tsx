"use client";

/**
 * Afiya AI — Prescription OCR Results & Availability Highlight Component
 * Author / Developer: Mubashir (Lead Developer)
 */

import { useState } from "react";
import type { MedicineCandidate, Language } from "@/lib/types";
import { t } from "@/lib/i18n";

interface OCRResultsProps {
  candidates: MedicineCandidate[];
  rawText: string;
  onSelectCandidate: (candidate: MedicineCandidate) => void;
  language?: Language;
}

export default function OCRResults({
  candidates,
  rawText,
  onSelectCandidate,
  language = "en",
}: OCRResultsProps) {
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">("all");

  const isCandidateAvailable = (c: MedicineCandidate) => Boolean(c.is_verified && c.matched_medicine);

  const availableCandidates = candidates.filter(isCandidateAvailable);
  const unavailableCandidates = candidates.filter((c) => !isCandidateAvailable(c));

  const displayedCandidates =
    filter === "available"
      ? availableCandidates
      : filter === "unavailable"
      ? unavailableCandidates
      : candidates;

  return (
    <div className="animate-slide-up space-y-4">
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

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-border">
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
            ✓ Available ({availableCandidates.length})
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
              ⚠️ Not in DB ({unavailableCandidates.length})
            </button>
          )}
        </div>
      </div>

      {/* Raw Prescription Text Snippet (if available) */}
      {rawText && !rawText.trim().startsWith("[") && !rawText.trim().startsWith("{") && (
        <div className="bg-surface/80 rounded-xl border border-border/80 p-3 text-xs text-foreground/80 leading-relaxed max-h-24 overflow-y-auto">
          <span className="font-semibold text-muted text-[11px] block mb-1">Prescription Summary:</span>
          {rawText}
        </div>
      )}

      {/* Candidates List with Clear Availability Highlighting */}
      <div className="space-y-2.5 stagger-children">
        {displayedCandidates.map((candidate, i) => {
          const isAvailable = isCandidateAvailable(candidate);

          return (
            <div
              key={`${candidate.raw_text}-${i}`}
              onClick={() => {
                if (isAvailable) {
                  onSelectCandidate(candidate);
                }
              }}
              className={`rounded-2xl border p-4 transition-all duration-200 ${
                isAvailable
                  ? "bg-surface hover:bg-surface-hover border-success/30 hover:border-success/60 shadow-sm cursor-pointer group"
                  : "bg-warning/5 border-warning/30 cursor-default"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Status Indicator Icon */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isAvailable
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {isAvailable ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                        {candidate.raw_text}
                      </h4>
                      {/* Availability Tag */}
                      <span
                        className={`text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          isAvailable
                            ? "bg-success/15 text-success border border-success/25"
                            : "bg-warning/15 text-warning border border-warning/25"
                        }`}
                      >
                        {isAvailable
                          ? `✓ ${t(language, "ocr.available")}`
                          : `⚠️ ${t(language, "ocr.unavailable")}`}
                      </span>
                    </div>

                    {isAvailable && candidate.matched_medicine ? (
                      <p className="text-xs text-primary font-medium mt-1">
                        Matched Database Medicine:{" "}
                        <span className="font-bold text-foreground">
                          {candidate.matched_medicine.brand_name}
                        </span>{" "}
                        ({candidate.matched_medicine.generic_name} • {candidate.matched_medicine.strength})
                      </p>
                    ) : (
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {t(language, "ocr.unavailableDesc")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Confidence & Action indicator */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      candidate.confidence >= 0.85
                        ? "bg-success/10 text-success"
                        : candidate.confidence >= 0.7
                        ? "bg-warning/10 text-warning"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    OCR Confidence: {Math.round(candidate.confidence * 100)}%
                  </span>

                  {isAvailable && (
                    <span className="text-[11px] font-medium text-primary group-hover:underline flex items-center gap-1 mt-1">
                      View Details
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition-transform">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
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
