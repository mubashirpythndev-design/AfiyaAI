"""Seed the SQLite database with DRAP medicine data for local testing."""

import json
import logging
from decimal import Decimal
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import async_session, Medicine, Source, MedicinePrice


logger = logging.getLogger(__name__)

# Path to DRAP data file (project root)
DRAP_DATA_PATH = Path(__file__).resolve().parents[4] / "DRAP_40_Medicines_data.json"

# Deterministic IDs for reproducible seeds
SOURCE_DRAP_ID = "a0000001-0000-0000-0000-000000000001"


def _parse_medicine_name(product_name: str) -> dict:
    """Parse 'Panadol 500mg Tablet' into brand, generic, form, strength."""
    parts = product_name.strip().split()

    # Common dosage forms
    forms = ["Tablet", "Capsule", "Syrup", "Injection", "Inhaler", "Drops",
             "Suspension", "Cream", "Ointment", "Gel", "Spray", "Suppository"]

    # Known generic name mappings
    generic_map = {
        "Panadol": "Paracetamol",
        "Brufen": "Ibuprofen",
        "Disprin": "Aspirin",
        "Ponstan": "Mefenamic Acid",
        "Augmentin": "Co-Amoxiclav",
        "Cefspan": "Cefixime",
        "Zinnat": "Cefuroxime",
        "Avelox": "Moxifloxacin",
        "Levoflox": "Levofloxacin",
        "Ciproxin": "Ciprofloxacin",
        "Rocephin": "Ceftriaxone",
        "Velosef": "Cefadroxil",
        "Risek": "Omeprazole",
        "Nexium": "Esomeprazole",
        "Zantac": "Ranitidine",
        "Flagyl": "Metronidazole",
        "Polaramine": "Dexchlorpheniramine",
        "Zyrtec": "Cetirizine",
        "Atarax": "Hydroxyzine",
        "Telfast": "Fexofenadine",
        "Glucophage": "Metformin",
        "Daonil": "Glibenclamide",
        "Amaryl": "Glimepiride",
        "Diamicron": "Gliclazide",
        "Concor": "Bisoprolol",
        "Tenormin": "Atenolol",
        "Eziday": "Losartan",
        "Norvasc": "Amlodipine",
        "Maxolon": "Metoclopramide",
        "Motilium": "Domperidone",
        "Pepcid": "Famotidine",
        "Buscopan": "Hyoscine Butylbromide",
        "Lipitor": "Atorvastatin",
        "Crestor": "Rosuvastatin",
        "Zocor": "Simvastatin",
        "Lescol": "Fluvastatin",
        "Ventolin": "Salbutamol",
        "Symbicort": "Budesonide/Formoterol",
        "Singulair": "Montelukast",
        "Myteka": "Montelukast",
        "Beclomet": "Beclomethasone",
    }

    brand = parts[0] if parts else product_name
    generic = generic_map.get(brand, brand)
    strength = ""
    dosage_form = ""

    for part in parts[1:]:
        part_lower = part.lower()
        # Check if it's a dosage form
        matched_form = None
        for f in forms:
            if f.lower() == part_lower:
                matched_form = f
                break
        if matched_form:
            dosage_form = matched_form
        else:
            # Likely a strength
            if any(c.isdigit() for c in part):
                strength = part

    if not dosage_form:
        dosage_form = "Tablet"  # Default

    return {
        "brand_name": brand,
        "generic_name": generic,
        "dosage_form": dosage_form,
        "strength": strength or "N/A",
    }


async def seed_or_sync_drap_data(db: AsyncSession):
    """Seed or synchronize the database with DRAP_40_Medicines_data.json."""
    if not DRAP_DATA_PATH.exists():
        logger.error(f"DRAP data file not found at {DRAP_DATA_PATH}")
        return

    with open(DRAP_DATA_PATH, "r", encoding="utf-8") as f:
        medicines_data = json.load(f)

    # Ensure DRAP source exists
    source_result = await db.execute(select(Source).where(Source.id == SOURCE_DRAP_ID))
    source = source_result.scalar_one_or_none()
    if not source:
        source = Source(
            id=SOURCE_DRAP_ID,
            name="DRAP Pakistan",
            url="https://www.dra.gov.pk/",
            source_type="government_regulatory",
        )
        db.add(source)
        await db.flush()

    for i, item in enumerate(medicines_data, start=1):
        med_id = f"b0000001-0000-0000-0000-{i:012d}"
        price_id = f"c0000001-0000-0000-0000-{i:012d}"
        reg_no = str(item.get("Registration_No", "")).strip() or None
        parsed = _parse_medicine_name(item["Product_name"])
        brand_name = parsed["brand_name"]
        generic_name = item.get("Generic") or parsed["generic_name"]
        dosage_form = item.get("Form") or parsed["dosage_form"]
        strength = item.get("Strength") or parsed["strength"]
        manufacturer = item.get("Manufacturer", "")
        category = item.get("Category", "")
        pack_size = item.get("Packsize", "")

        price_val = item.get("Price", 0)
        if isinstance(price_val, str):
            price_val = float(price_val.replace(",", ""))

        # Lookup existing medicine by deterministic ID or drap_reg_no
        res = await db.execute(select(Medicine).where(Medicine.id == med_id))
        med = res.scalar_one_or_none()
        if not med and reg_no:
            res = await db.execute(select(Medicine).where(Medicine.drap_reg_no == reg_no))
            med = res.scalar_one_or_none()

        if med:
            med.brand_name = brand_name
            med.generic_name = generic_name
            med.dosage_form = dosage_form
            med.strength = strength
            med.manufacturer = manufacturer
            med.registration_info = item.get("Registration_No", "")
            med.drap_reg_no = reg_no
            med.category = category
            med.aliases = [generic_name, item["Product_name"]]

            price_res = await db.execute(select(MedicinePrice).where(MedicinePrice.id == price_id))
            price_obj = price_res.scalar_one_or_none()
            if not price_obj:
                price_res = await db.execute(select(MedicinePrice).where(MedicinePrice.medicine_id == med.id))
                price_obj = price_res.scalar_one_or_none()

            if price_obj:
                price_obj.price = Decimal(str(price_val))
                price_obj.package_size = pack_size
                price_obj.package_description = pack_size
                price_obj.source_id = SOURCE_DRAP_ID
            else:
                db.add(MedicinePrice(
                    id=price_id,
                    medicine_id=med.id,
                    price=Decimal(str(price_val)),
                    currency="PKR",
                    package_size=pack_size,
                    package_description=pack_size,
                    source_id=SOURCE_DRAP_ID,
                ))
        else:
            new_med = Medicine(
                id=med_id,
                brand_name=brand_name,
                generic_name=generic_name,
                dosage_form=dosage_form,
                strength=strength,
                manufacturer=manufacturer,
                registration_info=item.get("Registration_No", ""),
                drap_reg_no=reg_no,
                aliases=[generic_name, item["Product_name"]],
                category=category,
            )
            db.add(new_med)
            db.add(MedicinePrice(
                id=price_id,
                medicine_id=med_id,
                price=Decimal(str(price_val)),
                currency="PKR",
                package_size=pack_size,
                package_description=pack_size,
                source_id=SOURCE_DRAP_ID,
            ))

    await db.commit()
    logger.info("Synchronized %d medicines with DRAP data.", len(medicines_data))



async def seed_if_empty():
    """Seed the database if it's empty, or sync it if already present."""
    async with async_session() as db:
        result = await db.execute(select(func.count()).select_from(Medicine))
        count = result.scalar()
        if count and count > 0:
            logger.info(f"Database has {count} medicines, ensuring synced state.")
            await seed_or_sync_drap_data(db)
            return

        logger.info("Seeding SQLite database with DRAP data...")
        await seed_or_sync_drap_data(db)

