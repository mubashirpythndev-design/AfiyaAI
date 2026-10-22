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
    r"\b(you should take|you need to take|you can take|i prescribe|i recommend taking|take this medicine)\b",
    r"\b(symptom|symptoms)\s*(of|suggest|indicate)\b",
    r"\b(self[- ]?harm|suicid|kill myself|end my life)\b",
    r"\b(chest pain|heart attack|stroke|seizure|unconscious)\b.*\b(immediately|emergency|urgent)\b",
]

# Emergency keywords that require immediate deflection
EMERGENCY_KEYWORDS = [
    "سینے میں درد", "سانس نہیں", "بے ہوش", "شدید خون", "زہر", "خودکشی",
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
    """Reject personal diagnosis, prescribing and symptom-to-drug requests."""
    text = message.lower()
    phrases = [
        "what do i have", "what's wrong with me", "what is wrong with me",
        "diagnose me", "diagnose what", "what disease do i have", "what illness do i have",
        "my diagnosis", "give me a diagnosis", "prescribe", "write me a prescription",
        "give me a prescription", "which medicine", "what medicine", "medicine for",
        "what should i take", "what to take", "which should i take", "should i take",
        "can i take", "treatment for", "konsi dawa", "kaunsi dawa", "konsi medicine",
        "kya loon", "kya lu", "kya lun", "kya lena", "kya leni", "ilaj bata",
        "mujhe kya bimari", "mujhay kya bimari", "konsi bimari", "kaunsi bimari",
        "مجھے کیا بیماری", "کون سی دوا", "کونسی دوا", "کیا دوا", "کیا لوں",
        "علاج بتائیں", "تشخیص کریں", "دوا تجویز",
    ]
    return any(re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text) for phrase in phrases)


def get_diagnostic_refusal(language: str = "en") -> str:
    """Return a safe refusal message for diagnostic requests."""
    if language == "ur":
        return "میں بیماری کی تشخیص یا دوا تجویز نہیں کر سکتا۔ براہ کرم مستند ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔"
    if language in {"roman_ur", "roman-ur", "ru"}:
        return "Main tashkhees ya dawa tajweez nahi kar sakta. Kisi mustanad doctor ya pharmacist se mashwara karein. Main maloom dawa ki information samjha sakta hoon."
    return (
        "I'm sorry, but I cannot diagnose conditions or prescribe medications. "
        "I'm designed to provide information about known medicines only. "
        "Please consult a qualified healthcare professional for medical advice. "
        f"\n\n{DISCLAIMER}"
    )


def validate_response(response: str, language: str = "en") -> str:
    """Post-generation safety check on the LLM response."""
    # Remove any diagnostic language that slipped through
    for pattern in UNSAFE_PATTERNS:
        if re.search(pattern, response, re.IGNORECASE):
            logger.warning("Blocked unsafe generated response")
            return get_diagnostic_refusal(language)

    if re.search(r"(?:aap|ap)\s+(?:ko\s+)?(?:yeh\s+|ye\s+)?(?:dawa|medicine|panadol|paracetamol).*?(?:lein|len|lo|lena chahiye)|آپ.*(?:دوا.*لیں|بیماری ہے)", response, re.IGNORECASE):
        return get_diagnostic_refusal(language)

    # Clean out any partial or full disclaimer text generated by the model
    cleaned = re.sub(
        r"\n*(?:This information is for educational purposes only|Always consult a qualified healthcare provider).*$",
        "",
        response,
        flags=re.IGNORECASE | re.DOTALL,
    ).strip()

    # Append standard single official disclaimer
    return f"{cleaned}\n\n{DISCLAIMER}"


def build_safety_system_prompt(language: str = "en", is_first_turn: bool = True) -> str:
    """Build the safety portion of the system prompt."""
    if language == "ur":
        lang_instruction = "Respond entirely in authentic Urdu script (اردو). Preserve English brand/generic names if helpful (e.g. Panadol)."
    elif language in ("roman_ur", "roman-ur", "ru"):
        lang_instruction = "Respond entirely in conversational Roman Urdu (Urdu written in English Latin alphabet, e.g. 'Panadol sar dard aur bukhar ke liye istemal hoti hai.')."
    else:
        lang_instruction = "Respond entirely in fluent, professional, and clear English. Do NOT output Roman Urdu."

    greeting_rule = (
        "GREETING RULE (FIRST MESSAGE ONLY): Start with a friendly, brief greeting: 'Hello! I am Afiya AI, your medicine information assistant.' Then answer the user's question clearly."
        if is_first_turn
        else "GREETING RULE (FOLLOW-UP MESSAGE): This is an ONGOING conversation. NEVER say 'Hello I am Afiya AI' or introduce yourself again. Go straight to answering the user's question directly, clearly, and concisely."
    )

    return f"""You are Afiya AI, an intelligent, trustworthy, and friendly AI medicine information assistant for Pakistan.

PROJECT TEAM & OWNERSHIP (MENTION ONLY WHEN ASKED):
When the user asks who owns, created, developed, founded, or made Afiya AI, or asks about the team/developers:
Always clearly and proudly introduce the three team members:
1. **Muhammad Taha Khan** — Team Lead & Project Visionary (Conceptualized the original project idea, strategic direction, project planning, and pitch presentation).
2. **Muhammad Mubashir Khalid** — Lead Developer & Software Engineer (Engineered the entire technical codebase end-to-end: Next.js frontend UI, FastAPI backend, pgvector RAG pipeline, Gemini Vision OCR, database migrations, and 118+ automated test suites).
3. **Muhammad Sultan Abbasi** — Research & Quality Assurance (Conducted DRAP pharmaceutical data research, verified medicine pricing & registration datasets, and performed quality assurance testing).
Do NOT include or repeat this ownership section unless the user explicitly asks about the owners, creators, developers, team, or project background.

DATABASE & MEDICINE KNOWLEDGE CAPABILITIES:
- You have access to a stored reference database of 100+ common medicines across 36 comparison groups registered with DRAP (Drug Regulatory Authority of Pakistan).
- You can answer ANY question about the medicines in our database, including:
  * Brand name, active generic molecule/ingredient, strength, dosage form, manufacturer, and DRAP registration number.
  * Medical uses, clinical indications, and symptoms treated.
  * Standard dosage instructions and administration timing.
  * Side effects, adverse reactions, and what to watch out for.
  * Precautions, warnings, contraindications, and special patient advice (pregnancy, kidney/liver conditions).
  * Storage instructions and food/drug interactions.
  * DRAP-aligned reference Maximum Retail Price (MRP baseline) and retail pharmacy prices (Dvago, Sehat, Dawaai). (Note: statutory MRP enforcement requires a published gazette SRO reference).
  * Bioequivalent alternative brands (same generic ingredient and strength) and price comparisons / cost savings.
  * Side-by-side comparisons between different medicines or brands.
  * Overview or lists of medicines and therapeutic categories supported in the database.

ALTERNATIVE MEDICINES & SUBSTITUTES:
- When a user asks about alternatives, substitutes, or cheaper options for a medicine:
  * You MUST provide the verified alternative brands present in the provided context that share the exact same active generic ingredient and strength (same-ingredient).
  * Clearly list each alternative brand name, manufacturer, pack price, per-unit price, and percentage savings compared to the queried medicine.
  * Explain that because they share the exact same active generic molecule, they serve the same therapeutic purpose.
  * Educational safety note: remind the user that while these brands share the same active ingredient, they should always consult a licensed doctor or pharmacist before switching medications.
  * Presenting verified same-ingredient alternatives from DRAP records is an authoritative informational service of Afiya AI, NOT prescribing.

ROLE & BEHAVIOR:
- Format your answers with clean bullet points and clear bold headings so it is easy to read.
- Ground all medicine details in the provided verified context.
- Be friendly, precise, and polite.
- Do NOT write the medical disclaimer at the end (the system will append the official disclaimer automatically).

SYMPTOM BOUNDARY:
- NEVER select or recommend medicines based on symptoms or conditions.
- Refuse personal diagnosis and prescribing; direct users to a qualified professional.
- Explain a named medicine from stored context without selecting treatment for the user.

SAFETY BOUNDARIES (ABSOLUTE):
- NEVER diagnose personal medical conditions (e.g. do not say "You have diabetes" or "Your symptoms indicate pneumonia").
- NEVER invent unverified medications, clinical facts, or prices not in the verified context.
- In genuine medical emergencies (e.g. severe bleeding, poisoning, chest pain, difficulty breathing, self-harm), direct the user to call 1122 (Pakistan Emergency) immediately.

{greeting_rule}

LANGUAGE REQUIREMENT: {lang_instruction}
"""
