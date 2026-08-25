"""Safety gate tests: extended EMERGENCY_KEYWORDS (fix/emergency-keywords).

Asserts the EMERGENCY response is returned directly (no LLM call):
- common English phrasings ("chest pain, can't breathe"),
- Roman-Urdu phrasings ("mujhe saans nahi aa rahi"),
- and guards against over-broad matching (a normal medicine question
  must NOT be flagged as an emergency).
"""

import pytest

from app.services.safety_service import check_emergency
from app.services.chat_service import generate_chat_response


@pytest.mark.parametrize(
    "message",
    [
        "chest pain, can't breathe",
        "I have chest pain",
        "my father cant breathe",
        "she is having difficulty breathing",
        "shortness of breath since morning",
        "I think he is having a heart attack",
        "she passed out in the kitchen",
        "my child swallowed a whole bottle of pills",
    ],
)
def test_english_emergency_phrasings_caught(message):
    assert check_emergency(message) is not None, f"must be flagged: {message!r}"


@pytest.mark.parametrize(
    "message",
    [
        "mujhe saans nahi aa rahi",
        "bachay ko saans nahi aa raha",
        "saans nai aa rahi",
        "uski saans band ho gayi hai",
        "seenay mein dard hai",
        "seene me dard ho raha hai",
        "chaati mein dard",
        "aba ko dil ka daura para hai",
        "wo behosh ho gaya",
        "bachay ne poori bottle goliyan kha li",
    ],
)
def test_roman_urdu_emergency_phrasings_caught(message):
    assert check_emergency(message) is not None, f"must be flagged: {message!r}"


@pytest.mark.parametrize(
    "message",
    [
        "what is paracetamol",
        "Tell me about Panadol",
        "Augmentin kis liye hai",
        "is Rigix cheaper than Zyrtec?",
        "I drink a whole bottle of water every day",
    ],
)
def test_normal_messages_not_flagged(message):
    assert check_emergency(message) is None, f"over-broad match: {message!r}"


async def test_chat_returns_emergency_response_no_llm_en(backfilled_db):
    """'chest pain, can't breathe' must short-circuit to the emergency
    response with NO LLM call (safe under quota exhaustion)."""
    db_file, factory = backfilled_db
    async with factory() as db:
        resp = await generate_chat_response(
            "chest pain, can't breathe", db, language="en"
        )
        low = resp.message.lower()
        assert "emergency" in low
        assert "1122" in resp.message
        assert "encountered an error" not in low, (
            "must not reach the LLM / error fallback"
        )
        assert resp.sources == []
        assert resp.disclaimer


async def test_chat_returns_emergency_response_no_llm_roman_urdu(backfilled_db):
    db_file, factory = backfilled_db
    async with factory() as db:
        resp = await generate_chat_response(
            "mujhe saans nahi aa rahi", db, language="roman_ur"
        )
        low = resp.message.lower()
        assert "emergency" in low
        assert "1122" in resp.message
        assert "encountered an error" not in low
        assert resp.disclaimer
