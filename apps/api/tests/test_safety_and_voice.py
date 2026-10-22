"""Unit and integration tests for Safety & Legitimacy Layer and Voice Search Guardrail."""

import pytest
from app.services.safety_layer import (
    calculate_soundex,
    check_lasa_collision,
    evaluate_drap_status,
    evaluate_risk_tier,
)
from app.services.voice_guardrail import sanitize_and_correct_voice_transcript
from app.models.schemas import MedicineSchema


def test_soundex_encoding():
    # Standard phonetic soundex tests
    assert calculate_soundex("Losec") == "L220"
    assert calculate_soundex("Lasix") == "L220"
    assert calculate_soundex("Panadol") == "P534"
    assert calculate_soundex("Calpol") == "C414"
    assert calculate_soundex("") == "0000"


def test_lasa_collision_high_hazard():
    losec_med = MedicineSchema(
        id="med-losec-1",
        brand_name="Losec",
        generic_name="Omeprazole",
        dosage_form="Capsule",
        strength="20mg",
        manufacturer="AstraZeneca",
        registration_info="012345",
        aliases=[],
        category="Gastrointestinal",
    )

    lasix_med = MedicineSchema(
        id="med-lasix-1",
        brand_name="Lasix",
        generic_name="Furosemide",
        dosage_form="Tablet",
        strength="40mg",
        manufacturer="Sanofi",
        registration_info="067890",
        aliases=[],
        category="Cardiovascular",
    )

    # Collision between Losec (Omeprazole) and Lasix (Furosemide)
    collision = check_lasa_collision("Losec", losec_med, [lasix_med])
    assert collision is not None
    assert collision["confirmation_required"] is True
    assert "Losec" in collision["warning_message"]
    assert "Lasix" in collision["warning_message"]


def test_lasa_generic_immunity():
    panadol_med = MedicineSchema(
        id="med-panadol-1",
        brand_name="Panadol",
        generic_name="Paracetamol",
        dosage_form="Tablet",
        strength="500mg",
        manufacturer="GSK",
        registration_info="REG-111",
        aliases=[],
        category="Analgesic",
    )

    calpol_med = MedicineSchema(
        id="med-calpol-1",
        brand_name="Calpol",
        generic_name="Paracetamol",
        dosage_form="Suspension",
        strength="120mg/5ml",
        manufacturer="GSK",
        registration_info="REG-222",
        aliases=[],
        category="Analgesic",
    )

    # Same active generic ingredient (Paracetamol) -> Safe substitution, NOT a collision
    collision = check_lasa_collision("Panadol", panadol_med, [calpol_med])
    assert collision is None


def test_drap_status_evaluation():
    # Verified active medicine
    verified_med = MedicineSchema(
        id="med-panadol-1",
        brand_name="Panadol",
        generic_name="Paracetamol",
        dosage_form="Tablet",
        strength="500mg",
        manufacturer="GSK",
        registration_info="DRAP-001234",
        source_verification_status="verified_active",
        aliases=[],
        category="Analgesic",
    )
    status_verified = evaluate_drap_status(verified_med)
    assert status_verified["status"] == "VERIFIED_ACTIVE"
    assert status_verified["is_verified"] is True
    assert status_verified["registration_number"] == "DRAP-001234"
    assert status_verified["warning"] is None

    # Unverified / Not found
    status_unverified = evaluate_drap_status(None)
    assert status_unverified["status"] == "NOT_FOUND"
    assert status_unverified["is_verified"] is False
    assert "counterfeit" in status_unverified["warning"].lower()
    assert "DRAP" in status_unverified["urdu_warning"]


def test_risk_tier_evaluation():
    # Tier 1: Paracetamol (OTC)
    panadol = MedicineSchema(
        id="1", brand_name="Panadol", generic_name="Paracetamol", dosage_form="Tablet",
        strength="500mg", manufacturer="GSK", category="Analgesics & Antipyretics"
    )
    t1 = evaluate_risk_tier(panadol)
    assert t1["tier"] == 1
    assert t1["color"] == "green"

    # Tier 2: Brufen / Ibuprofen (NSAID Caution)
    brufen = MedicineSchema(
        id="2", brand_name="Brufen", generic_name="Ibuprofen", dosage_form="Tablet",
        strength="400mg", manufacturer="Abbott", category="NSAIDs & Anti-inflammatory"
    )
    t2 = evaluate_risk_tier(brufen)
    assert t2["tier"] == 2
    assert t2["color"] == "amber"

    # Tier 3: Ceftum / Cefuroxime (Antibiotic - Rx Only)
    ceftum = MedicineSchema(
        id="3", brand_name="Ceftum", generic_name="Cefuroxime", dosage_form="Tablet",
        strength="500mg", manufacturer="GSK", category="Antibiotics & Cephalosporins"
    )
    t3 = evaluate_risk_tier(ceftum)
    assert t3["tier"] == 3
    assert t3["color"] == "red"
    assert "Prescription" in t3["label"]


def test_voice_search_phonetic_guardrail():
    # The critical bug reported by user: "porn star forte" spoken for Ponstan Forte
    assert sanitize_and_correct_voice_transcript("porn star forte") == "Ponstan Forte"
    assert sanitize_and_correct_voice_transcript("porn star") == "Ponstan"
    assert sanitize_and_correct_voice_transcript("pawn star forte") == "Ponstan Forte"
    assert sanitize_and_correct_voice_transcript("corn star") == "Ponstan"
    assert sanitize_and_correct_voice_transcript("pornstar 500mg") == "Ponstan 500mg"

    # Other common Pakistani brand acoustic misrecognitions
    assert sanitize_and_correct_voice_transcript("panda doll") == "Panadol"
    assert sanitize_and_correct_voice_transcript("fragile 400") == "Flagyl 400"
    assert sanitize_and_correct_voice_transcript("brew fan") == "Brufen"
    assert sanitize_and_correct_voice_transcript("this print") == "Disprin"
    assert sanitize_and_correct_voice_transcript("argument in") == "Augmentin"
    assert sanitize_and_correct_voice_transcript("cat 1000") == "Cac-1000"
    assert sanitize_and_correct_voice_transcript("rice cake") == "Risek"

    # Profanity scrubber
    assert sanitize_and_correct_voice_transcript("hello fuck world") == "hello world"
