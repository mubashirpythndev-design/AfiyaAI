"use client";

import { useEffect, useId, useState } from "react";
import { quantityPrices } from "@/lib/cabinetPrices";
import { updateCabinetReminder } from "@/lib/api";
import type { CabinetItem, CabinetQuantityOption, Language } from "@/lib/types";

type Props = { item: CabinetItem; language: Language; onSaved: () => Promise<void>; onPreview: (units: number | null | undefined) => void };
const LABELS: Record<CabinetQuantityOption["unit"], [string, string, string]> = {
  tablet: ["Tablets", "گولیاں", "Goliyan"],
  capsule: ["Capsules", "کیپسول", "Capsules"],
  dose: ["Doses", "ڈوز", "Doses"],
  unit: ["Units", "یونٹس", "Units"],
  strip: ["Strips", "سٹرپس", "Strips"],
  pack: ["Packs", "پیک", "Packs"],
};
export default function CabinetQuantity({ item, language, onSaved, onPreview }: Props) {
  const id = useId();
  const options = item.quantity_options ?? [];
  const base = options[0];
  const saved = options.find(o => o.unit === item.monthly_quantity_unit);
  const initialUnit = saved?.unit ?? base?.unit ?? "unit";
  const initialQuantity = saved ? item.monthly_quantity : item.monthly_units;
  const [unit, setUnit] = useState<CabinetQuantityOption["unit"]>(initialUnit);
  const [quantity, setQuantity] = useState(String(initialQuantity ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  useEffect(() => {
    setUnit(initialUnit);
    setQuantity(String(initialQuantity ?? ""));
  }, [initialUnit, initialQuantity]);
  const langIndex = language === "ur" ? 1 : language === "roman_ur" ? 2 : 0;
  const text = (en: string, ur: string, roman: string) => [en, ur, roman][langIndex];
  const label = (value: CabinetQuantityOption["unit"]) => LABELS[value][langIndex];
  const choice = options.find(o => o.unit === unit);
  const count = quantity.trim() ? Number(quantity) : null;
  const units = count !== null && choice ? count * choice.units_per_quantity : null;
  const invalid = count !== null && (!Number.isInteger(count) || count < 1 || units === null || units > 100000);
  const packChanged = Boolean(saved && item.monthly_quantity != null && item.monthly_quantity * saved.units_per_quantity !== item.monthly_units);
  const dirty = quantity !== String(initialQuantity ?? "") || unit !== initialUnit || packChanged;
  const prices = quantityPrices(invalid ? null : units, item.pricing);
  const money = (value: number) => "PKR " + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = (value: string, selectedUnit: CabinetQuantityOption["unit"]) => {
    setQuantity(value); setUnit(selectedUnit); setSavedMessage(false); setError(null);
    const count = value.trim() ? Number(value) : null;
    const option = options.find(o => o.unit === selectedUnit);
    const normalized = count !== null && option ? count * option.units_per_quantity : null;
    if (!packChanged && value === String(initialQuantity ?? "") && selectedUnit === initialUnit) onPreview(undefined);
    else onPreview(count !== null && Number.isInteger(count) && count > 0 && normalized !== null && normalized <= 100000 ? normalized : null);
  };
  const save = async () => {
    if (busy || invalid || !choice) return;
    setBusy(true); setError(null); setSavedMessage(false);
    try {
      await updateCabinetReminder(item.medicine_id, { monthly_quantity: count, monthly_quantity_unit: count === null ? null : unit });
      await onSaved();
      setSavedMessage(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : text("Could not save monthly quantity.", "ماہانہ مقدار محفوظ نہیں ہو سکی۔", "Mahana miqdaar save nahi hui."));
    } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-2" dir={language === "ur" ? "rtl" : undefined}>
      <label htmlFor={id + "-quantity"} className="block text-xs font-semibold text-foreground">
        {text("Monthly quantity", "ماہانہ مقدار", "Mahana miqdaar")}
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <input id={id + "-quantity"} type="number" min="1" max={choice ? Math.floor(100000 / choice.units_per_quantity) : 100000} step="1"
          value={quantity} disabled={busy} aria-invalid={invalid} aria-describedby={id + "-help"}
          onChange={e => change(e.target.value, unit)}
          placeholder={text("Quantity", "مقدار", "Miqdaar")}
          className="w-24 rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
        <div className="flex-1 min-w-32">
          <label htmlFor={id + "-unit"} className="sr-only">{text("Quantity unit", "مقدار کی اکائی", "Miqdaar ki unit")}</label>
          <select id={id + "-unit"} value={unit} disabled={busy || !options.length}
            onChange={e => change(quantity, e.target.value as CabinetQuantityOption["unit"])}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:border-primary disabled:opacity-50">
            {options.map(o => <option key={o.unit} value={o.unit}>{label(o.unit)}{o.units_per_quantity > 1 && base ? " (" + o.units_per_quantity + " " + label(base.unit) + ")" : ""}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => { void save(); }} disabled={busy || invalid || !dirty || !choice}
          className="rounded-lg bg-primary text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-primary-dark">
          {busy ? text("Saving…", "محفوظ ہو رہا ہے…", "Save ho raha hai…") : text("Save quantity", "مقدار محفوظ کریں", "Miqdaar save karein")}
        </button>
      </div>
      <p id={id + "-help"} className="text-xs text-muted">
        {invalid ? text("Enter a positive whole quantity, up to 100,000 individual units.", "مثبت مکمل مقدار درج کریں، زیادہ سے زیادہ ۱۰۰۰۰۰ انفرادی یونٹس۔", "Positive poori miqdaar dein, zyada se zyada 100000 individual units.")
        : units !== null && base ? quantity + " " + label(unit) + " = " + units.toLocaleString() + " " + label(base.unit) + " / " + text("month", "ماہ", "mahina")
        : text("Enter the monthly quantity from your prescribed schedule; this does not set a dosage.", "نسخے کے شیڈول کے مطابق ماہانہ مقدار درج کریں؛ یہ خوراک مقرر نہیں کرتا۔", "Nuskhe ke schedule ke mutabiq mahana miqdaar dein; yeh dose set nahi karta.")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-live="polite">
        <div className="rounded-lg border border-primary/25 bg-primary/10 p-3">
          <p className="text-[11px] text-muted">{text("Price for selected quantity", "منتخب مقدار کی قیمت", "Selected miqdaar ki qeemat")}{dirty ? " · " + text("Preview", "تخمینہ", "Preview") : ""}</p>
          <p className="text-lg font-bold text-primary">{prices ? money(prices.proportionalCost) : "—"}</p>
          {prices && <p className="text-[11px] text-muted">{quantity} {label(unit)}</p>}
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] text-muted">{text("Whole packs needed · budget cost", "درکار مکمل پیک · بجٹ", "Poore packs ka budget")}</p>
          <p className="text-lg font-bold text-foreground">{prices ? money(prices.wholePackCost) : "—"}</p>
          {prices && <p className="text-[11px] text-muted">{prices.packs} {label("pack")}</p>}
        </div>
      </div>
      <p className="text-[11px] text-muted">
        {prices ? text("Selected quantity uses the stored pack rate proportionally. Budget covers whole packs; pharmacy loose-unit prices may differ.", "منتخب مقدار کی قیمت محفوظ پیک کی شرح سے نکلتی ہے۔ بجٹ مکمل پیک کا ہے؛ کھلی گولیوں کی قیمت مختلف ہو سکتی ہے۔", "Selected miqdaar ki qeemat stored pack rate se hai. Budget poore packs ka hai; pharmacy ki loose-unit qeemat mukhtalif ho sakti hai.") : text("Select a valid quantity. A stored price and known pack size are required to calculate its cost.", "درست مقدار منتخب کریں۔ قیمت کے لیے محفوظ شرح اور معلوم پیک سائز ضروری ہے۔", "Valid miqdaar select karein. Qeemat ke liye stored rate aur known pack size zaroori hai.")}
      </p>
      <p className="text-[11px] text-muted">
        {item.package_size ? text("Stored pack size: ", "محفوظ پیک سائز: ", "Stored pack size: ") + item.package_size : text("Pack size unavailable; strips and packs cannot be converted.", "پیک سائز دستیاب نہیں؛ سٹرپس اور پیک تبدیل نہیں کیے جا سکتے۔", "Pack size nahi mila; strips aur packs convert nahi ho sakte.")}
      </p>
      {packChanged && <p className="text-xs text-warning">{text("Pack details changed. Review the conversion and save to confirm your monthly quantity.", "پیک کی تفصیل بدل گئی ہے۔ تبدیلی دیکھ کر ماہانہ مقدار دوبارہ محفوظ کریں۔", "Pack details badal gayi hain. Conversion check karke mahana miqdaar dobara save karein.")}</p>}
      {(error || savedMessage) && <p role="status" className={"text-xs " + (error ? "text-danger" : "text-success")}>{error ?? text("Monthly quantity saved.", "ماہانہ مقدار محفوظ ہو گئی۔", "Mahana miqdaar save ho gayi.")}</p>}
    </div>
  );
}
