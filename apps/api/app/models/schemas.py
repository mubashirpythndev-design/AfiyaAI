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
    verification_status: str = "needs_source_verification"
    collected_at: Optional[str] = None


class MedicineSchema(BaseModel):
    id: str
    brand_name: str
    generic_name: str
    dosage_form: str
    strength: str
    manufacturer: str
    registration_info: Optional[str] = None
    drap_reg_no: Optional[str] = None
    source_verification_status: str = "needs_source_verification"
    aliases: list[str] = []
    category: str


class DRAPAssessmentSchema(BaseModel):
    status: str
    is_verified: bool
    badge: str
    registration_number: Optional[str] = None
    warning: Optional[str] = None
    urdu_warning: Optional[str] = None


class RiskTierAssessmentSchema(BaseModel):
    tier: int
    label: str
    color: str
    advisory: str
    advisory_urdu: str


class LASACandidateSchema(BaseModel):
    id: str
    brand_name: str
    generic_name: str
    strength: str
    dosage_form: str
    category: str


class LASAWarningSchema(BaseModel):
    confirmation_required: bool = False
    query: str
    candidate_a: LASACandidateSchema
    candidate_b: LASACandidateSchema
    warning_message: str
    urdu_warning_message: str


class SafetyAssessmentSchema(BaseModel):
    drap_status: DRAPAssessmentSchema
    risk_tier: RiskTierAssessmentSchema


class MedicineWithSafetySchema(MedicineSchema):
    safety: SafetyAssessmentSchema


class StrengthAssessmentSchema(BaseModel):
    status: str  # EXACT_STRENGTH_MATCH | STRENGTH_MISMATCH | NO_STRENGTH_DETECTED
    extracted_strength: Optional[str] = None
    database_strength: Optional[str] = None
    warning_message: Optional[str] = None
    urdu_warning_message: Optional[str] = None


class FormAssessmentSchema(BaseModel):
    status: str  # EXACT_FORM_MATCH | FORM_MISMATCH | NO_FORM_DETECTED
    extracted_form: Optional[str] = None
    database_form: Optional[str] = None
    warning_message: Optional[str] = None
    urdu_warning_message: Optional[str] = None


class MedicineCandidate(BaseModel):
    raw_text: str
    confidence: float = Field(ge=0, le=1)
    is_verified: bool
    matched_medicine: Optional[MedicineSchema] = None
    detected_brand: Optional[str] = None
    detected_generic: Optional[str] = None
    detected_strength: Optional[str] = None
    detected_form: Optional[str] = None
    dosage_instruction: Optional[str] = None
    raw_line: Optional[str] = None
    needs_confirmation: Optional[bool] = False
    clinical_purpose: Optional[str] = None
    original_name: Optional[str] = None
    correction_suggestion: Optional[str] = None
    match_confidence: Optional[float] = None
    line_id: Optional[str] = None
    bbox: Optional[list[int]] = None
    unreadable: bool = False
    reviewed: bool = False
    alternative_reading: Optional[str] = None
    form_conflict: bool = False
    safety: Optional[SafetyAssessmentSchema] = None
    strength_assessment: Optional[StrengthAssessmentSchema] = None
    form_assessment: Optional[FormAssessmentSchema] = None
    match_candidates: list[MedicineSchema] = Field(default_factory=list)
    notified_mrp: Optional[Decimal] = None
    stock_quantity: Optional[int] = None
    pack_size: Optional[str] = None


class OCRResponse(BaseModel):
    candidates: list[MedicineCandidate]
    raw_text: str
    clinical_summary: Optional[str] = None
    global_safety_notes: Optional[list[str]] = None
    medicine_line_count: Optional[int] = None
    coverage_status: str = "not_checked"
    verification_performed: bool = False
    review_required: bool = True
    warnings: list[str] = Field(default_factory=list)
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    models_used: list[str] = Field(default_factory=list)
    provider_attempts: int = 0
    engine: str = "gemini"
    local_elapsed_ms: Optional[float] = None
    fallback_available: bool = False
    error: Optional[str] = None
    message: Optional[str] = None
    demo_catalog_items: list[MedicineSchema] = Field(default_factory=list)


class MatchRequest(BaseModel):
    candidate: str
    strength: Optional[str] = None
    dosage_form: Optional[str] = None


class MatchResponse(BaseModel):
    medicine: Optional[MedicineSchema] = None
    confidence: float
    needs_confirmation: bool
    alternatives: list[MedicineSchema] = []
    safety: Optional[SafetyAssessmentSchema] = None
    lasa_warning: Optional[LASAWarningSchema] = None
    strength_assessment: Optional[StrengthAssessmentSchema] = None
    form_assessment: Optional[FormAssessmentSchema] = None


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
    prescription_context: Optional[str] = None


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


class CabinetAddRequest(BaseModel):
    """Request to save a medicine to the user's digital cabinet."""
    medicine_id: str


class CabinetItemSchema(BaseModel):
    """Cabinet item detailed view, including medicine metadata and official MRP."""
    id: str
    medicine_id: str
    medicine: MedicineSchema
    notified_mrp: Optional[Decimal] = None
    created_at: Optional[datetime] = None


class CabinetResponse(BaseModel):
    """Full digital medicine cabinet response."""
    total_items: int
    items: list[CabinetItemSchema]


class FeedbackCreateRequest(BaseModel):
    """User feedback and community health needs submission."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    age: Optional[int] = Field(None, ge=1, le=120)
    city: Optional[str] = Field(None, max_length=100)
    primary_need: str = Field(..., min_length=2, max_length=150)
    frequency_of_medicine_purchase: Optional[str] = Field(None, max_length=100)
    rating: int = Field(5, ge=1, le=5)
    ease_of_use: Optional[str] = Field(None, max_length=50)
    feedback: str = Field(..., min_length=3, max_length=2000)
    would_recommend: bool = True


class FeedbackResponseSchema(BaseModel):
    """Public schema for a feedback response item."""
    id: str
    user_id: Optional[str] = None
    name: str
    email: str
    age: Optional[int] = None
    city: Optional[str] = None
    primary_need: str
    frequency_of_medicine_purchase: Optional[str] = None
    rating: int
    ease_of_use: Optional[str] = None
    feedback: str
    would_recommend: bool = True
    created_at: Optional[datetime] = None


class AdminFeedbackSummarySchema(BaseModel):
    """Aggregated stats on community feedback."""
    total_submissions: int
    average_rating: float
    recommend_percentage: float
    top_primary_need: Optional[str] = None


class AdminFeedbackListResponse(BaseModel):
    """Admin feedback view with summary stats and paginated list."""
    summary: AdminFeedbackSummarySchema
    feedbacks: list[FeedbackResponseSchema]



