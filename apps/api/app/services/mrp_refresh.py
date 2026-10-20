"""Refresh an MRP baseline without discarding earlier pack/date evidence."""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import MrpReference


def refresh_reference(db: AsyncSession, reference: MrpReference, fields: dict, source_id: str) -> None:
    if (reference.pack_size, reference.effective_date) != (fields["pack_size"], fields["effective_date"]):
        db.add(MrpReference(medicine_id=reference.medicine_id, pack_size=reference.pack_size,
            notified_mrp=reference.notified_mrp, currency=reference.currency, sro_ref=reference.sro_ref,
            effective_date=reference.effective_date, source_id=reference.source_id,
            created_at=reference.created_at, updated_at=reference.updated_at))
    reference.notified_mrp = fields["notified_mrp"]
    reference.pack_size = fields["pack_size"]
    reference.effective_date = fields["effective_date"]
    reference.source_id = source_id
    reference.updated_at = datetime.utcnow()
