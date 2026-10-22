import type {StoreCatalogItem} from "./api";

export type CatalogFilters = {query: string; category: string; prescription: string; availableOnly: boolean; sort: string};
export function catalogCategories(items: StoreCatalogItem[]): string[] {
  return [...new Set(items.map(item => item.category?.trim()).filter((value): value is string => !!value))].sort((a,b) => a.localeCompare(b));
}
export function filterCatalog(items: StoreCatalogItem[], filters: CatalogFilters): StoreCatalogItem[] {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = items.filter(item => {
    const haystack = `${item.brand_name} ${item.generic_name} ${item.strength} ${item.dosage_form} ${item.category ?? ""}`.toLocaleLowerCase();
    return words.every(word => haystack.includes(word)) &&
      (!filters.category || item.category?.trim() === filters.category) &&
      (!filters.availableOnly || item.available) &&
      (!filters.prescription || (filters.prescription === "rx" ? item.requires_prescription === true : item.requires_prescription === false));
  });
  return result.sort((a,b) => {
    if (filters.sort === "price-asc" || filters.sort === "price-desc") {
      const left = a.selling_price === null ? null : Number(a.selling_price);
      const right = b.selling_price === null ? null : Number(b.selling_price);
      if (left === null) return right === null ? a.brand_name.localeCompare(b.brand_name) : 1;
      if (right === null) return -1;
      const diff = filters.sort === "price-asc" ? left-right : right-left;
      if (diff) return diff;
    }
    return a.brand_name.localeCompare(b.brand_name) || a.medicine_id.localeCompare(b.medicine_id);
  });
}
export function catalogPage<T>(items: T[], requested: number, pageSize = 12): {items: T[]; page: number; pages: number; start: number; end: number} {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(requested)));
  const offset = (page-1)*size;
  return {items: items.slice(offset, offset+size), page, pages, start: items.length ? offset+1 : 0, end: Math.min(offset+size, items.length)};
}
