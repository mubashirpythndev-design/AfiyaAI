"use client";

import type { MedicineCandidate } from "@/lib/types";

interface OCRResultsProps {
  candidates: MedicineCandidate[];
  rawText: string;
  onSelectCandidate: (candidate: MedicineCandidate) => void;
}

export default function OCRResults({ candidates, rawText, onSelectCandidate }: OCRResultsProps) {
  return (
    <div className="animate-slide-up space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Extracted Text</h3>
          <p className="text-xs text-muted">{candidates.length} medicine(s) found</p>
        </div>
      </div>

      {rawText && (
        <div className="bg-surface rounded-xl border border-border p-3 text-xs text-muted font-mono leading-relaxed max-h-24 overflow-y-auto">
          {rawText}
        </div>
      )}

      <div className="space-y-2 stagger-children">
        {candidates.map((candidate, i) => (
          <button
            key={i}
            onClick={() => onSelectCandidate(candidate)}
            className="w-full text-left bg-surface hover:bg-surface-hover border border-border hover:border-primary/30 rounded-xl p-3 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${candidate.is_verified ? "bg-success" : "bg-warning"}`} />
                <span className="text-sm font-medium text-foreground">
                  {candidate.raw_text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  candidate.confidence >= 0.85
                    ? "bg-success/10 text-success"
                    : candidate.confidence >= 0.7
                    ? "bg-warning/10 text-warning"
                    : "bg-danger/10 text-danger"
                }`}>
                  {Math.round(candidate.confidence * 100)}%
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted group-hover:text-primary transition-colors">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
            {candidate.matched_medicine && (
              <p className="text-xs text-muted mt-1 ml-5">
                Matched: {candidate.matched_medicine.brand_name} ({candidate.matched_medicine.generic_name})
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
