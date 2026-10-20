import type {Language} from "./types";
import type {Money, StoreAlternative, StoreCartItem, OrderStatus} from "./api";
export const price = (value: Money | null | undefined) => value == null ? "Not available" : new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:2}).format(Number(value));
export const text = (lang: Language, en:string, ur:string, roman:string) => lang === "ur" ? ur : lang === "roman_ur" ? roman : en;
export const statusLabel: Record<OrderStatus,string> = {
  AWAITING_PHARMACIST_CART:"Waiting for pharmacist", CART_READY_FOR_USER:"Cart ready for your approval",
  PENDING_RX_REVIEW:"Prescription review pending", CONFIRMED:"Confirmed", DELIVERED:"Delivered", CANCELLED:"Cancelled",
};
export const errorMessage = (error:unknown) => error instanceof Error ? error.message : "Please retry. The request could not be completed.";
export function switchCartItem(items:StoreCartItem[], sourceId:string, suggestion:StoreAlternative):StoreCartItem[] {
  // Merging would alter a pharmacist-approved quantity and its savings baseline.
  if (items.some(item => item.medicine_id === suggestion.medicine_id)) throw new Error("The alternative is already in this cart. Review the overlapping items first.");
  return items.map(item => item.medicine_id === sourceId ? {medicine_id:suggestion.medicine_id,quantity:suggestion.target_quantity,switched_from_medicine_id:sourceId} : item);
}
