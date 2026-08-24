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

export interface MedicineInfo {
  medicine: MedicineDetail;
  knowledge_chunks: KnowledgeChunk[];
  prices: PriceEntry[];
  sources: Source[];
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

export interface ApiError {
  detail: string;
  status_code: number;
}
