"use client";

import { useState } from "react";
import type { Language, MedicineDetail, PriceEntry } from "@/lib/types";

interface QuantityCalculatorProps {
  medicine: MedicineDetail;
  prices: PriceEntry[];
  language?: Language;
  onSelectCalculatedPrice?: (price: number, label: string) => void;
}

export function parsePackInfo(packageSize: string, dosageForm: string): {
  strips: number;
  unitsPerStrip: number;
  totalUnits: number;
  unitName: string;
} {
  const formLower = (dosageForm || "").toLowerCase();
  const isTabletOrCap =
    formLower.includes("tablet") ||
    formLower.includes("capsule") ||
    formLower.includes("tab") ||
    formLower.includes("cap");
  const unitName = formLower.includes("capsule")
    ? "Capsules"
    : formLower.includes("inhaler")
    ? "Doses"
    : formLower.includes("suspension") || formLower.includes("syrup")
    ? "ml"
    : isTabletOrCap
    ? "Tablets"
    : "Units";

  const packMatch = packageSize.match(/(\d+)\s*x\s*(\d+)/i);
  if (packMatch) {
    const strips = parseInt(packMatch[1], 10) || 1;
    const unitsPerStrip = parseInt(packMatch[2], 10) || 10;
    return {
      strips,
      unitsPerStrip,
      totalUnits: strips * unitsPerStrip,
      unitName,
    };
  }

  const dosesMatch = packageSize.match(/(\d+)\s*(?:doses|puffs|units|tabs|tablets|capsules)/i);
  if (dosesMatch) {
    const total = parseInt(dosesMatch[1], 10) || 1;
    return {
      strips: 1,
      unitsPerStrip: total,
      totalUnits: total,
      unitName,
    };
  }

  return {
    strips: 1,
    unitsPerStrip: isTabletOrCap ? 10 : 1,
    totalUnits: isTabletOrCap ? 10 : 1,
    unitName,
  };
}

export default function QuantityCalculator({
  medicine,
  prices,
  language = "en",
  onSelectCalculatedPrice,
}: QuantityCalculatorProps) {
  const baseEntry = prices[0] || { price: 0, package_size: "1x10's" };
  const packInfo = parsePackInfo(baseEntry.package_size, medicine.dosage_form);

  const [unitMode, setUnitMode] = useState<"strip" | "unit" | "box">("strip");
  const [quantity, setQuantity] = useState<number>(1);

  // Price calculations based on authoritative DRAP base price
  const basePackPrice = baseEntry.price;
  const pricePerUnit =
    packInfo.totalUnits > 0 ? basePackPrice / packInfo.totalUnits : basePackPrice;
  const pricePerStrip =
    packInfo.strips > 0 ? basePackPrice / packInfo.strips : basePackPrice;
  // Standard box is usually full pack size or 10 strips for 1x10s
  const boxStrips = packInfo.strips === 1 && packInfo.unitsPerStrip === 10 ? 10 : packInfo.strips;
  const pricePerBox = pricePerStrip * boxStrips;

  let calculatedPrice = 0;
  let summaryLabel = "";

  if (unitMode === "strip") {
    calculatedPrice = quantity * pricePerStrip;
    const totalTablets = quantity * packInfo.unitsPerStrip;
    summaryLabel = `${quantity} Strip${quantity > 1 ? "s" : ""} (${totalTablets} ${packInfo.unitName})`;
  } else if (unitMode === "unit") {
    calculatedPrice = quantity * pricePerUnit;
    summaryLabel = `${quantity} ${packInfo.unitName}`;
  } else if (unitMode === "box") {
    calculatedPrice = quantity * pricePerBox;
    const totalStrips = quantity * boxStrips;
    summaryLabel = `${quantity} Full Box${quantity > 1 ? "es" : ""} (${totalStrips} Strips)`;
  }

  const handleQtyChange = (val: number) => {
    if (val >= 1 && val <= 1000) {
      setQuantity(val);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden mt-6">
      <div className="px-4 py-3 bg-surface-hover border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Quantity & Pack Price Calculator
            </h3>
            <p className="text-xs text-muted">
              Calculate exact verified prices for strips, boxes, or custom units
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
          DRAP Verified Rates
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode selector: Strips | Tablets | Full Box */}
        <div>
          <label className="block text-xs font-medium text-muted mb-2">
            Select Purchase Unit Type:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setUnitMode("strip");
                setQuantity(1);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                unitMode === "strip"
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-background hover:bg-surface-hover text-foreground border-border"
              }`}
            >
              💊 By Strip ({packInfo.unitsPerStrip} {packInfo.unitName})
            </button>
            <button
              type="button"
              onClick={() => {
                setUnitMode("unit");
                setQuantity(packInfo.unitsPerStrip || 1);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                unitMode === "unit"
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-background hover:bg-surface-hover text-foreground border-border"
              }`}
            >
              🔢 Individual {packInfo.unitName}
            </button>
            <button
              type="button"
              onClick={() => {
                setUnitMode("box");
                setQuantity(1);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                unitMode === "box"
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-background hover:bg-surface-hover text-foreground border-border"
              }`}
            >
              📦 Full Box / Pack
            </button>
          </div>
        </div>

        {/* Quantity Controls & Quick Presets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted">
              Select Quantity:
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    quantity === num
                      ? "bg-primary/20 text-primary border-primary/40 font-bold"
                      : "bg-background text-muted hover:text-foreground border-border"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleQtyChange(quantity - 1)}
              disabled={quantity <= 1}
              className="w-10 h-10 rounded-xl bg-surface-hover border border-border flex items-center justify-center font-bold text-foreground hover:bg-border transition-colors disabled:opacity-30"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              max="1000"
              value={quantity}
              onChange={(e) => handleQtyChange(parseInt(e.target.value, 10) || 1)}
              className="w-24 text-center bg-background border border-border rounded-xl py-2 font-bold text-sm text-foreground focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => handleQtyChange(quantity + 1)}
              className="w-10 h-10 rounded-xl bg-surface-hover border border-border flex items-center justify-center font-bold text-foreground hover:bg-border transition-colors"
            >
              +
            </button>
            <span className="text-xs font-medium text-muted">
              {unitMode === "strip"
                ? `Strip${quantity > 1 ? "s" : ""}`
                : unitMode === "box"
                ? `Box${quantity > 1 ? "es" : ""}`
                : packInfo.unitName}
            </span>
          </div>
        </div>

        {/* Calculated Result Card */}
        <div className="bg-gradient-to-r from-success/10 to-primary/10 border border-success/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
              Total Official DRAP Price
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-success">
                Rs. {calculatedPrice.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-muted">
                for {summaryLabel}
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Rate Breakdown: Rs. {pricePerStrip.toFixed(2)} / strip &bull; Rs.{" "}
              {pricePerUnit.toFixed(2)} / {packInfo.unitName.slice(0, -1)}
            </p>
          </div>

          {onSelectCalculatedPrice && (
            <button
              type="button"
              onClick={() => onSelectCalculatedPrice(calculatedPrice, summaryLabel)}
              className="bg-primary hover:bg-primary-dark text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors whitespace-nowrap shadow-sm"
            >
              Verify This in MRP Checker &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
