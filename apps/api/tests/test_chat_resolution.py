"""Chat resolution tests: medicine mention -> spec-04 matcher (spec 04/08).

Covers:
- Chat resolves a medicine named in free text (EN + Roman Urdu messages).
- Ambiguous / multi-mention messages ask for confirmation, never guess.
- Gibberish resolves to nothing (honest fallback kept).
- Safety gates intact: diagnosis refusal and emergency guidance return
  BEFORE any LLM/RAG call.
"""

from app.services.chat_resolution import resolve_medicine_from_message
from app.services.chat_service import generate_chat_response


async def test_chat_resolves_medicine_from_english_text(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        result = await resolve_medicine_from_message("Tell me about Panadol", db)
        assert result is not None
        assert result["medicine"] is not None
        assert result["medicine"].brand_name == "Panadol"
        assert result["needs_confirmation"] is False


async def test_chat_resolves_medicine_from_roman_urdu_text(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        result = await resolve_medicine_from_message("Augmentin kis liye hai", db)
        assert result is not None
        assert result["medicine"] is not None
        assert result["medicine"].brand_name == "Augmentin"
        assert result["needs_confirmation"] is False


async def test_ambiguous_generic_asks_confirmation(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        # 3 brands share generic Cetirizine -> never silently pick one.
        result = await resolve_medicine_from_message("cetirizine", db)
        assert result is not None
        assert result["needs_confirmation"] is True
        assert result["medicine"] is None
        assert len(result["alternatives"]) >= 2


async def test_multiple_mentions_ask_confirmation(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        result = await resolve_medicine_from_message(
            "Panadol or Augmentin, which one?", db
        )
        assert result is not None
        assert result["needs_confirmation"] is True
        brands = {a.brand_name for a in result["alternatives"]}
        assert {"Panadol", "Augmentin"} <= brands


async def test_gibberish_resolves_to_nothing(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        assert await resolve_medicine_from_message("xyzzy blorp qwerty", db) is None


async def test_diagnosis_refusal_intact_no_llm(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        resp = await generate_chat_response(
            "I have fever and cough, diagnose me and tell me what disease I have",
            db,
            language="en",
        )
        low = resp.message.lower()
        assert "cannot" in low or "diagnos" in low or "not able" in low
        assert resp.disclaimer, "every chat reply must carry the disclaimer"
        assert resp.sources == []


async def test_emergency_gate_intact_no_llm(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        resp = await generate_chat_response(
            "My child just swallowed a whole bottle of tablets!",
            db,
            language="en",
        )
        low = resp.message.lower()
        assert "emergency" in low or "hospital" in low or "immediately" in low
        assert "encountered an error" not in low, (
            "must be gated before the LLM — never pass-by-LLM-luck or "
            "fail on quota"
        )
        assert resp.disclaimer
