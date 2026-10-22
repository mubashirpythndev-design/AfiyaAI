"use client";

import AppIcon from "@/components/shared/AppIcon";
import type { MedicineInfo, Language } from "@/lib/types";
import { t } from "@/lib/i18n";
import SaveToCabinetButton from "./SaveToCabinetButton";

interface InfoPanelProps {
  info: MedicineInfo;
  language?: Language;
  onRequireAuth?: () => void;
  isGenericSearch?: boolean;
  onSelectMedicine?: (id: string) => void;
}

/** Trim trailing zeros from a display number (59.99 -> "59.99", 60 -> "60"). */
function fmtNum(value: number, maxDecimals = 2): string {
  return parseFloat(value.toFixed(maxDecimals)).toString();
}

export default function InfoPanel({ info, language = "en", onRequireAuth, isGenericSearch = false, onSelectMedicine }: InfoPanelProps) {
  const { medicine, knowledge_chunks, sources, cheapest_brands } = info;

  // Show the block only when a real alternative exists (>= 2 brands in the
  // same (generic, strength) group). No empty "alternatives" box.
  const showCheapest =
    !!cheapest_brands && cheapest_brands.options.length > 1;

  const grouped = knowledge_chunks.reduce((acc, chunk) => {
    if (!acc[chunk.chunk_type]) acc[chunk.chunk_type] = [];
    acc[chunk.chunk_type].push(chunk);
    return acc;
  }, {} as Record<string, typeof knowledge_chunks>);

  const typeLabels: Record<string, string> = {
    verified_profile: "Medicine Profile & Classification",
    when_to_use: "When to Use / Indications",
    uses: "Uses & Indications",
    side_effects: "Side Effects & Adverse Reactions",
    precautions: "Precautions & Warnings",
    dosage_instructions: "Dosage & Usage Instructions",
    dosage_info: "Dosage Information",
    food_interactions: "Food & Drug Interactions",
    general: "General Information",
  };

  const typeIcons: Record<string, string> = {
    verified_profile: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    when_to_use: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    uses: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    side_effects: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
    precautions: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    dosage_instructions: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    dosage_info: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    food_interactions: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  };

  return (
    <div className="animate-slide-up space-y-4">
      {/* Medicine header */}
      <div className="bg-surface rounded-2xl p-5 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {isGenericSearch ? (
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                <AppIcon symbol="🧪" /> Generic Molecule Overview
              </span>
              <span className="text-[11px] font-semibold text-muted">
                {medicine.strength} {medicine.dosage_form}
              </span>
            </div>
            <h3 className="text-xl font-bold text-foreground">
              {medicine.generic_name}
            </h3>
            <p className="text-sm text-muted">
              Category: {medicine.category} &bull; DRAP-Aligned Clinical Profile
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-bold text-foreground">{medicine.brand_name}</h3>
            <p className="text-sm text-muted">{medicine.generic_name} &bull; {medicine.strength} &bull; {medicine.dosage_form}</p>
            <p className="text-xs text-muted mt-1">Manufacturer: {medicine.manufacturer}</p>
          </div>
        )}
        <SaveToCabinetButton
          medicineId={medicine.id}
          onRequireAuth={onRequireAuth}
        />
      </div>

      {/* Cheapest brands in the same (generic, strength) group.
          All prices/per-unit come from the verified DB - never the LLM. */}
      {showCheapest && cheapest_brands && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-hover border-b border-border">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-semibold text-foreground">
                {t(language, "info.cheapestTitle")}
              </h4>
            </div>
            <p className="text-xs text-muted mt-1">
              {t(language, "info.cheapestSubtitle")} — {cheapest_brands.generic} {cheapest_brands.strength}
            </p>
          </div>

          <div className="p-4 space-y-3">
            {cheapest_brands.options.map((opt, idx) => {
              const isCheapest = idx === 0;
              const isSelected = opt.medicine_id === medicine.id;
              const isQueried = !isGenericSearch && opt.medicine_id === medicine.id;
              const saving = opt.saving_percent_vs_queried;
              return (
                <div
                  key={opt.medicine_id}
                  onClick={() => onSelectMedicine && onSelectMedicine(opt.medicine_id)}
                  className={`rounded-xl border p-4 transition-all ${
                    onSelectMedicine ? "cursor-pointer hover:shadow-md hover:scale-[1.005]" : ""
                  } ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : isCheapest
                      ? "border-success/40 bg-success/5 hover:border-success/60"
                      : "border-border bg-background/50 hover:border-primary/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-foreground hover:text-primary transition-colors">
                          {opt.brand_name}
                        </span>
                        {isCheapest && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-success text-white">
                            {t(language, "info.cheapestBadge")}
                          </span>
                        )}
                        {isSelected && !isGenericSearch && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            ✓ Currently Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{opt.manufacturer}</p>
                    </div>
                    <div className="text-start sm:text-end shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        Rs {fmtNum(opt.per_unit)}
                        <span className="text-[10px] font-medium text-muted"> {t(language, "info.perUnit")}</span>
                      </p>
                      {!isGenericSearch && !isQueried && saving > 0 && (
                        <p className="text-xs font-semibold text-success">
                          {t(language, "info.save")} {fmtNum(saving)}% {t(language, "info.vsYours")}
                        </p>
                      )}
                      {!isGenericSearch && !isQueried && saving < 0 && (
                        <p className="text-xs font-semibold text-danger">
                          +{fmtNum(Math.abs(saving))}% {t(language, "info.vsYours")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted pt-2.5 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      <span>
                        {t(language, "info.packPrice")}: <strong className="text-foreground">Rs {opt.price.toLocaleString()}</strong>
                      </span>
                      <span>
                        {t(language, "info.packSize")}: <strong className="text-foreground">{opt.package_size}</strong>
                      </span>
                    </div>
                    {onSelectMedicine && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMedicine(opt.medicine_id);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          isSelected
                            ? "bg-primary text-white shadow-sm"
                            : "bg-surface-hover hover:bg-primary hover:text-white border border-border"
                        }`}
                      >
                        {isSelected ? "✓ Active View" : "Compare Prices"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Safety guard (spec 08): NTI / modified-release / biologics */}
            {cheapest_brands.consult_pharmacist_before_switching && (
              <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning mt-0.5 shrink-0">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs font-medium text-foreground/90">
                  {t(language, "info.consultPharmacist")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Knowledge chunks */}
      <div className="space-y-3 stagger-children">
        {Object.entries(grouped).map(([type, chunks]) => (
          <div key={type} className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-surface-hover flex items-center gap-2 border-b border-border">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d={typeIcons[type] || typeIcons.general} />
              </svg>
              <h4 className="text-sm font-semibold text-foreground">
                {typeLabels[type] || type.replace("_", " ")}
              </h4>
            </div>
            <div className="p-4 space-y-2">
              {chunks.map((chunk) => (
                <p key={chunk.id} className="text-sm text-foreground/80 leading-relaxed">
                  {chunk.content}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-medium text-muted">Sources:</span>
          {sources.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-surface border border-border rounded-full px-2.5 py-1">
              <a
                href={s.url?.includes("dra.gov.pk") ? "https://e.dra.gov.pk/public/price" : (s.url || "https://e.dra.gov.pk/public/price")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                title="Verify at DRAP Price Portal"
              >
                <span>{s.name}</span>
                <span className="text-[10px]"><AppIcon symbol="↗" /></span>
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
