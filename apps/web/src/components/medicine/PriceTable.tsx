"use client";

import type { PriceComparison, CheapestBrands } from "@/lib/types";
import QuantityCalculator from "./QuantityCalculator";
import {AddToCartButton} from "@/components/marketplace/StoreCatalog";

interface PriceTableProps {
  comparison: PriceComparison;
  cheapestBrands?: CheapestBrands | null;
  onSelectBrand?: (medicineId: string) => void;
  onSelectCalculatedPrice?: (price: number, label: string) => void;
  switchingId?: string | null;
}

export default function PriceTable({
  comparison,
  cheapestBrands,
  onSelectBrand,
  onSelectCalculatedPrice,
  switchingId,
}: PriceTableProps) {
  const { medicine, prices, lowest_price, highest_price, savings } = comparison;
  const sorted = [...prices].sort((a, b) => a.price - b.price);

  const hasAlternativeBrands =
    !!cheapestBrands && cheapestBrands.options && cheapestBrands.options.length > 1;

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex justify-end"><AddToCartButton medicineId={medicine.id}/></div>
      {/* 1. Multi-Brand Bioequivalent Price Comparison Matrix (if multiple brands exist) */}
      {hasAlternativeBrands && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-surface via-primary/[0.03] to-accent/[0.03] border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-success/10 text-success flex items-center justify-center font-bold text-sm">
                ⚖️
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Multi-Brand Price Comparison: {cheapestBrands.generic} ({cheapestBrands.strength})
                </h3>
                <p className="text-[11px] text-muted">
                  Comparing {cheapestBrands.options.length} DRAP-registered bioequivalent brands in Pakistan
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 shrink-0 self-start sm:self-auto">
              Sorted Lowest to Highest
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-surface-hover/80 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-border">
                  <th className="text-left px-3.5 sm:px-4 py-2.5">Brand & Manufacturer</th>
                  <th className="text-right px-3.5 sm:px-4 py-2.5">Pack Price</th>
                  <th className="text-right px-3.5 sm:px-4 py-2.5">Per Unit (Tablet/Dose)</th>
                  <th className="text-center px-3.5 sm:px-4 py-2.5">Savings</th>
                  <th className="text-center px-3.5 sm:px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cheapestBrands.options.map((opt, idx) => {
                  const isActive = opt.medicine_id === medicine.id;
                  const isCheapest = idx === 0;
                  const isSwitchingThis = switchingId === opt.medicine_id;
                  const saving = opt.saving_percent_vs_queried;

                  return (
                    <tr
                      key={opt.medicine_id}
                      onClick={() => onSelectBrand && onSelectBrand(opt.medicine_id)}
                      className={`transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary/10 font-medium"
                          : isCheapest
                          ? "bg-success/5 hover:bg-success/10"
                          : "hover:bg-surface-hover"
                      }`}
                    >
                      <td className="px-3.5 sm:px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">{opt.brand_name}</span>
                          {isCheapest && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-success text-white">
                              🌟 Sab se Sasta
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-white">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">{opt.manufacturer}</p>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 text-right">
                        <div className="font-bold text-foreground">Rs. {opt.price.toFixed(2)}</div>
                        <span className="text-[10px] text-muted">{opt.package_size}</span>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 text-right">
                        <span className={`font-extrabold ${isCheapest ? "text-success" : "text-foreground"}`}>
                          Rs. {opt.per_unit.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted"> / unit</span>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 text-center">
                        {saving > 0 ? (
                          <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-md border border-success/20">
                            Save {saving.toFixed(0)}%
                          </span>
                        ) : saving < 0 ? (
                          <span className="text-xs font-semibold text-danger">
                            +{Math.abs(saving).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <AddToCartButton medicineId={opt.medicine_id}/>
                        <button
                          type="button"
                          onClick={() => onSelectBrand && onSelectBrand(opt.medicine_id)}
                          disabled={isSwitchingThis}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-primary text-white shadow-sm ring-1 ring-primary/50"
                              : "bg-surface hover:bg-primary hover:text-white text-muted hover:border-primary border border-border"
                          }`}
                        >
                          {isSwitchingThis ? "Loading..." : isActive ? "✓ Active" : "Select Brand"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Active Selected Medicine Price & Verification Details */}
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Official Price Data: {medicine.brand_name} ({medicine.strength})
              </h3>
              <p className="text-xs text-muted">Manufacturer: {medicine.manufacturer || "Verified Pharmaceutical"}</p>
            </div>
          </div>

          <a
            href="https://e.dra.gov.pk/public/price"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-dark inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20 transition-all"
            title="Verify Official Price at DRAP Public Price Portal"
          >
            <span>Official DRAP Portal ↗</span>
          </a>
        </div>

        {/* Price entries table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-surface-hover">
                <th className="text-left px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-muted uppercase tracking-wider">Source</th>
                <th className="text-right px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-muted uppercase tracking-wider">Official Price</th>
                <th className="text-right px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">Package</th>
                <th className="text-right px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Verified Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((entry, i) => (
                <tr key={entry.id} className={`hover:bg-surface-hover transition-colors ${i === 0 ? "bg-success/5" : ""}`}>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                      <span className="font-medium text-foreground">{entry.source.name}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">
                    <span className="font-bold text-success">
                      Rs. {entry.price.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-muted hidden sm:table-cell">{entry.package_size}</td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-muted hidden md:table-cell">{entry.collected_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Custom Quantity, Strip, Box Calculator calibrated for active medicine */}
        <QuantityCalculator
          medicine={medicine}
          prices={prices}
          onSelectCalculatedPrice={onSelectCalculatedPrice}
        />
      </div>
    </div>
  );
}

