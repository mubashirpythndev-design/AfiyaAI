// Shared TypeScript types for Afiya AI frontend

export type Language = "en" | "ur" | "roman_ur";

export interface Source {
  name: string;
  url: string | null;
  source_type: string;
  verification_status?: string;
  collected_at?: string;
}

export interface DRAPAssessment {
  status: "VERIFIED_ACTIVE" | "PROVISIONALLY_ACTIVE" | "NOT_FOUND";
  is_verified: boolean;
  badge: string;
  registration_number?: string | null;
  warning?: string | null;
  urdu_warning?: string | null;
}

export interface RiskTierAssessment {
  tier: 1 | 2 | 3;
  label: string;
  color: "green" | "amber" | "red";
  advisory: string;
  advisory_urdu: string;
}

export interface LASACandidate {
  id: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  category: string;
}

export interface LASAWarning {
  confirmation_required: boolean;
  query: string;
  candidate_a: LASACandidate;
  candidate_b: LASACandidate;
  warning_message: string;
  urdu_warning_message: string;
}

export interface SafetyAssessment {
  drap_status: DRAPAssessment;
  risk_tier: RiskTierAssessment;
}

export type StrengthAssessmentStatus = "EXACT_STRENGTH_MATCH" | "STRENGTH_MISMATCH" | "NO_STRENGTH_DETECTED";

export interface StrengthAssessment {
  status: StrengthAssessmentStatus;
  extracted_strength?: string | null;
  database_strength?: string | null;
  warning_message?: string | null;
  urdu_warning_message?: string | null;
}

export type FormAssessmentStatus = "EXACT_FORM_MATCH" | "FORM_MISMATCH" | "NO_FORM_DETECTED";

export interface FormAssessment {
  status: FormAssessmentStatus;
  extracted_form?: string | null;
  database_form?: string | null;
  warning_message?: string | null;
  urdu_warning_message?: string | null;
}

export interface MedicineCandidate {
  raw_text: string;
  confidence: number;
  is_verified: boolean;
  matched_medicine?: MedicineDetail | null;
  detected_brand?: string | null;
  detected_generic?: string | null;
  detected_strength?: string | null;
  detected_form?: string | null;
  dosage_instruction?: string | null;
  raw_line?: string | null;
  needs_confirmation?: boolean;
  clinical_purpose?: string | null;
  original_name?: string | null;
  correction_suggestion?: string | null;
  match_confidence?: number | null;
  line_id?: string | null;
  bbox?: number[] | null;
  unreadable?: boolean;
  reviewed?: boolean;
  user_edited?: boolean;
  alternative_reading?: string | null;
  form_conflict?: boolean;
  safety?: SafetyAssessment | null;
  strength_assessment?: StrengthAssessment | null;
  form_assessment?: FormAssessment | null;
}

export interface MedicineDetail {
  safety?: SafetyAssessment | null;
  source_verification_status?: string;
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
  medicine?: MedicineDetail;
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  medicine_id?: string;
  language: Language;
  conversation_history?: { role: "user" | "assistant"; content: string }[];
  prescription_context?: string;
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
  clinical_summary?: string | null;
  global_safety_notes?: string[] | null;
  medicine_line_count?: number | null;
  coverage_status?: string;
  verification_performed?: boolean;
  review_required?: boolean;
  warnings?: string[];
  image_width?: number | null;
  image_height?: number | null;
  models_used?: string[];
  provider_attempts?: number;
}

export interface MatchResponse {
  medicine: MedicineDetail | null;
  confidence: number;
  needs_confirmation: boolean;
  alternatives?: MedicineDetail[];
  safety?: SafetyAssessment | null;
  lasa_warning?: LASAWarning | null;
  strength_assessment?: StrengthAssessment | null;
  form_assessment?: FormAssessment | null;
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
  statutory_verified: boolean;
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

export interface ApiError {
  detail: string;
  status_code: number;
}

/** Auth (email + password, JWT bearer tokens). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  is_admin?: boolean;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// ---- Digital Medicine Cabinet ----

export interface CabinetAddRequest {
  medicine_id: string;
}

export interface CabinetQuantityOption {
  unit: "tablet" | "capsule" | "dose" | "unit" | "strip" | "pack";
  units_per_quantity: number;
}

export interface CabinetPriceOption {
  pack_price_paisa: number;
  units_per_pack: number;
}

export interface CabinetPricing {
  current: CabinetPriceOption;
  alternatives: CabinetPriceOption[];
  comparison_available: boolean;
  currency: string;
}

export interface CabinetItem {
  id: string;
  medicine_id: string;
  medicine: MedicineDetail;
  notified_mrp?: number | null;
  dosage_instruction?: string | null;
  reminder_times?: string[] | null;
  monthly_units?: number | null;
  monthly_quantity?: number | null;
  monthly_quantity_unit?: CabinetQuantityOption["unit"] | null;
  package_size?: string | null;
  quantity_options?: CabinetQuantityOption[];
  pricing?: CabinetPricing | null;
  created_at?: string | null;
}

export interface CabinetResponse {
  total_items: number;
  items: CabinetItem[];
  budget: { monthly_cost: number | null; monthly_savings: number | null; annual_savings: number | null; missing_medicine_ids: string[]; price_basis: string };
}

// ---- Feedback & Healthcare Needs Survey ----

export interface FeedbackSubmission {
  name: string;
  email: string;
  age?: number | null;
  city?: string | null;
  primary_need: string;
  frequency_of_medicine_purchase?: string | null;
  rating: number;
  ease_of_use?: string | null;
  feedback: string;
  would_recommend: boolean;
}

export interface FeedbackResponseItem extends FeedbackSubmission {
  id: string;
  user_id?: string | null;
  created_at: string;
}

export interface AdminFeedbackSummary {
  total_submissions: number;
  average_rating: number;
  recommend_percentage: number;
  top_primary_need: string | null;
}

export interface AdminFeedbackListResponse {
  summary: AdminFeedbackSummary;
  feedbacks: FeedbackResponseItem[];
}



