// Typed API client for Afiya AI backend

import { API_BASE_URL } from "./constants";
import type {
  OCRResponse,
  MatchResponse,
  MedicineDetail,
  PriceComparison,
  MedicineInfo,
  ChatResponse,
  ChatRequest,
  Language,
  PriceCheckRequest,
  PriceCheckResponse,
} from "./types";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// OCR: Upload prescription image
export async function extractFromImage(file: File): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_BASE_URL}/api/ocr/extract`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "OCR extraction failed");
  }
  return res.json();
}

// Medicine matching
export async function matchMedicine(
  candidate: string
): Promise<MatchResponse> {
  return apiFetch<MatchResponse>("/api/medicines/match", {
    method: "POST",
    body: JSON.stringify({ candidate }),
  });
}

// Get medicines by therapeutic category
export async function getMedicinesByCategory(
  category: string
): Promise<MedicineDetail[]> {
  return apiFetch<MedicineDetail[]>(
    `/api/medicines/by-category?category=${encodeURIComponent(category)}`
  );
}

// Get medicine details
export async function getMedicine(id: string): Promise<MedicineDetail> {
  return apiFetch<MedicineDetail>(`/api/medicines/${id}`);
}

// Get price comparison
export async function getPrices(id: string): Promise<PriceComparison> {
  return apiFetch<PriceComparison>(`/api/medicines/${id}/prices`);
}

// Get RAG-powered medicine info
export async function getMedicineInfo(
  id: string,
  language: Language = "en"
): Promise<MedicineInfo> {
  return apiFetch<MedicineInfo>(`/api/medicines/${id}/info?language=${language}`);
}

// Chat
export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Phase-1 Feature A: check a paid price against the DRAP-notified MRP
export async function checkPrice(
  req: PriceCheckRequest
): Promise<PriceCheckResponse> {
  return apiFetch<PriceCheckResponse>("/api/v1/price-check", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/health");
}
