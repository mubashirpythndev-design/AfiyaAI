"use client";

import AppIcon from "@/components/shared/AppIcon";
import type { MedicineDetail, Language, SafetyAssessment } from "@/lib/types";
import { CATEGORY_ICONS, getCategoryDisplayName } from "@/lib/constants";
import { t } from "@/lib/i18n";
import SaveToCabinetButton from "./SaveToCabinetButton";

interface MedicineCardProps {
  medicine: MedicineDetail;
  onViewDetails: (id: string) => void;
  onViewPrices: (id: string) => void;
  language?: Language;
  safety?: SafetyAssessment | null;
  onAddToCart?: (id: string) => void;
}

export default function MedicineCard({
  medicine,
  onViewDetails,
  onViewPrices,
  language = "en",
  safety,
  onAddToCart,
}: MedicineCardProps) {
  const icon = CATEGORY_ICONS[medicine.category] || "💊";

  return (
    <div className="bg-surface rounded-2xl border border-border hover:border-primary/20 hover:shadow-xl  transition-all duration-300 overflow-hidden group animate-fade-in card-hover">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-surface   " />

      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-2xl shrink-0 mt-0.5"><AppIcon symbol={icon} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors whitespace-normal [overflow-wrap:anywhere]">
                {medicine.brand_name}
              </h3>
              <p className="text-xs sm:text-sm text-muted whitespace-normal [overflow-wrap:anywhere]">{medicine.generic_name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
            <div className="flex flex-1 min-w-0 items-center gap-1.5 flex-wrap">
              {safety?.drap_status && (
                <span
                  title={safety.drap_status.registration_number || undefined}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    safety.drap_status.is_verified
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  }`}
                >
                  {safety.drap_status.is_verified ? "Registration Verified" : "Verification Pending"}
                </span>
              )}
              {safety?.risk_tier && (
                <span
                  title={safety.risk_tier.advisory}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    safety.risk_tier.tier === 3
                      ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                      : safety.risk_tier.tier === 2
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20"
                  }`}
                >
                  {safety.risk_tier.tier === 3 ? "Rx Only" : safety.risk_tier.tier === 2 ? "Caution" : "OTC"}
                </span>
              )}
              <span className="text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary/10 text-primary">
                {medicine.strength}
              </span>
            </div>
            <SaveToCabinetButton
              medicineId={medicine.id}
              variant="compact"
              onRequireAuth={() => onViewDetails(medicine.id)}
            />
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
          <div className="bg-background/50 rounded-xl p-2 sm:p-2.5">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.form")}</p>
            <p className="text-xs sm:text-sm font-medium text-foreground [overflow-wrap:anywhere]">{medicine.dosage_form}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-2 sm:p-2.5">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.category")}</p>
            <p className="text-xs sm:text-sm font-medium text-foreground [overflow-wrap:anywhere]" title={medicine.category}>
              {getCategoryDisplayName(medicine.category, language)}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-2 sm:p-2.5 col-span-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.manufacturer")}</p>
              <p className="text-xs sm:text-sm font-medium text-foreground [overflow-wrap:anywhere]">{medicine.manufacturer}</p>
            </div>

          </div>
        </div>

        {/* Safety & Risk Advisory Note */}
        {safety?.risk_tier?.tier === 3 && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
            <span className="shrink-0 text-sm"><AppIcon symbol="⚕️" /></span>
            <span className="font-medium">
              {language === "ur" || language === "roman_ur"
                ? safety.risk_tier.advisory_urdu
                : safety.risk_tier.advisory}
            </span>
          </div>
        )}

        {onAddToCart && <button type="button" onClick={()=>onAddToCart(medicine.id)} className="w-full mb-3 rounded-xl border border-primary/30 text-primary py-2 text-sm font-semibold">+ Add to Cart</button>}
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onViewDetails(medicine.id)}
            className="flex-1 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-medium py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl transition-all duration-200 hover:shadow-md  text-center"
          >
            {t(language, "results.viewInfo")}
          </button>
          <button
            onClick={() => onViewPrices(medicine.id)}
            className="flex-1 bg-accent/10 hover:bg-accent/20 text-accent text-xs sm:text-sm font-medium py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl transition-all duration-200 border border-accent/20 text-center"
          >
            {t(language, "results.comparePrices")}
          </button>
        </div>
      </div>
    </div>
  );
}

