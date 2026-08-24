"""Pydantic request/response models for the API."""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


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


class MedicineInfo(BaseModel):
    medicine: MedicineSchema
    knowledge_chunks: list[KnowledgeChunkSchema]
    prices: list[PriceEntry]
    sources: list[SourceSchema]


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


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
