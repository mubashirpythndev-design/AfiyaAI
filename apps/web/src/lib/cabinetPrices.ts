import type { CabinetItem, CabinetPricing } from "./types";

export function quantityPrices(units: number | null, pricing?: CabinetPricing | null) {
  if (units === null || !Number.isInteger(units) || units < 1 || units > 100000 || !pricing) return null;
  const { pack_price_paisa: price, units_per_pack: packUnits } = pricing.current;
  if (!Number.isInteger(packUnits) || packUnits < 1 || !Number.isInteger(price) || price < 0) return null;
  const packs = Math.ceil(units / packUnits);
  return {
    proportionalCost: Math.round(units * price / packUnits) / 100,
    wholePackCost: packs * price / 100,
    packs,
    perUnitCost: price / packUnits / 100,
  };
}

export function previewCabinetBudget(items: CabinetItem[], drafts: Record<string, number | null>) {
  let costPaisa = 0;
  let savingsPaisa = 0;
  for (const item of items) {
    const units = Object.prototype.hasOwnProperty.call(drafts, item.medicine_id) ? drafts[item.medicine_id] : item.monthly_units ?? null;
    const prices = quantityPrices(units, item.pricing);
    if (!prices || units === null || !item.pricing?.comparison_available) return null;
    const currentCost = Math.round(prices.wholePackCost * 100);
    const alternatives = item.pricing.alternatives.filter(o => o.units_per_pack > 0 && o.pack_price_paisa >= 0);
    if (!alternatives.length) return null;
    const cheapestCost = Math.min(currentCost, ...alternatives.map(o => Math.ceil(units / o.units_per_pack) * o.pack_price_paisa));
    costPaisa += currentCost;
    savingsPaisa += currentCost - cheapestCost;
  }
  return { monthly_cost: costPaisa / 100, monthly_savings: savingsPaisa / 100, annual_savings: savingsPaisa * 12 / 100 };
}
