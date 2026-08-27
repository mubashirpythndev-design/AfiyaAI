// Shared TypeScript types for Afiya AI frontend

export type Language = "en" | "ur" | "roman_ur";

export interface Source {
  name: string;
  url: string | null;
  source_type: string;
  collected_at?: string;
}

export interface MedicineCandidate {
  raw_text: string;
  confidence: number;
  is_verified: boolean;
  matched_medicine?: MedicineDetail;
}

export interface MedicineDetail {
  id: string;
  brand_name: string;
  generic_name: string;
  dosage_form: string;
  strength: string;
  manufacturer: string;
  registration_info: string | null;
  aliases: string[];
  category: string;
}

export interface PriceEntry {
  id: string;
  price: number;
  currency: string;
  package_size: string;
  package_description: string;
  source: Source;
  collected_at: string;
}

export interface PriceComparison {
  medicine: MedicineDetail;
  prices: PriceEntry[];
  lowest_price: number;
  highest_price: number;
  savings: number;
}

export interface CheapestBrandOption {
  medicine_id: string;
  brand_name: string;
  manufacturer: string;
  price: number;
  currency: string;
  package_size: string;
  units: number;
  per_unit: number;
  saving_percent_vs_queried: number;
}

export interface CheapestBrands {
  generic: string;
  strength: string;
  cheapest_brand: string;
  options: CheapestBrandOption[];
  consult_pharmacist_before_switching: boolean;
  safety_reasons: string[];
}

export interface MedicineInfo {
  medicine: MedicineDetail;
  knowledge_chunks: KnowledgeChunk[];
  prices: PriceEntry[];
  sources: Source[];
  cheapest_brands?: CheapestBrands | null;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  chunk_type: string;
  source: Source;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  medicine_id?: string;
  language: Language;
  conversation_history?: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResponse {
  message: string;
  sources: Source[];
  disclaimer: string;
  medicine?: MedicineDetail;
}

export interface OCRResponse {
  candidates: MedicineCandidate[];
  raw_text: string;
}

export interface MatchResponse {
  medicine: MedicineDetail | null;
  confidence: number;
  needs_confirmation: boolean;
  alternatives?: MedicineDetail[];
}

// ---- Phase-1 Feature A: MRP / Overcharge Checker (spec 09 §7.3) ----

export interface PriceCheckRequest {
  medicine_query: string;
  pack_size?: string | null;
  price_paid: number;
  currency?: string;
  lang?: string;
}

export type PriceCheckStatus =
  | "OVERCHARGED"
  | "OK_AT_MRP"
  | "BELOW_MRP"
  | "NO_DATA";

/** Verbatim API response - every value is rendered as returned by the
 *  backend; the client never computes or formats a price/status itself. */
export interface PriceCheckResponse {
  status: PriceCheckStatus | null;
  medicine_id: string | null;
  matched_name: string | null;
  match_confidence: number;
  needs_confirmation: boolean;
  candidates: MedicineDetail[];
  price_paid: number | null;
  mrp: number | null;
  currency: string;
  overcharge_amount: number | null;
  pack_size: string | null;
  sro_ref: string | null;
  effective_date: string | null;
  source: Source | null;
  message: string;
  disclaimer: string;
}

// ---- Phase-1 Feature B: Authenticity / Alert Checker (spec 09 §7.3) ----

export interface AlertCheckRequest {
  medicine_query: string;
  batch_no?: string; // optional: empty batch = name-only check
  lang?: string;
}

export type AlertCheckStatus = "ALERT_FOUND" | "NO_ALERT";

/** One active drap_alerts row as returned by the API (DB-only facts). */
export interface AlertEntry {
  alert_type: string;
  description: string | null;
  batch_no: string | null;
  issued_at: string | null;
  match_basis: string; // batch_no (exact) | name_only (possible — verify)
  is_demo: boolean;
  source: Source | null;
}

/** Verbatim API response - the client never decides authenticity itself. */
export interface AlertCheckResponse {
  status: AlertCheckStatus | null;
  medicine_id: string | null;
  matched_name: string | null;
  match_confidence: number;
  needs_confirmation: boolean;
  candidates: MedicineDetail[];
  alerts: AlertEntry[];
  match_basis: "batch_no" | "name_only" | null;
  message: string;
  disclaimer: string;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

/** Auth (email + password, JWT bearer tokens). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// ---- Overcharge Reports ----

export interface OverchargeReportRequest {
  medicine_id: string;
  pharmacy_name: string;
  city: string;
  price_paid: number;
  pack_size?: string | null;
  note?: string | null;
}

export interface OverchargeReportResponse {
  id: string;
  medicine_id: string;
  medicine_name: string | null;
  reported_by_user_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  pharmacy_name: string;
  city: string;
  price_paid: number;
  notified_mrp: number;
  mrp_effective_date: string | null;
  overcharge_amount: number;
  currency: string;
  note: string | null;
  status: string;
  created_at: string | null;
}

export interface AdminOverchargeReportsResponse {
  summary: {
    total_reports: number;
    total_overcharge_amount: number;
    top_cities: { city: string; count: number }[];
  };
  reports: OverchargeReportResponse[];
}

// ---- Digital Medicine Cabinet & Recall Watchdog ----

export interface CabinetAddRequest {
  medicine_id: string;
}

export interface CabinetItem {
  id: string;
  medicine_id: string;
  medicine: MedicineDetail;
  notified_mrp?: number | null;
  active_alerts: AlertEntry[];
  has_recall_alert: boolean;
  created_at?: string | null;
}

export interface CabinetResponse {
  total_items: number;
  recalled_items_count: number;
  items: CabinetItem[];
}


