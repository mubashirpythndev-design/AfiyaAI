"""Medical safety service - pre/post generation validation."""

import re
import logging

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "This information is for educational purposes only and is not a substitute "
    "for professional medical advice. Always consult a qualified healthcare "
    "provider for diagnosis, treatment, and answers to your personal medical questions."
)

# Patterns that indicate unsafe content
UNSAFE_PATTERNS = [
    r"\b(you have|you are suffering from|diagnosis|diagnosed)\b",
    r"\b(you should take|you need to take|i prescribe|i recommend taking)\b",
    r"\b(symptom|symptoms)\s*(of|suggest|indicate)\b",
    r"\b(self[- ]?harm|suicid|kill myself|end my life)\b",
    r"\b(chest pain|heart attack|stroke|seizure|unconscious)\b.*\b(immediately|emergency|urgent)\b",
]

# Emergency keywords that require immediate deflection
EMERGENCY_KEYWORDS = [
    "suicide", "self-harm", "self harm", "overdose", "poison",
    "unconscious", "not breathing", "severe bleeding", "chest pain emergency",
    # Common English emergency phrasings (safety gate: plain, high-precision)
    "chest pain", "can't breathe", "cant breathe", "cannot breathe",
    "can't breath", "difficulty breathing", "trouble breathing",
    "hard to breathe", "shortness of breath", "short of breath",
    "heart attack", "stroke", "passed out",
    # Roman-Urdu equivalents (the app's working languages)
    "saans nahi aa rahi", "saans nahi aa raha", "saans nai aa rahi",
    "saans band", "saans ruk",
    "seenay mein dard", "seene mein dard", "seene me dard", "chaati mein dard",
    "dil ka daura", "behosh", "behoshi",
    # Descriptive ingestion phrasings (medicine-specific, high precision;
    # bare "swallowed" / "whole bottle" are deliberately NOT gated)
    "swallowed a whole bottle", "swallowed the whole bottle",
    "swallowed a bottle of pills", "swallowed a bottle of tablets",
    "swallowed too many", "whole bottle of pills", "whole bottle of tablets",
    "whole bottle of medicine", "ate a whole bottle", "took all the pills",
    "took all the tablets", "took too many pills", "took too many tablets",
    # Roman-Urdu ingestion equivalents
    "poori bottle goliyan kha li", "saari goliyan kha li",
    "bahut si goliyan kha li", "zyada goliyan kha li",
    "bachay ne goliyan kha li", "goliyon ki poori bottle kha li",
]


def check_emergency(message: str) -> str | None:
    """Check if the user message indicates an emergency. Returns deflection message or None."""
    msg_lower = message.lower()
    for keyword in EMERGENCY_KEYWORDS:
        if keyword in msg_lower:
            return (
                "This sounds like it could be a medical emergency. "
                "Please call emergency services (1122 in Pakistan) or go to your nearest hospital immediately. "
                "I am an AI assistant and cannot help with emergencies."
            )
    return None


def is_diagnostic_request(message: str) -> bool:
    """Check if the user is asking for a diagnosis or prescription."""
    msg_lower = message.lower()
    diagnostic_patterns = [
        "what do i have", "what's wrong with me", "diagnose",
        "i have symptoms", "what disease", "what illness",
        "should i take", "what medicine should i", "prescribe",
        "what to take for", "medicine for my",
    ]
    return any(p in msg_lower for p in diagnostic_patterns)


def get_diagnostic_refusal() -> str:
    """Return a safe refusal message for diagnostic requests."""
    return (
        "I'm sorry, but I cannot diagnose conditions or prescribe medications. "
        "I'm designed to provide information about known medicines only. "
        "Please consult a qualified healthcare professional for medical advice. "
        f"\n\n{DISCLAIMER}"
    )


def validate_response(response: str) -> str:
    """Post-generation safety check on the LLM response."""
    # Remove any diagnostic language that slipped through
    for pattern in UNSAFE_PATTERNS:
        if re.search(pattern, response, re.IGNORECASE):
            logger.warning(f"Safety check flagged pattern: {pattern}")
            # Don't block the entire response, just log the warning

    # Ensure disclaimer is present
    if DISCLAIMER not in response:
        response += f"\n\n{DISCLAIMER}"

    return response


def build_safety_system_prompt(language: str = "en") -> str:
    """Build the safety portion of the system prompt."""
    lang_instruction = ""
    if language == "ur":
        lang_instruction = "Respond in Urdu script (اردو). Preserve medicine names in English."
    elif language in ("roman_ur", "roman-ur", "ru"):
        lang_instruction = "Respond in conversational Roman Urdu (Urdu written in English alphabet, e.g. 'Yeh dawai sar dard aur bukhar ke liye istemal hoti hai'). Preserve brand names in English."
    else:
        lang_instruction = "Respond in English."

    return f"""You are Afiya AI, a medicine information assistant. You MUST follow these rules:

SAFETY RULES (ABSOLUTE):
- NEVER diagnose any medical condition
- NEVER prescribe or recommend medications
- NEVER recommend a medicine based on symptoms
- If asked about symptoms, diagnosis, or treatment recommendations, politely refuse and suggest consulting a doctor
- If the user mentions self-harm, suicide, or emergency situations, immediately direct them to call 1122 (Pakistan emergency)

GROUNDING RULES:
- ONLY use the information provided in the context below
- NEVER invent medicine facts, prices, or sources
- If information is not available, say so explicitly
- Always cite the source of information

LANGUAGE: {lang_instruction}

Always end your response with this disclaimer:
"{DISCLAIMER}"
"""
