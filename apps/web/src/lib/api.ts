// Typed API client for Afiya AI backend

import { API_BASE_URL } from "./constants";
import { clearSession, getAuthToken } from "./auth";
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

async function authHeaders(signal?: AbortSignal, timeoutMs?: number): Promise<Record<string, string>> {
  // OCR cancellation/deadlines must also cover the token lookup before fetch.
  const token = timeoutMs === undefined ? await getAuthToken() : await new Promise<string | null>((resolve, reject) => {
    const cancelled = () => finish(new DOMException("Request cancelled", "AbortError"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    function finish(error?: Error, value: string | null = null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      timer = undefined;
      signal?.removeEventListener("abort", cancelled);
      if (error) reject(error); else resolve(value);
    }
    if (signal?.aborted) { cancelled(); return; }
    signal?.addEventListener("abort", cancelled, { once: true });
    timer = setTimeout(() => finish(new Error("The sign-in service took too long to respond. Please retry the prescription scan.")), timeoutMs);
    getAuthToken().then(value => finish(undefined, value), error => finish(error));
  });
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Share bounded requests and readable errors across JSON and file uploads.
async function fetchResponse(path: string, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  if (!API_BASE_URL) throw new Error("The medicine service is not configured. Please contact the Afiya team.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(API_BASE_URL + path, { ...options, signal: controller.signal });
    // Keep the timeout active until the body has arrived, not only its headers.
    const body = await response.arrayBuffer();
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (controller.signal.aborted) throw new Error("The medicine service took too long to respond. Please try again.");
    if (error instanceof TypeError) throw new Error("Unable to reach the medicine service. Check your connection and make sure the backend is running, then try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export class ApiError extends Error {
  constructor(message:string, public status:number, public code?:string, public fallbackAvailable=false) {
    super(message); this.name="ApiError";
  }
}

export function isOCRServiceBusy(error:unknown): boolean {
  return error instanceof ApiError && (error.code==="OCR_SERVICE_BUSY" || error.status===503 || error.status===429);
}

async function responseData<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.text();
  let data: unknown;
  try { data = body ? JSON.parse(body) : undefined; }
  catch {
    throw new ApiError(res.ok ? "The medicine service returned an unexpected response. Please try again." : "The medicine service is temporarily unavailable (" + res.status + "). Please try again.",res.status);
  }
  if (!res.ok) {
    const failure=data as {error?:string;message?:string;fallback_available?:boolean} | undefined;
    if(failure?.error==="OCR_SERVICE_BUSY") {
      throw new ApiError(failure.message??"Prescription scanning is temporarily busy.",res.status,failure.error,failure.fallback_available===true);
    }
    const detail = (data as { detail?: unknown } | undefined)?.detail;
    const structured = detail && typeof detail === "object" && !Array.isArray(detail) ? detail as {message?: string; lock_reasons?: string[]} : undefined;
    const message = typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map(item => typeof item?.msg === "string" ? item.msg : "Invalid input").join("; ")
      : structured?.message ? [structured.message, ...(structured.lock_reasons ?? [])].join(": ")
      : "The request could not be completed (" + res.status + "). Please try again.";
    throw new ApiError(message,res.status);
  }
  if (data === undefined) throw new Error("The medicine service returned an empty response. Please try again.");
  return data as T;
}

// Marketplace contracts mirror models/marketplace_schemas.py and service payloads.
export type Money = number | string;
export interface StoreMedicine {
  medicine_id: string; brand_name: string; generic_name: string; strength: string;
  dosage_form: string; category: string | null;
}
export interface StoreAlternative {
  medicine_id: string; brand_name: string; selling_price: Money; pack_size: string;
  unit_price: Money | null; savings_pkr: Money; savings_pct: Money; target_quantity: number;
  quantity_unit: "pack"; comparison_basis: "whole_packs" | "equivalent_units";
  pharmacist_confirmation_required: boolean;
}
export interface StoreCatalogItem extends StoreMedicine {
  id: string; selling_price: Money | null; notified_mrp: Money | null; pack_size: string;
  stock_quantity: number; active_batch_no: string | null; requires_prescription: boolean | null;
  seller_name: string | null; seller_verification_status: string | null; is_demo_seller: boolean;
  available: boolean; batch_recalled: boolean; quantity_unit: "pack";
  price_origin: "stored_mrp" | "demo_fallback_unverified"; cheapest_alternative: StoreAlternative | null;
}
export interface StoreCartItem { medicine_id: string; quantity: number; switched_from_medicine_id?: string | null }
export interface DuplicationAlert {
  type: "same_generic" | "same_class"; severity: "HIGH" | "MODERATE";
  generic_name?: string; category?: string; medicines: StoreMedicine[];
  pairs?: [StoreMedicine, StoreMedicine][]; message: string;
}
export interface DuplicationCheck {
  has_duplication: boolean; same_generic_alerts: DuplicationAlert[]; same_class_alerts: DuplicationAlert[];
  unresolved: string[]; ambiguous: {input: string; candidates: StoreMedicine[]}[]; message: string; disclaimer: string;
}
export interface CartEvaluation {
  items: (StoreMedicine & StoreCartItem & {unit_price: Money; line_total_pkr: Money; savings_pkr: Money; quantity_unit: "pack"})[];
  cart_total_pkr: Money; total_savings_pkr: Money; rx_required_items: StoreMedicine[];
  duplication_check: DuplicationCheck; duplication_lock: boolean; rx_gate_lock: boolean;
  duplication_warnings: DuplicationAlert[];
  switch_suggestions: (StoreAlternative & {from_medicine_id: string; quantity: number})[];
  stock_shortages: {medicine_id: string; requested: number; available: number}[]; unresolved: string[];
  unavailable_items: {medicine_id: string; batch_recalled: boolean; seller_verified: boolean; mrp_cap_valid: boolean}[];
  lock_reasons: string[]; can_checkout: boolean; quantity_unit: "pack"; disclaimer: string;
}
export interface EvaluateCartPayload { items: StoreCartItem[]; prescription_attached?: boolean; lang?: Language }
export interface CheckoutPayload {items: StoreCartItem[]; prescription_image_url?: string | null; customer_note?: string | null}
export interface ConciergePayload {prescription_image_url: string; customer_note?: string | null}
export type OrderStatus = "AWAITING_PHARMACIST_CART" | "CART_READY_FOR_USER" | "PENDING_RX_REVIEW" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
export interface StoreOrder {
  id: string; order_id: string; status: OrderStatus; prescription_image_url: string | null; customer_note: string | null;
  has_duplication_override: boolean; verified_by_pharmacist: boolean; total_amount: Money;
  total_savings_pkr: Money; created_at: string; is_demo: boolean;
  items: (StoreMedicine & StoreCartItem & {id?: string; unit_price: Money; quantity_unit: "pack"; cheapest_alternative: StoreAlternative | null})[];
  user_id?: string; buyer_name?: string | null; buyer_email?: string | null;
}
export interface AdminAnalyticsMetrics {
  today_revenue_pkr: Money; monthly_revenue_pkr: Money; total_orders_count: number;
  pending_rx_count: number; concierge_queue_count: number; total_patient_savings_pkr: Money;
  low_stock_items: StoreCatalogItem[]; top_categories: {category: string; order_count: number; revenue_pkr: Money}[];
  includes_demo_orders: boolean; revenue_basis: string;
}
export interface AdminAnalytics extends AdminAnalyticsMetrics {
  real_metrics: AdminAnalyticsMetrics; demo_metrics: AdminAnalyticsMetrics;
}
export interface PharmacySeller {
  id: string; pharmacy_name: string; city: string; address: string | null; drug_license_no: string;
  pharmacist_reg_no: string; license_doc_url: string | null; verification_status: "VERIFIED" | "PENDING" | "REJECTED";
  created_at: string; is_demo: boolean;
}
export interface InventoryUpdate {selling_price?: Money; stock_quantity?: number; active_batch_no?: string; requires_prescription?: boolean}
export interface CatalogSyncResult {
  inserted_count: number; updated_count: number; unchanged_count: number; dry_run: boolean;
  diffs: {product_name: string; drap_reg_no: string; old_mrp: Money | null; new_mrp: Money; effective_date: string | null; action: "inserted" | "updated" | "unchanged"}[];
}
const jsonRequest = (payload: unknown, method = "POST"): RequestInit => ({method, body: JSON.stringify(payload)});
export const fetchStoreCatalog = () => apiFetch<StoreCatalogItem[]>("/api/v1/store/catalog");
export const evaluateCart = (payload: EvaluateCartPayload, signal?: AbortSignal) => apiFetch<CartEvaluation>("/api/v1/store/cart-evaluate", {...jsonRequest(payload), signal});
export const checkoutCart = (payload: CheckoutPayload) => apiFetch<StoreOrder>("/api/v1/store/checkout", jsonRequest(payload));
export const submitConciergeRx = (payload: ConciergePayload) => apiFetch<StoreOrder>("/api/v1/store/concierge-rx", jsonRequest(payload));
export const fetchMyOrders = () => apiFetch<StoreOrder[]>("/api/v1/store/my-orders");
export const confirmPharmacistCart = (id: string, payload: {items?: StoreCartItem[]} = {}) => apiFetch<StoreOrder>(`/api/v1/store/my-orders/${encodeURIComponent(id)}/confirm-cart`, jsonRequest(payload));
export const fetchAdminAnalytics = () => apiFetch<AdminAnalytics>("/api/admin/analytics");
export const fetchAdminOrders = () => apiFetch<StoreOrder[]>("/api/admin/orders");
export const adminBuildCart = (id: string, payload: {items: StoreCartItem[]}) => apiFetch<StoreOrder>(`/api/admin/orders/${encodeURIComponent(id)}/build-cart`, jsonRequest(payload));
export const adminApproveRx = (id: string) => apiFetch<StoreOrder>(`/api/admin/orders/${encodeURIComponent(id)}/approve-rx`, {method:"POST"});
export const fetchAdminInventory = () => apiFetch<StoreCatalogItem[]>("/api/admin/inventory");
export const updateAdminInventory = (id: string, payload: InventoryUpdate) => apiFetch<StoreCatalogItem>(`/api/admin/inventory/${encodeURIComponent(id)}`, jsonRequest(payload,"PATCH"));
export const fetchAdminSellers = () => apiFetch<PharmacySeller[]>("/api/admin/sellers");
export const verifyAdminSeller = (id: string, payload: {verification_status:"VERIFIED" | "REJECTED"}) => apiFetch<PharmacySeller>(`/api/admin/sellers/${encodeURIComponent(id)}/verify`, jsonRequest(payload));
export const syncAdminCatalog = (payload: {records: Record<string, unknown>[]; dry_run?: boolean}) => apiFetch<CatalogSyncResult>("/api/admin/catalog-sync", jsonRequest(payload));
export async function uploadStorePrescription(file: File): Promise<{prescription_image_url: string}> {
  const body = new FormData(); body.append("image",file);
  const response = await fetchResponse("/api/v1/store/prescriptions", {method:"POST", headers:await authHeaders(),body}, 60000);
  if (response.status === 401) handleUnauthorized();
  return responseData(response);
}

export async function fetchStorePrescription(reference: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^\/uploads\/[a-f0-9-]{36}$/.test(reference)) throw new Error("Invalid private prescription reference.");
  const id = reference.split("/").pop();
  const response = await fetchResponse(`/api/v1/store/prescriptions/${id}`, {
    headers:await authHeaders(signal, 10000),cache:"no-store",signal,
  },30000);
  if (response.status === 401) handleUnauthorized();
  if (!response.ok) await responseData(response);
  return response.blob();
}

async function apiFetch<T>(path: string, options?: RequestInit, timeoutMs = 60000): Promise<T> {
  const started = Date.now();
  const auth = timeoutMs < 60000 || options?.signal
    ? await authHeaders(options?.signal ?? undefined, Math.min(timeoutMs, 10000)) : await authHeaders();
  const remaining = () => Math.max(1, timeoutMs - (Date.now() - started));
  const headers: Record<string, string> = { "Content-Type": "application/json", ...auth, ...(options?.headers as Record<string, string> | undefined) };
  let res = await fetchResponse(path, { ...options, headers }, remaining());
  if (res.status === 401) {
    clearSession();
    if (headers.Authorization) {
      const retryHeaders = { ...headers };
      delete retryHeaders.Authorization;
      res = await fetchResponse(path, { ...options, headers: retryHeaders }, remaining());
    }
    if (res.status === 401) handleUnauthorized();
  }
  return responseData<T>(res);
}

// OCR: Upload prescription image
export async function extractFromImage(file: File, options: { forceRefresh?: boolean; scanMode?: "auto" | "thorough" | "fast"; region?: number[]; signal?: AbortSignal } = {}): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("force_refresh", String(options.forceRefresh ?? false));
  formData.append("scan_mode", options.scanMode ?? "auto");
  if (options.region) formData.append("region", JSON.stringify(options.region));
  const auth = await authHeaders(options.signal, 10000);
  const res = await fetchResponse("/api/ocr/extract", {
    method: "POST", headers: auth, body: formData, signal: options.signal,
  }, options.scanMode === "thorough" ? 210000 : 150000);
  if (res.status === 401) handleUnauthorized();
  return responseData<OCRResponse>(res);
}

// Medicine matching
export async function matchMedicine(
  candidate: string,
  strength?: string | null,
  dosage_form?: string | null,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<MatchResponse> {
  return apiFetch<MatchResponse>("/api/medicines/match", {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify({ candidate, strength, dosage_form }),
  }, options.timeoutMs);
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
  medicineId: string,
  dosageInstruction?: string,
  reminderTimes?: string[]
): Promise<CabinetItem> {
  return apiFetch<CabinetItem>("/api/v1/cabinet", {
    method: "POST",
    body: JSON.stringify({
      medicine_id: medicineId,
      dosage_instruction: dosageInstruction,
      reminder_times: reminderTimes,
    }),
  });
}

export async function updateCabinetReminder(
  medicineId: string,
  data: { dosage_instruction?: string; reminder_times?: string[]; monthly_units?: number | null; monthly_quantity?: number | null; monthly_quantity_unit?: string | null }
): Promise<CabinetItem> {
  return apiFetch<CabinetItem>(`/api/v1/cabinet/${medicineId}/reminder`, {
    method: "PATCH",
    body: JSON.stringify(data),
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

// ---- Universal Voice Transcription (Gemini Fallback) ----

export async function transcribeAudio(
  audioBlob: Blob,
  language: Language = "en"
): Promise<{ transcript: string; error?: string }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "speech.webm");
  formData.append("language", language);

  const res = await fetchResponse("/api/chat/transcribe-voice", {
    method: "POST", body: formData,
  });
  return responseData<{ transcript: string; error?: string }>(res);
}
