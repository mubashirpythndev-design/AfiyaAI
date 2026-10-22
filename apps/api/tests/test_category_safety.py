"""Category browsing must not reuse another medicine's registration/risk badge."""
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.db.database import Medicine
from app.routers.medicines import get_medicines_by_category
from app.models.schemas import MedicineWithSafetySchema


@pytest.mark.asyncio
async def test_category_returns_individual_registration_and_risk():
    medicines = [
        Medicine(id="pain-1", brand_name="Panadol", generic_name="Paracetamol", strength="500mg", dosage_form="Tablet", manufacturer="GSK", category="Pain", registration_info="REG-P", source_verification_status="needs_source_verification", aliases=[]),
        Medicine(id="pain-2", brand_name="Brufen", generic_name="Ibuprofen", strength="400mg", dosage_form="Tablet", manufacturer="Abbott", category="Pain", registration_info="REG-B", source_verification_status="needs_source_verification", aliases=[]),
    ]
    rows = MagicMock()
    rows.scalars.return_value.all.return_value = medicines
    db = AsyncMock()
    db.execute.return_value = rows
    records = await get_medicines_by_category("Pain", db)
    assert all(isinstance(record, MedicineWithSafetySchema) for record in records)
    assert [record.safety.drap_status.registration_number for record in records] == ["REG-P", "REG-B"]
    assert [record.safety.risk_tier.tier for record in records] == [1, 2]
    assert not any(record.safety.drap_status.is_verified for record in records)
