"""Database connection and SQLAlchemy ORM models.

Supports both PostgreSQL (production) and SQLite (local testing).
The DATABASE_URL in .env controls which backend is used.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, String, Text, DateTime, Date, Numeric, Boolean, Integer, ForeignKey, Index, text, JSON, UniqueConstraint, CheckConstraint, LargeBinary
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from app.config import settings

# Detect if we're using SQLite
is_sqlite = "sqlite" in settings.database_url


class Base(DeclarativeBase):
    pass


class PrescriptionAttachment(Base):
    __tablename__ = "prescription_attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    media_type = Column(String(30), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    content = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (
        CheckConstraint("size_bytes > 0 AND size_bytes <= 10485760", name="ck_attachment_size"),
    )


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
    source_verification_status = Column(String(100), nullable=False, default="needs_source_verification", server_default="needs_source_verification")
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    prices = relationship("MedicinePrice", back_populates="medicine")
    knowledge_chunks = relationship("KnowledgeChunk", back_populates="medicine")


class Source(Base):
    __tablename__ = "sources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    verification_status = Column(String(100), nullable=False, default="needs_source_verification", server_default="needs_source_verification")
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
    content_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    chunk = relationship("KnowledgeChunk", back_populates="embedding_record")


class MrpReference(Base):
    """Versioned DRAP-notified MRP per medicine + pack size (Phase-1 Feature A).

    Created by alembic revision 0002 (spec 09 §7.2). Explicit catalog
    refreshes update the current stored baseline by registration number,
    retaining a snapshot when its pack/date changes. Every row carries a
    ``source_id`` for provenance.
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


class OverchargeReport(Base):
    """User report of a pharmacy overcharging above official DRAP MRP.

    Created by alembic revision 0007.
    Stores user submission details alongside snapshot audit fields
    (notified_mrp, mrp_effective_date, overcharge_amount) to ensure
    report auditability even if MRP references are updated later.
    """
    __tablename__ = "overcharge_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_id = Column(String(36), ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    pharmacy_name = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False, index=True)
    price_paid = Column(Numeric(10, 2), nullable=False)
    notified_mrp = Column(Numeric(10, 2), nullable=False)
    mrp_effective_date = Column(Date, nullable=True)
    overcharge_amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="PKR")
    note = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    medicine = relationship("Medicine")
    reported_by_user = relationship("User")


class UserCabinet(Base):
    """User's digital medicine cabinet (saved active medications).

    Created by alembic revision 0008.
    Unique constraint `uq_user_medicine` on (user_id, medicine_id) prevents duplicates.
    Joined with `drap_alerts` for automated recall watchdog alerts.
    """
    __tablename__ = "user_cabinet"
    __table_args__ = (UniqueConstraint("user_id", "medicine_id", name="uq_user_medicine"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(String(36), ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    dosage_instruction = Column(String(255), nullable=True)
    reminder_times = Column(JSON, default=list, nullable=True)
    monthly_units = Column(Integer, nullable=True)
    monthly_quantity = Column(Integer, nullable=True)
    monthly_quantity_unit = Column(String(16), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    medicine = relationship("Medicine")
    user = relationship("User")


class UserFeedback(Base):
    """User feedback and community healthcare needs survey responses.

    Created by alembic revision 0009.
    Stores feedback, ratings, user background (age, city), primary healthcare needs,
    and medicine usage frequency to help optimize Afiya AI's features.
    """
    __tablename__ = "user_feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    age = Column(Integer, nullable=True)
    city = Column(String(100), nullable=True)
    primary_need = Column(String(150), nullable=False)
    frequency_of_medicine_purchase = Column(String(100), nullable=True)
    rating = Column(Integer, nullable=False, default=5)
    ease_of_use = Column(String(50), nullable=True)
    feedback = Column(Text, nullable=False)
    would_recommend = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User")


class PharmacySeller(Base):
    __tablename__ = "pharmacy_sellers"
    __table_args__ = (CheckConstraint("verification_status IN ('PENDING','VERIFIED','REJECTED')", name="ck_seller_status"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pharmacy_name = Column(String(200), nullable=False)
    city = Column(String(100), nullable=False, default="Karachi", server_default="Karachi")
    address = Column(String(300), nullable=True)
    drug_license_no = Column(String(100), nullable=False, unique=True)
    pharmacist_reg_no = Column(String(100), nullable=False)
    license_doc_url = Column(Text, nullable=True)
    verification_status = Column(String(30), nullable=False, default="PENDING", server_default="PENDING")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class StoreInventory(Base):
    __tablename__ = "store_inventory"
    __table_args__ = (
        CheckConstraint("selling_price >= 0", name="ck_inventory_price"),
        CheckConstraint("stock_quantity >= 0", name="ck_inventory_stock"),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_id = Column(String(36), ForeignKey("medicines.id"), nullable=False, unique=True, index=True)
    seller_id = Column(String(36), ForeignKey("pharmacy_sellers.id"), nullable=True)
    selling_price = Column(Numeric(10, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=50, server_default="50")
    active_batch_no = Column(String(64), nullable=False, default="BATCH-2026-OK", server_default="BATCH-2026-OK")
    requires_prescription = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("status IN ('AWAITING_PHARMACIST_CART','CART_READY_FOR_USER','PENDING_RX_REVIEW','CONFIRMED','DELIVERED','CANCELLED')", name="ck_order_status"),
        CheckConstraint("total_amount >= 0 AND total_savings_pkr >= 0", name="ck_order_totals"),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(40), nullable=False)
    prescription_image_url = Column(Text, nullable=True)
    customer_note = Column(Text, nullable=True)
    has_duplication_override = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    verified_by_pharmacist = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    total_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    total_savings_pkr = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_order_item_price"),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(String(36), ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    switched_from_medicine_id = Column(String(36), nullable=True)


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
        if is_sqlite:
            # Ensure newly added columns exist in existing SQLite databases
            try:
                await conn.execute(text("ALTER TABLE user_cabinet ADD COLUMN dosage_instruction VARCHAR(255)"))
            except Exception:
                pass
            try:
                await conn.execute(text("ALTER TABLE user_cabinet ADD COLUMN reminder_times JSON"))
            except Exception:
                pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
