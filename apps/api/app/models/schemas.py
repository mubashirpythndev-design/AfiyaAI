"""Pydantic request/response models for the API."""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


class SourceSchema(BaseModel):
    name: str
    url: Optional[str] = None
    source_type: str
    collected_at: Optional[str] = None


class MedicineSchema(BaseModel):
    id: str
    brand_name: str
    generic_name: str
    dosage_form: str
    strength: str
    manufacturer: str
    registration_info: Optional[str] = None
    aliases: list[str] = []
    category: str


class MedicineCandidate(BaseModel):
    raw_text: str
    confidence: float
    is_verified: bool
    matched_medicine: Optional[MedicineSchema] = None


class OCRResponse(BaseModel):
    candidates: list[MedicineCandidate]
    raw_text: str


class MatchRequest(BaseModel):
    candidate: str


class MatchResponse(BaseModel):
    medicine: Optional[MedicineSchema] = None
    confidence: float
    needs_confirmation: bool
    alternatives: list[MedicineSchema] = []


class PriceEntry(BaseModel):
    id: str
    price: float
    currency: str = "PKR"
    package_size: str
    package_description: str
    source: SourceSchema
    collected_at: str


class PriceComparison(BaseModel):
    medicine: MedicineSchema
    prices: list[PriceEntry]
    lowest_price: float
    highest_price: float
    savings: float


class KnowledgeChunkSchema(BaseModel):
    id: str
    content: str
    chunk_type: str
    source: SourceSchema


class CheapestBrandOptionSchema(BaseModel):
    medicine_id: str
    brand_name: str
    manufacturer: str
    price: float                # pack price from the DB (never LLM-generated)
    currency: str = "PKR"
    package_size: str
    units: int
    per_unit: float             # price / units, sorted ascending by the service
    saving_percent_vs_queried: float  # positive = cheaper than queried brand


class CheapestBrandsSchema(BaseModel):
    """Same-(generic, strength) brand group for a verified medicine.

    Grouping is strictly (generic, strength) - never generic alone, never
    Category. Present only when at least one alternative brand exists.
    """
    generic: str
    strength: str
    cheapest_brand: str
    options: list[CheapestBrandOptionSchema]
    consult_pharmacist_before_switching: bool = False
    safety_reasons: list[str] = []


class MedicineInfo(BaseModel):
    medicine: MedicineSchema
    knowledge_chunks: list[KnowledgeChunkSchema]
    prices: list[PriceEntry]
    sources: list[SourceSchema]
    cheapest_brands: Optional[CheapestBrandsSchema] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    medicine_id: Optional[str] = None
    language: str = "en"
    conversation_history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    message: str
    sources: list[SourceSchema]
    disclaimer: str
    medicine: Optional[MedicineSchema] = None


class PriceCheckRequest(BaseModel):
    """Phase-1 Feature A request (spec 09 §7.3)."""
    medicine_query: str
    pack_size: Optional[str] = None
    price_paid: float = Field(gt=0)  # what the user paid (or was quoted) for the pack
    currency: str = "PKR"
    lang: str = "en"


class PriceCheckResponse(BaseModel):
    """Phase-1 Feature A response (spec 09 §7.3).

    Every number/status comes from the DB (mrp_reference) — never the LLM.
    ``status`` is None when the match itself needs confirmation.
    """
    status: Optional[str] = None  # OVERCHARGED | OK_AT_MRP | BELOW_MRP | NO_DATA
    medicine_id: Optional[str] = None
    matched_name: Optional[str] = None
    match_confidence: float = 0.0
    needs_confirmation: bool = False
    candidates: list[MedicineSchema] = []
    price_paid: Optional[float] = None
    mrp: Optional[float] = None
    currency: str = "PKR"
    overcharge_amount: Optional[float] = None
    pack_size: Optional[str] = None
    sro_ref: Optional[str] = None
    effective_date: Optional[str] = None
    source: Optional[SourceSchema] = None
    message: str
    disclaimer: str


class AlertCheckRequest(BaseModel):
    """Phase-1 Feature B request (spec 09 §7.3)."""
    medicine_query: str
    batch_no: Optional[str] = None
    lang: str = "en"


class AlertSchema(BaseModel):
    """One drap_alerts row as returned by alert-check (DB-only facts)."""
    alert_type: str
    description: Optional[str] = None
    batch_no: Optional[str] = None
    issued_at: Optional[str] = None
    match_basis: str = "name_only"  # batch_no (exact) | name_only (verify)
    is_demo: bool = False
    source: Optional[SourceSchema] = None


class AlertCheckResponse(BaseModel):
    """Phase-1 Feature B response (spec 09 §7.3).

    Status/alerts come only from the drap_alerts table — never the LLM.
    ``status`` is None when the match itself needs confirmation.
    """
    status: Optional[str] = None  # ALERT_FOUND | NO_ALERT
    medicine_id: Optional[str] = None
    matched_name: Optional[str] = None
    match_confidence: float = 0.0
    needs_confirmation: bool = False
    candidates: list[MedicineSchema] = []
    alerts: list[AlertSchema] = []
    match_basis: Optional[str] = None  # batch_no | name_only
    message: str
    disclaimer: str


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"


class RegisterRequest(BaseModel):
    """Email + password sign-up (no email verification in this build)."""
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("name must not be blank")
        return trimmed


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserSchema(BaseModel):
    """Public user view — NEVER includes password_hash."""
    id: str
    name: str
    email: str
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema


class AdminUserSchema(BaseModel):
    """Admin view of a user — adds is_admin but NEVER includes password_hash."""
    id: str
    name: str
    email: str
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    is_admin: bool = False


class AdminUsersResponse(BaseModel):
    """Paginated list of all registered users (admin-only)."""
    total: int
    users: list[AdminUserSchema]


class OverchargeReportCreate(BaseModel):
    """Client request to log a price gouging overcharge report."""
    medicine_id: str
    pharmacy_name: str = Field(min_length=1)
    city: str = Field(min_length=1)
    price_paid: Decimal = Field(gt=0)
    pack_size: Optional[str] = None
    note: Optional[str] = None

    @field_validator("pharmacy_name", "city")
    @classmethod
    def not_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Field must not be blank")
        return trimmed


class OverchargeReportSchema(BaseModel):
    """Detailed view of an overcharge report."""
    id: str
    medicine_id: str
    medicine_name: Optional[str] = None
    reported_by_user_id: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    pharmacy_name: str
    city: str
    price_paid: Decimal
    notified_mrp: Decimal
    mrp_effective_date: Optional[str] = None
    overcharge_amount: Decimal
    currency: str = "PKR"
    note: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None


class AdminOverchargeReportsSummary(BaseModel):
    total_reports: int
    total_overcharge_amount: Decimal
    top_cities: list[dict] = []


class AdminOverchargeReportsResponse(BaseModel):
    summary: AdminOverchargeReportsSummary
    reports: list[OverchargeReportSchema]


class CabinetAddRequest(BaseModel):
    """Request to save a medicine to the user's digital cabinet."""
    medicine_id: str


class CabinetItemSchema(BaseModel):
    """Cabinet item detailed view, including medicine metadata and active DRAP recall alerts."""
    id: str
    medicine_id: str
    medicine: MedicineSchema
    notified_mrp: Optional[Decimal] = None
    active_alerts: list[AlertSchema] = []
    has_recall_alert: bool = False
    created_at: Optional[datetime] = None


class CabinetResponse(BaseModel):
    """Full digital medicine cabinet response with recall watchdog metrics."""
    total_items: int
    recalled_items_count: int
    items: list[CabinetItemSchema]


