"use client";

import AppIcon from "@/components/shared/AppIcon";
import { useState } from "react";
import { checkPrice } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Language, MedicineDetail, PriceCheckResponse } from "@/lib/types";
import { parsePackInfo } from "./QuantityCalculator";

interface MrpCheckerProps {
  /** The medicine already resolved on screen (spec-04 verified match). */
  medicine: MedicineDetail;
  language: Language;
  packSize?: string;
}

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

export default function MrpChecker({ medicine, language, packSize = "" }: MrpCheckerProps) {
  const [priceInput, setPriceInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceCheckResponse | null>(null);

  // Custom Quantity & Unit State
  const [unitMode, setUnitMode] = useState<"strip" | "unit" | "box">("strip");
  const [qty, setQty] = useState<number>(1);
  const [customCalculation, setCustomCalculation] = useState<{
    status: "BELOW_MRP" | "OK_AT_MRP" | "OVERCHARGED";
    pricePaid: number;
    expectedMrp: number;
    diff: number;
    diffPercent: number;
    quantityLabel: string;
    ratePerUnit: number;
    ratePerStrip: number;
  } | null>(null);

  // Parse package dimensions from medicine
  const packInfo = parsePackInfo(result?.pack_size || packSize, medicine.dosage_form);

  const invalidateResult = () => { setCustomCalculation(null); setResult(null); setRequestError(null); };

  const runCheck = async (query: string) => {
    const parsed = Number(priceInput);
    if (!priceInput.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setValidationError(t(language, "mrp.invalidPrice"));
      invalidateResult();
      return;
    }
    if (loading) return;
    setValidationError(null);
    setRequestError(null);
    setLoading(true);
    setCustomCalculation(null);
    setResult(null);

    try {
      // 1. Fetch official baseline MRP from backend API
      const resp = await checkPrice({
        medicine_query: query,
        pack_size: packSize || undefined,
        price_paid: parsed,
        lang: language,
      });
      setResult(resp);

      // 2. If user selected custom quantity (e.g. 2 strips, 5 tabs, 1 box),
      // calculate the exact proportional MRP and status for that selection.
      const packInfo = parsePackInfo(resp.pack_size || "", medicine.dosage_form);
      if (resp.mrp !== null && packInfo.totalUnits > 0 && !resp.needs_confirmation) {
        const basePackMrp = resp.mrp;
        const pricePerUnit =
          packInfo.totalUnits > 0 ? basePackMrp / packInfo.totalUnits : basePackMrp;
        const pricePerStrip =
          packInfo.strips > 0 ? basePackMrp / packInfo.strips : basePackMrp;
        const boxStrips =
          packInfo.strips;
        const pricePerBox = pricePerStrip * boxStrips;

        let expectedMrp = 0;
        let quantityLabel = "";

        if (unitMode === "strip") {
          expectedMrp = qty * pricePerStrip;
          const totalTabs = qty * packInfo.unitsPerStrip;
          quantityLabel = `${qty} Strip${qty > 1 ? "s" : ""} (${totalTabs} ${packInfo.unitName})`;
        } else if (unitMode === "unit") {
          expectedMrp = qty * pricePerUnit;
          quantityLabel = `${qty} ${packInfo.unitName}`;
        } else if (unitMode === "box") {
          expectedMrp = qty * pricePerBox;
          const totalStrips = qty * boxStrips;
          quantityLabel = `${qty} Full Box${qty > 1 ? "es" : ""} (${totalStrips} Strips)`;
        }

        const diff = Math.abs(parsed - expectedMrp);
        const diffPercent = expectedMrp > 0 ? (diff / expectedMrp) * 100 : 0;

        let status: "BELOW_MRP" | "OK_AT_MRP" | "OVERCHARGED" = "OK_AT_MRP";
        if (parsed > expectedMrp + 0.05) {
          status = "OVERCHARGED";
        } else if (parsed < expectedMrp - 0.05) {
          status = "BELOW_MRP";
        }

        setCustomCalculation({
          status,
          pricePaid: parsed,
          expectedMrp: Math.round(expectedMrp * 100) / 100,
          diff: Math.round(diff * 100) / 100,
          diffPercent: Math.round(diffPercent * 10) / 10,
          quantityLabel,
          ratePerUnit: Math.round(pricePerUnit * 100) / 100,
          ratePerStrip: Math.round(pricePerStrip * 100) / 100,
        });
      }
    } catch {
      setRequestError(t(language, "mrp.error"));
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = customCalculation?.status || result?.status || "NO_DATA";
  const tone = STATUS_TONE[currentStatus] || FALLBACK_TONE;

  return (
    <div className="animate-slide-up mt-6">
      <div className="bg-surface rounded-2xl border-2 border-primary/20 shadow-lg  overflow-hidden">
        {/* Header - High Visibility */}
        <div className="px-4 sm:px-5 py-4 bg-surface border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md  shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {t(language, "mrp.title")}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-success/15 text-success border border-success/30 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  {result?.statutory_verified ? "Statutory source verified" : "Source verification pending"}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-foreground/90 mt-0.5 flex items-center gap-1.5">
                <span className="text-primary font-extrabold text-sm"><AppIcon symbol="💡" /> Check what you paid:</span>
                <span className="text-foreground/80">{t(language, "mrp.subtitle")}</span>
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-xs font-bold bg-primary text-white shadow-sm px-3 py-1 rounded-xl">
            Overcharge Checker
          </span>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {/* Purchase Unit & Quantity Selector */}
          <div className="bg-background/80 rounded-xl p-3.5 border border-border/90 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                1. Select what quantity/unit you purchased:
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { invalidateResult(); setUnitMode("strip"); setQty(1); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all shadow-sm ${
                    unitMode === "strip"
                      ? "bg-primary text-white border-primary  scale-105"
                      : "bg-surface text-foreground/70 hover:text-foreground border-border hover:bg-surface-hover"
                  }`}
                >
                  <AppIcon symbol="💊" /> Strips
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { invalidateResult(); setUnitMode("unit"); setQty(packInfo.unitsPerStrip || 1); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all shadow-sm ${
                    unitMode === "unit"
                      ? "bg-primary text-white border-primary  scale-105"
                      : "bg-surface text-foreground/70 hover:text-foreground border-border hover:bg-surface-hover"
                  }`}
                >
                  <AppIcon symbol="🔢" /> {packInfo.unitName}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { invalidateResult(); setUnitMode("box"); setQty(1); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all shadow-sm ${
                    unitMode === "box"
                      ? "bg-primary text-white border-primary  scale-105"
                      : "bg-surface text-foreground/70 hover:text-foreground border-border hover:bg-surface-hover"
                  }`}
                >
                  <AppIcon symbol="📦" /> Full Box
                </button>
              </div>
            </div>

            {/* Quantity Counter */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-bold text-foreground">Quantity:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { invalidateResult(); if (qty > 1) setQty(qty - 1); }}
                  disabled={loading || qty <= 1}
                  className="w-8 h-8 rounded-lg bg-surface-hover border border-border flex items-center justify-center font-extrabold text-sm hover:bg-border transition-colors disabled:opacity-30 text-foreground"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={qty}
                  aria-label="Purchased quantity"
                  disabled={loading}
                  onChange={(e) => { invalidateResult(); setQty(Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 1))); }}
                  className="w-16 text-center bg-surface border-2 border-primary/30 rounded-lg py-1 text-sm font-bold text-foreground focus:outline-none focus:border-primary shadow-inner"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { invalidateResult(); setQty(Math.min(500, qty + 1)); }}
                  className="w-8 h-8 rounded-lg bg-surface-hover border border-border flex items-center justify-center font-extrabold text-sm hover:bg-border transition-colors text-foreground"
                >
                  +
                </button>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                {unitMode === "strip"
                  ? packInfo.totalUnits > 0 ? `${qty} Strip${qty > 1 ? "s" : ""} (${qty * packInfo.unitsPerStrip} ${packInfo.unitName})` : `${qty} Strip${qty > 1 ? "s" : ""} (pack size unavailable)`
                  : unitMode === "box"
                  ? `${qty} Full Box${qty > 1 ? "es" : ""}`
                  : `${qty} ${packInfo.unitName}`}
              </span>
            </div>
          </div>

          {/* Input + button */}
          <div className="bg-primary/[0.04] p-4 rounded-xl border border-primary/15 space-y-2">
            <label htmlFor="mrp-price-input" className="block text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              2. Enter the price you paid at the pharmacy (PKR):
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  id="mrp-price-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => {
                    invalidateResult();
                    setPriceInput(e.target.value);
                    setValidationError(null);
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    runCheck(`${medicine.brand_name} ${medicine.strength}`)
                  }
                  placeholder="e.g. 72.00, 145.40, 610.00"
                  disabled={loading}
                  className="w-full bg-surface border-2 border-border focus:border-primary rounded-xl px-4 py-3 text-base font-bold text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all shadow-sm"
                />
              </div>
              <div className="sm:self-end">
                <button
                  onClick={() => runCheck(`${medicine.brand_name} ${medicine.strength}`)}
                  disabled={loading}
                  className="w-full sm:w-auto bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:shadow-lg "
                >
                  {loading ? t(language, "mrp.checking") : t(language, "mrp.checkBtn")}
                </button>
              </div>
            </div>
          </div>

          {/* Local validation */}
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

          {result && !customCalculation && !loading && <p className="text-sm text-muted">{result.message} {result.disclaimer}</p>}
          {/* Result Card */}
          {customCalculation && !loading && (
            <div className={`rounded-xl border ${tone.border} p-4 space-y-3`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${tone.badgeBg} flex items-center justify-center shrink-0`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tone.badgeText}>
                    <path d={tone.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  {/* Status badge */}
                  <span className={`inline-block text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${tone.badgeBg} ${tone.badgeText} mb-1`}>
                    {customCalculation.status === "BELOW_MRP"
                      ? "BELOW REFERENCE"
                      : customCalculation.status === "OK_AT_MRP"
                      ? "AT REFERENCE"
                      : "ABOVE REFERENCE"}
                  </span>

                  <p className="text-sm font-semibold text-foreground">
                    {medicine.brand_name} {medicine.strength} ({medicine.generic_name})
                  </p>

                  {/* Verdict Message */}
                  <p className="text-sm text-foreground/90 mt-1 leading-relaxed">
                    {customCalculation.status === "BELOW_MRP" && (
                      <>Good news! You paid <strong className="text-success">Rs. {customCalculation.diff.toFixed(2)} LESS</strong> ({customCalculation.diffPercent}% discount) than the stored reference price of <strong>Rs. {customCalculation.expectedMrp.toFixed(2)}</strong> for {customCalculation.quantityLabel}.</>
                    )}
                    {customCalculation.status === "OK_AT_MRP" && (
                      <>You paid approximately the stored reference price baseline of <strong className="text-success">Rs. {customCalculation.expectedMrp.toFixed(2)}</strong> for {customCalculation.quantityLabel}.</>
                    )}
                    {customCalculation.status === "OVERCHARGED" && (
                      <>Notice: You paid <strong className="text-danger">Rs. {customCalculation.diff.toFixed(2)} MORE</strong> (+{customCalculation.diffPercent}%) above the stored reference price baseline of <strong>Rs. {customCalculation.expectedMrp.toFixed(2)}</strong> for {customCalculation.quantityLabel}.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Facts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                  <p className="text-muted mb-0.5">Price Paid</p>
                  <p className="font-bold text-foreground">
                    Rs. {customCalculation.pricePaid.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                  <p className="text-muted mb-0.5">stored reference price</p>
                  <p className="font-bold text-foreground">
                    Rs. {customCalculation.expectedMrp.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                  <p className="text-muted mb-0.5">Rate / Unit</p>
                  <p className="font-semibold text-foreground">
                    Rs. {customCalculation.ratePerUnit.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                  <p className="text-muted mb-0.5">Rate / Strip</p>
                  <p className="font-semibold text-foreground">
                    Rs. {customCalculation.ratePerStrip.toFixed(2)}/strip
                  </p>
                </div>
              </div>

              {/* Provenance source */}
              <div className="flex items-center justify-between text-xs text-muted pt-1">
                <span>Compared with stored dataset reference</span>
                <a
                  href="https://e.dra.gov.pk/public/price"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  DRAP Portal &rarr;
                </a>
              </div>

              {/* Mandatory disclaimer */}
              <p className="text-[11px] text-muted border-t border-border/60 pt-2 leading-relaxed">
                These are stored reference prices. Official statutory enforcement requires a published Statutory Regulatory Order (SRO) gazette reference. Always verify with official DRAP publications.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
