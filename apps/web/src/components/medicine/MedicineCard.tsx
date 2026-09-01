"use client";

import type { MedicineDetail } from "@/lib/types";
import type { Language } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/constants";
import { t } from "@/lib/i18n";
import SaveToCabinetButton from "./SaveToCabinetButton";

interface MedicineCardProps {
  medicine: MedicineDetail;
  onViewDetails: (id: string) => void;
  onViewPrices: (id: string) => void;
  language?: Language;
}

export default function MedicineCard({ medicine, onViewDetails, onViewPrices, language = "en" }: MedicineCardProps) {
  const icon = CATEGORY_ICONS[medicine.category] || "💊";

  return (
    <div className="bg-surface rounded-2xl border border-border hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden group animate-fade-in card-hover">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary-light" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-2xl shrink-0 mt-0.5">{icon}</span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                {medicine.brand_name}
              </h3>
              <p className="text-xs sm:text-sm text-muted truncate">{medicine.generic_name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20">
                ✓ Available
              </span>
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
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <div className="bg-background/50 rounded-xl p-2 sm:p-2.5">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.form")}</p>
            <p className="text-xs sm:text-sm font-medium text-foreground truncate">{medicine.dosage_form}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-2 sm:p-2.5">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.category")}</p>
            <p className="text-xs sm:text-sm font-medium text-foreground truncate">{medicine.category}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-2 sm:p-2.5 col-span-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.manufacturer")}</p>
              <p className="text-xs sm:text-sm font-medium text-foreground truncate">{medicine.manufacturer}</p>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg shrink-0">
              ⚖️ 3 Brands
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onViewDetails(medicine.id)}
            className="flex-1 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-medium py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-primary/20 text-center"
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

