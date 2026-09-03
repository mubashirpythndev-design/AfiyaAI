// Typed API client for Afiya AI backend

import { API_BASE_URL } from "./constants";
import { clearSession, getToken, getCurrentUser, getAuthToken } from "./auth";
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
  AuthSession,
  AuthUser,
  CabinetItem,
  CabinetResponse,
  FeedbackSubmission,
  FeedbackResponseItem,
  AdminFeedbackSummary,
  AdminFeedbackListResponse,
} from "./types";

export type {
  CabinetItem,
  CabinetResponse,
  FeedbackSubmission,
  FeedbackResponseItem,
  AdminFeedbackSummary,
  AdminFeedbackListResponse,
};

// Invoked once a request comes back 401 (expired/invalid token): the app
// clears the session and opens the sign-in modal from ONE place.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

function handleUnauthorized(): void {
  clearSession();
  onUnauthorized?.();
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const user = getCurrentUser();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (user?.email) headers["X-Clerk-User-Email"] = user.email;
  if (user?.name) headers["X-Clerk-User-Name"] = user.name;
  return headers;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const auth = await authHeaders();
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...auth,
    ...(options?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers: reqHeaders,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      // If request failed because of an invalid/expired token on a public endpoint, retry once without token
      if (reqHeaders["Authorization"]) {
        const retryHeaders = { ...reqHeaders };
        delete retryHeaders["Authorization"];
        const retryRes = await fetch(url, { ...options, headers: retryHeaders });
        if (retryRes.ok) {
          if (retryRes.status === 204) return undefined as unknown as T;
          const text = await retryRes.text();
          return (text ? JSON.parse(text) : undefined) as T;
        }
      }
      handleUnauthorized();
    }
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  // Handle 204 No Content (e.g. DELETE requests) or empty bodies
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// OCR: Upload prescription image
export async function extractFromImage(file: File): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append("image", file);
  const auth = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/ocr/extract`, {
    method: "POST",
    headers: { ...auth },
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    if (res.status === 401) handleUnauthorized();
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

// Auth: email + password sign-up / sign-in (JWT bearer tokens)
export async function registerUser(req: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function loginUser(req: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

// ---- Admin: registered users list (admin-only, RBAC-gated) ----

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  created_at: string | null;
  last_login_at: string | null;
  is_admin: boolean;
}

export interface AdminUsersResponse {
  total: number;
  users: AdminUser[];
}

export async function fetchAdminUsers(opts?: {
  limit?: number;
  offset?: number;
}): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return apiFetch<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

// Digital Medicine Cabinet
export async function addToCabinet(
  medicineId: string
): Promise<CabinetItem> {
  return apiFetch<CabinetItem>("/api/v1/cabinet", {
    method: "POST",
    body: JSON.stringify({ medicine_id: medicineId }),
  });
}

export async function removeFromCabinet(medicineId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/cabinet/${medicineId}`, {
    method: "DELETE",
  });
}

export async function fetchCabinet(): Promise<CabinetResponse> {
  return apiFetch<CabinetResponse>("/api/v1/cabinet");
}

export async function checkCabinetStatus(
  medicineId: string
): Promise<{ in_cabinet: boolean }> {
  return apiFetch<{ in_cabinet: boolean }>(`/api/v1/cabinet/check/${medicineId}`);
}

// ---- Community Feedback & Healthcare Needs Survey ----

export async function submitUserFeedback(data: FeedbackSubmission): Promise<FeedbackResponseItem> {
  return apiFetch<FeedbackResponseItem>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchAdminFeedbacks(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  primary_need?: string;
  rating?: number;
}): Promise<AdminFeedbackListResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.search) query.set("search", params.search);
  if (params?.primary_need) query.set("primary_need", params.primary_need);
  if (params?.rating) query.set("rating", String(params.rating));
  const qs = query.toString();
  return apiFetch<AdminFeedbackListResponse>(`/api/admin/feedbacks${qs ? `?${qs}` : ""}`);
}

export async function deleteAdminFeedback(id: string): Promise<void> {
  await apiFetch<void>(`/api/admin/feedbacks/${id}`, {
    method: "DELETE",
  });
}




