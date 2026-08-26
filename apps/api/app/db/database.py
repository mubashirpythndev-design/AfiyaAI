"""Database connection and SQLAlchemy ORM models.

Supports both PostgreSQL (production) and SQLite (local testing).
The DATABASE_URL in .env controls which backend is used.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, String, Text, DateTime, Date, Numeric, Boolean, ForeignKey, Index, text, JSON
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from app.config import settings

# Detect if we're using SQLite
is_sqlite = "sqlite" in settings.database_url


class Base(DeclarativeBase):
    pass


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    brand_name = Column(String(255), nullable=False)
    generic_name = Column(String(255), nullable=False)
    dosage_form = Column(String(100), nullable=False)
    strength = Column(String(100), nullable=False)
    manufacturer = Column(String(255))
    registration_info = Column(String(255))
    # Canonical DRAP Registration_No key (added by alembic revision 0001,
    # additive only; unique index uq_medicines_drap_reg_no).
    drap_reg_no = Column(String(64), nullable=True)
    aliases = Column(JSON, default=list)
    category = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    verified_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    prices = relationship("MedicinePrice", back_populates="medicine")
    knowledge_chunks = relationship("KnowledgeChunk", back_populates="medicine")


class Source(Base):
    __tablename__ = "sources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    url = Column(Text)
    source_type = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class MedicinePrice(Base):
    __tablename__ = "medicine_prices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_id = Column(String(36), ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="PKR")
    package_size = Column(String(100))
    package_description = Column(String(255))
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    collected_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    medicine = relationship("Medicine", back_populates="prices")
    source = relationship("Source")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_id = Column(String(36), ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    chunk_type = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    medicine = relationship("Medicine", back_populates="knowledge_chunks")
    source = relationship("Source")
    embedding_record = relationship("Embedding", back_populates="chunk", uselist=False)


class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chunk_id = Column(String(36), ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    chunk = relationship("KnowledgeChunk", back_populates="embedding_record")


class MrpReference(Base):
    """Versioned DRAP-notified MRP per medicine + pack size (Phase-1 Feature A).

    Created by alembic revision 0002 (spec 09 §7.2). Rows are never
    overwritten: a new SRO/MRP is inserted as a new row with a newer
    ``effective_date``. Every row carries a ``source_id`` for provenance.
    """
    __tablename__ = "mrp_reference"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_id = Column(String(36), ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    pack_size = Column(Text, nullable=False)
    notified_mrp = Column(Numeric(10, 2), nullable=False)  # whole-pack PKR
    currency = Column(Text, nullable=False, default="PKR")
    sro_ref = Column(Text, nullable=True)
    effective_date = Column(Date, nullable=True)
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    medicine = relationship("Medicine")
    source = relationship("Source")


class DrapAlert(Base):
    """DRAP recall / spurious / substandard / quality alerts (Phase-1 Feature B).

    Created by alembic revision 0003 (spec 09 §7.2). ``medicine_id`` is
    nullable for name-only alerts. ``is_demo`` is TRUE for every seeded row:
    all current alerts are DEMO DATA — never fabricated claims about real
    batches or invented DRAP notice IDs. Real ingestion must explicitly set
    ``is_demo=False``.
    """
    __tablename__ = "drap_alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_id = Column(String(36), ForeignKey("medicines.id", ondelete="CASCADE"), nullable=True)
    medicine_name_raw = Column(Text, nullable=True)
    batch_no = Column(Text, nullable=True)
    alert_type = Column(Text, nullable=False)  # recall | spurious | substandard | quality
    description = Column(Text, nullable=True)
    is_demo = Column(Boolean, nullable=False, default=True)
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    issued_at = Column(Date, nullable=True)
    resolved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    medicine = relationship("Medicine")
    source = relationship("Source")


class User(Base):
    """App user (email + password auth).

    Created by alembic revision 0005 (and by create_all in SQLite dev).
    ``password_hash`` is NULLABLE to leave room for future OAuth providers
    (e.g. Google sign-in via a future additive auth_accounts table).
    ``is_verified`` is reserved for future email verification and is not
    enforced anywhere yet.
    ``is_admin`` (alembic revision 0006) is the RBAC flag for admin-only
    views; it is synced from the ADMIN_EMAILS env var on register/login —
    never trusted from client input.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_admin = Column(Boolean, nullable=False, default=False)


# Engine and session
connect_args = {}
if is_sqlite:
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args=connect_args,
    **({"pool_size": 5, "max_overflow": 10} if not is_sqlite else {}),
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables. Called on app startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
