"use client";

import { useEffect, useState } from "react";
import type { MedicineDetail } from "@/lib/types";
import type { Language } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { addToCabinet, removeFromCabinet, checkCabinetStatus } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface MedicineCardProps {
  medicine: MedicineDetail;
  onViewDetails: (id: string) => void;
  onViewPrices: (id: string) => void;
  language?: Language;
}

export default function MedicineCard({ medicine, onViewDetails, onViewPrices, language = "en" }: MedicineCardProps) {
  const icon = CATEGORY_ICONS[medicine.category] || "💊";
  const [inCabinet, setInCabinet] = useState(false);
  const [cabinetLoading, setCabinetLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      checkCabinetStatus(medicine.id)
        .then((res) => setInCabinet(res.in_cabinet))
        .catch(() => setInCabinet(false));
    }
  }, [medicine.id]);

  const toggleCabinet = async () => {
    if (!isLoggedIn()) {
      onViewDetails(medicine.id);
      return;
    }
    setCabinetLoading(true);
    try {
      if (inCabinet) {
        await removeFromCabinet(medicine.id);
        setInCabinet(false);
      } else {
        await addToCabinet(medicine.id);
        setInCabinet(true);
      }
    } catch (e) {
      console.error("Cabinet toggle error", e);
    } finally {
      setCabinetLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden group animate-fade-in card-hover">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary-light" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                {medicine.brand_name}
              </h3>
              <p className="text-sm text-muted">{medicine.generic_name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {medicine.strength}
            </span>
            <button
              onClick={toggleCabinet}
              disabled={cabinetLoading}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                inCabinet
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-surface border-border text-muted hover:text-foreground hover:border-primary/30"
              }`}
            >
              {inCabinet ? "✓ Saved" : "⭐ Save"}
            </button>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-background/50 rounded-xl p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.form")}</p>
            <p className="text-sm font-medium text-foreground">{medicine.dosage_form}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.category")}</p>
            <p className="text-sm font-medium text-foreground truncate">{medicine.category}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-2.5 col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-0.5">{t(language, "results.manufacturer")}</p>
            <p className="text-sm font-medium text-foreground">{medicine.manufacturer}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onViewDetails(medicine.id)}
            className="flex-1 bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
          >
            {t(language, "results.viewInfo")}
          </button>
          <button
            onClick={() => onViewPrices(medicine.id)}
            className="flex-1 bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium py-2.5 px-4 rounded-xl transition-all duration-200 border border-accent/20"
          >
            {t(language, "results.comparePrices")}
          </button>
        </div>
      </div>
    </div>
  );
}

