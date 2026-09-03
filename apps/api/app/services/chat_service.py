"""Afiya AI — Multilingual RAG Chat Service (Gemini Orchestration & Medical Safety Enforcement).
Author / Developer: Mubashir (Lead Developer)
"""

import re
import logging
import google.generativeai as genai
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import Medicine
from app.services.matching_service import medicine_to_schema
from app.services.cheapest_brand_service import get_cheapest_brands, MedicineNotFound
from app.services.price_service import get_price_comparison
from app.services.safety_service import (
    check_emergency,
    is_diagnostic_request,
    get_diagnostic_refusal,
    build_safety_system_prompt,
    validate_response,
    DISCLAIMER,
)
from app.services.rag_service import retrieve_context
from app.services.chat_resolution import resolve_medicine_from_message
from app.services.disease_advisory_service import find_medicines_for_condition, get_sources_for_condition
from app.services.price_check_messages import localize
from app.models.schemas import ChatResponse, SourceSchema, MedicineSchema

logger = logging.getLogger(__name__)

# Authoritative Founding Team & Ownership information
OWNERS_INFO = """Afiya AI Founding Team & Ownership Information:
Afiya AI was conceptualized, engineered, and developed by a dedicated three-member team:
1. **Muhammad Taha Khan** — Team Lead & Project Visionary
   - Conceptualized the original project idea.
   - Strategic project planning, team management, and pitch presentation.
2. **Muhammad Mubashir Khalid** — Lead Developer & Software Engineer
   - Sole full-stack developer who engineered the complete technical codebase end-to-end.
   - Designed and built the Next.js 15 UI, interactive components, and responsive experience.
   - Developed the Python FastAPI backend, REST APIs, and middleware.
   - Architected the PostgreSQL + pgvector (768-dim) RAG pipeline.
   - Integrated Gemini Multimodal Vision OCR with fallback cascades.
   - Authored all database migrations and automated test suites.
3. **Muhammad Sultan Abbasi** — Research & Quality Assurance
   - Conducted official DRAP medicine pricing and registration dataset research.
   - User acceptance testing and edge-case scenario validation.
   - Pharmaceutical data verification and quality assurance."""


def is_owner_or_team_query(message: str) -> bool:
    """Detect if the user is asking about the owners, creators, developers, or team of Afiya AI."""
    msg_lower = message.lower()
    owner_keywords = [
        "owner", "owners", "who made", "who created", "who developed", "who built",
        "who programmed", "who founded", "founder", "founders", "who is behind",
        "team", "developer", "developers", "creator", "creators", "author", "authors",
        "kis ne banaya", "kis ne banai", "kis ne create kiya", "malik kon", "team mein kon", "kis ki team",
        "who owns", "owner of afiya", "owners of afiya", "who are the owners",
        "who are you created by", "who designed", "who started",
    ]
    return any(kw in msg_lower for kw in owner_keywords)


def is_general_alternatives_query(message: str) -> bool:
    """Detect if the user is asking generally about alternative medicines in Afiya AI."""
    msg_lower = message.lower()
    patterns = [
        "alternative of medicines", "alternatives of medicines", "alternative medicine",
        "substitute medicines", "how do alternatives work", "mutabadil dawai",
        "cheaper alternative", "alternative brands", "substitutes",
    ]
    return any(p in msg_lower for p in patterns)


async def get_database_catalog_context(db: AsyncSession) -> str:
    """Generate a structured summary of all verified medicines and categories in the database."""
    result = await db.execute(
        select(Medicine.category, Medicine.brand_name, Medicine.generic_name, Medicine.strength)
        .order_by(Medicine.category, Medicine.brand_name)
    )
    rows = result.all()
    if not rows:
        return ""

    categories: dict[str, list[str]] = {}
    for cat, brand, gen, strength in rows:
        cat_key = cat or "Other Essential Medicines"
        if cat_key not in categories:
            categories[cat_key] = []
        entry = f"{brand} ({gen} {strength})"
        if entry not in categories[cat_key]:
            categories[cat_key].append(entry)

    lines = [
        "Afiya AI Verified Medicine Database (100+ DRAP-Registered Medicines):",
        "Afiya AI contains verified medicines across multiple therapeutic categories registered with DRAP (Drug Regulatory Authority of Pakistan):",
    ]
    for cat, meds in categories.items():
        lines.append(f"- **{cat}**: {', '.join(meds[:8])}{'...' if len(meds) > 8 else ''}")

    lines.append("\nUsers can ask about any of these medicines for uses, side effects, dosage, prices, and alternative brands!")
    return "\n".join(lines)


SYMPTOM_GROUPS = [
    {
        "names": ["headache", "head ache", "head pain", "migraine", "sar dard", "sar me dard", "sar mein dard"],
        "label": "headache (سر درد)",
        "generics": ["Paracetamol", "Ibuprofen"],
    },
    {
        "names": ["fever", "high temperature", "bukhar", "bukhaar", "hararat", "tap"],
        "label": "fever (بخار)",
        "generics": ["Paracetamol", "Ibuprofen"],
    },
    {
        "names": ["body pain", "body ache", "muscle pain", "jism mein dard", "badan dard", "kamar dard", "back pain", "joint pain", "jodon ka dard", "joint ache"],
        "label": "body and muscular pain (جسم اور پٹھوں کا درد)",
        "generics": ["Ibuprofen", "Paracetamol", "Mefenamic Acid", "Diclofenac"],
    },
    {
        "names": ["acidity", "heartburn", "acid reflux", "gerd", "tezabiat", "seene mein jalan", "gas", "pet mein gas", "stomach burning"],
        "label": "stomach acidity and heartburn (تیزابیت اور سینے کی جلن)",
        "generics": ["Omeprazole", "Esomeprazole"],
    },
    {
        "names": ["allergy", "allergic", "itching", "kharish", "rash", "hives", "sneezing", "chheenk", "chheenkain", "runny nose", "nazla"],
        "label": "allergies, sneezing, and runny nose (الرجی اور چھینکیں)",
        "generics": ["Cetirizine", "Loratadine", "Fexofenadine"],
    },
    {
        "names": ["cough", "khansi", "sore throat", "gale mein dard", "gala kharab"],
        "label": "cough and sore throat (کھانسی اور گلے کی سوزش)",
        "generics": ["Paracetamol", "Co-Amoxiclav", "Amoxicillin"],
    },
    {
        "names": ["stomach pain", "stomach ache", "pet dard", "pet mein dard", "cramps", "marrhor"],
        "label": "stomach pain and cramps (پیٹ درد اور مروڑ)",
        "generics": ["Mefenamic Acid", "Omeprazole"],
    },
    {
        "names": ["diarrhea", "loose motion", "dast", "pet kharab"],
        "label": "diarrhea and stomach upset (دست اور پیٹ کی خرابی)",
        "generics": ["Metronidazole"],
    },
]


async def get_symptom_guidance_context(
    message: str, db: AsyncSession, language: str = "en"
) -> tuple[str, list[SourceSchema], list[str]]:
    """Detect symptoms or conditions mentioned in the message and retrieve matching verified medicines."""
    msg_lower = message.lower()
    matched_symptoms: list[str] = []
    needed_generics: list[str] = []

    for group in SYMPTOM_GROUPS:
        if any(name in msg_lower for name in group["names"]):
            matched_symptoms.append(group["label"])
            for g in group["generics"]:
                if g not in needed_generics:
                    needed_generics.append(g)

    if not matched_symptoms or not needed_generics:
        return "", [], []

    conditions = [func.lower(Medicine.generic_name).like(f"%{g.lower()}%") for g in needed_generics]
    result = await db.execute(select(Medicine).where(or_(*conditions)).limit(8))
    med_rows = result.scalars().all()

    if not med_rows:
        return "", [], matched_symptoms

    lines = [
        f"Verified Database Medicines Indicated for Reported Symptoms / Conditions ({', '.join(matched_symptoms)}):"
    ]
    sources: list[SourceSchema] = []
    for med in med_rows:
        lines.append(
            f"- Brand: {med.brand_name} {med.strength} {med.dosage_form} (Generic: {med.generic_name}) by {med.manufacturer or 'Registered Pharmaceutical'}"
        )
        sources.append(
            SourceSchema(
                name=f"{med.brand_name} (DRAP Reference)",
                url="https://e.dra.gov.pk/public/price",
                source_type="reference_regulatory",
            )
        )

    return "\n".join(lines), sources, matched_symptoms


async def build_full_medicine_context(
    medicine_id: str,
    query: str,
    db: AsyncSession,
    language: str = "en",
) -> tuple[str, list[SourceSchema], MedicineSchema | None]:
    """Retrieve complete, grounded context for a verified medicine:
    - Core specs (brand, generic, strength, form, manufacturer, DRAP reg no, category)
    - Verified bioequivalent alternative brands & savings (cheapest_brand_service)
    - Regulated MRP & Pharmacy retail prices (price_service)
    - Clinical knowledge chunks (uses, dosage, precautions, side effects)
    """
    res = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    med_row = res.scalar_one_or_none()
    if not med_row:
        return "", [], None

    med_schema = medicine_to_schema(med_row)
    sources: list[SourceSchema] = []
    seen_sources: set[str] = set()

    lines = [
        f"=== VERIFIED MEDICINE PROFILE: {med_row.brand_name} {med_row.strength} {med_row.dosage_form} ===",
        f"- Brand Name: {med_row.brand_name}",
        f"- Active Generic Ingredient: {med_row.generic_name}",
        f"- Strength: {med_row.strength}",
        f"- Dosage Form: {med_row.dosage_form}",
        f"- Manufacturer: {med_row.manufacturer or 'Registered Pharmaceutical Manufacturer'}",
        f"- DRAP Registration No: {med_row.drap_reg_no or med_row.registration_info or 'Registered with DRAP'}",
        f"- Therapeutic Category: {med_row.category or 'General'}",
    ]

    # DRAP Reference MRP & Retail Pharmacy Prices
    try:
        comparison = await get_price_comparison(medicine_id, db)
        if comparison and comparison.prices:
            price_parts = []
            for p in comparison.prices:
                price_parts.append(f"{p.pharmacy_name}: PKR {float(p.price):.2f} ({p.package_size})")
                if p.pharmacy_name not in seen_sources:
                    seen_sources.add(p.pharmacy_name)
                    sources.append(SourceSchema(name=p.pharmacy_name, url=p.source_url or "", source_type="pharmacy_retail"))
            lines.append(f"- DRAP Reference MRP & Retail Pharmacy Prices: {'; '.join(price_parts)}")
    except Exception as e:
        logger.debug(f"Error fetching prices for medicine {medicine_id}: {e}")

    # Verified Alternative Brands in Same Generic Group
    try:
        brand_group = await get_cheapest_brands(db, medicine_id)
        if brand_group and brand_group.options:
            alt_lines = []
            for opt in brand_group.options:
                is_queried = (opt.medicine_id == medicine_id)
                tag = "Current Queried Brand" if is_queried else "Alternative Brand"
                saving_text = ""
                if not is_queried and opt.saving_percent_vs_queried > 0:
                    saving_text = f" (Saves {float(opt.saving_percent_vs_queried):.1f}% vs {med_row.brand_name})"
                alt_lines.append(
                    f"  * [{tag}] {opt.brand_name} ({opt.strength} {opt.dosage_form}) by {opt.manufacturer}: "
                    f"PKR {float(opt.price):.2f} per pack ({opt.package_size}), unit price PKR {float(opt.per_unit):.2f}{saving_text}"
                )
            if alt_lines:
                lines.append("\n- Verified Same-Generic Alternative Brands (DRAP Registered):")
                lines.extend(alt_lines)
                if brand_group.cheapest and brand_group.cheapest.medicine_id != medicine_id:
                    lines.append(f"  * Cheapest Brand Option: {brand_group.cheapest.brand_name} at PKR {float(brand_group.cheapest.per_unit):.2f}/unit")
                lines.append("  * Bioequivalence Note: All alternative brands share the exact same active generic molecule, strength, and dosage form. Advise the user to consult a doctor or pharmacist before switching.")
    except MedicineNotFound:
        pass
    except Exception as e:
        logger.debug(f"Error fetching alternative brands for medicine {medicine_id}: {e}")

    # Clinical Knowledge Chunks (RAG)
    try:
        rag_result = await retrieve_context(medicine_id, query, db)
        raw_chunks = rag_result.get("chunks", [])
        for s in rag_result.get("sources", []):
            if s["name"] not in seen_sources:
                seen_sources.add(s["name"])
                sources.append(SourceSchema(**s))

        if raw_chunks:
            lines.append("\n- Clinical Knowledge & Usage Information:")
            for c in raw_chunks:
                cleaned = clean_chunk_for_language(c["content"], language)
                src = c.get("source", {}).get("name", "DRAP")
                lines.append(f"  * [{c['chunk_type'].upper()}]: {cleaned} (Source: {src})")
    except Exception as e:
        logger.debug(f"Error retrieving RAG context for medicine {medicine_id}: {e}")

    return "\n".join(lines), sources, med_schema


def sanitize_chat_history(conversation_history: list[dict] | None) -> list[dict]:
    """Sanitize and format history to meet strict Gemini alternating role requirements."""
    if not conversation_history:
        return []
    history = []
    for msg in conversation_history:
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        role = "user" if msg.get("role") == "user" else "model"
        if history and history[-1]["role"] == role:
            history[-1]["parts"][0] += f"\n{content}"
        else:
            history.append({"role": role, "parts": [content]})

    while history and history[0]["role"] != "user":
        history.pop(0)
    while history and history[-1]["role"] != "model":
        history.pop()

    return history[-6:]


def clean_chunk_for_language(content: str, language: str) -> str:
    """Clean chunk content according to requested language."""
    if language == "en":
        return re.sub(r"\(Roman Urdu:[^)]*\)", "", content).strip()
    elif language in ("roman_ur", "roman-ur", "ru"):
        ru_match = re.search(r"\(Roman Urdu:\s*([^)]*)\)", content)
        if ru_match and ru_match.group(1).strip():
            return ru_match.group(1).strip()
    return content


async def generate_chat_response(
    message: str,
    db: AsyncSession,
    medicine_id: str | None = None,
    language: str = "en",
    conversation_history: list[dict] | None = None,
) -> ChatResponse:
    """Generate a grounded chat response using RAG + Gemini."""

    # Emergency check
    emergency_msg = check_emergency(message)
    if emergency_msg:
        return ChatResponse(
            message=emergency_msg,
            sources=[],
            disclaimer=DISCLAIMER,
        )

    # Diagnostic request check
    if is_diagnostic_request(message):
        return ChatResponse(
            message=get_diagnostic_refusal(),
            sources=[],
            disclaimer=DISCLAIMER,
        )

    # RAG retrieval & context assembly
    context = ""
    sources: list[SourceSchema] = []
    med_schema = None

    if medicine_id:
        context, sources, med_schema = await build_full_medicine_context(
            medicine_id, message, db, language
        )
    else:
        # No explicit medicine context: try to resolve a medicine mention from the message
        resolved = await resolve_medicine_from_message(message, db)
        if resolved is not None:
            if resolved["medicine"] and not resolved["needs_confirmation"]:
                med_schema = resolved["medicine"]
                medicine_id = med_schema.id
                context, sources, med_schema = await build_full_medicine_context(
                    medicine_id, message, db, language
                )
            elif resolved["needs_confirmation"] and resolved["alternatives"]:
                # Check if the user is asking to compare or substitute between the mentioned medicines
                is_comp = any(
                    kw in message.lower()
                    for kw in [
                        "compare", "vs", "versus", "instead of", "alternative",
                        "farq", "difference", "better", "cheaper", "sasta", "same",
                        "or", "and", "dono", "both", "badal", "mutabadil",
                    ]
                )
                if is_comp and len(resolved["alternatives"]) >= 2:
                    # Provide context for the top 2-3 mentioned medicines
                    contexts = []
                    all_sources = []
                    for alt in resolved["alternatives"][:3]:
                        c_text, c_srcs, _ = await build_full_medicine_context(
                            alt.id, message, db, language
                        )
                        if c_text:
                            contexts.append(c_text)
                            all_sources.extend(c_srcs)
                    context = "\n\n".join(contexts)
                    sources = all_sources
                    med_schema = resolved["alternatives"][0]
                else:
                    names = ", ".join(
                        f"{a.brand_name} {a.strength}" for a in resolved["alternatives"]
                    )
                    return ChatResponse(
                        message=f"{localize(language, 'needs_confirmation')} ({names})",
                        sources=[],
                        disclaimer=DISCLAIMER,
                    )

    # Check for meta-questions about Afiya AI, its team/owners, or database catalog
    is_owner_question = is_owner_or_team_query(message)
    catalog_keywords = [
        "what medicines", "which medicines", "list of medicines", "list all medicines",
        "show medicines", "all medicines", "available medicines", "database medicines",
        "konsi dawaiyan", "konsi medicines", "catalog", "categories",
    ]
    is_catalog_question = any(kw in message.lower() for kw in catalog_keywords)
    is_general_alt = is_general_alternatives_query(message) and not context

    # Check for disease, illness, condition, or symptom guidance if no explicit medicine context yet
    detected_condition_name = ""
    if not context:
        cond_name, cond_meds, cond_ctx = find_medicines_for_condition(message)
        if cond_ctx:
            context = cond_ctx
            sources = get_sources_for_condition(cond_meds)
            detected_condition_name = cond_name
        else:
            symptom_context, sym_sources, detected_symptoms = await get_symptom_guidance_context(message, db, language)
            if symptom_context:
                context = symptom_context
                sources = sym_sources
                detected_condition_name = ", ".join(detected_symptoms)

    meta_keywords = ["what is afiya", "who are you", "about afiya", "afiya ai", "what can you do", "your name"]
    is_meta_question = any(kw in message.lower() for kw in meta_keywords)

    meta_context = ""
    if is_owner_question:
        meta_context = OWNERS_INFO
    elif is_catalog_question:
        meta_context = await get_database_catalog_context(db)
    elif is_general_alt:
        meta_context = """Afiya AI Medicine Alternatives & Substitution Feature:
- Afiya AI allows patients and healthcare consumers in Pakistan to discover verified alternative brands for their medicines that share the exact same active generic pharmaceutical ingredient, dosage strength, and dosage form (bioequivalent medicines).
- By comparing same-generic brands registered with the Drug Regulatory Authority of Pakistan (DRAP), consumers can find cheaper alternatives and save significantly on their healthcare costs.
- Key comparison groups in Afiya AI include:
  * Paracetamol 500mg Tablets: Panadol (PKR 7.27/unit) vs Calpol (PKR 6.50/unit) vs Febrol (PKR 5.85/unit — Saves ~19.5%)
  * Ibuprofen 400mg Tablets: Brufen (PKR 3.75/unit) vs Profen (PKR 1.50/unit — Saves ~60%) vs Inflam (PKR 2.20/unit)
  * Co-Amoxiclav 625mg Tablets: Augmentin (PKR 93.83/unit) vs Clavidar (PKR 80.00/unit — Saves ~14.7%) vs Amclaf (PKR 82.50/unit)
  * Omeprazole 20mg Capsules: Risek vs Losec
  * Mefenamic Acid 250mg Tablets: Ponstan vs Mefnac vs Dolotram
  * Cetirizine 10mg Tablets: Zyrtec vs Rigix vs Softin
- All alternative brands are verified under DRAP regulated Maximum Retail Price (MRP).
- Educational note: Patients should consult their doctor or pharmacist before switching brands."""
    elif is_meta_question:
        meta_context = f"""About Afiya AI:
- Afiya AI is an intelligent medicine information assistant designed for Pakistan.
- It extracts medicine names from prescription images using AI-powered OCR.
- It matches medicines against a verified database of 100+ common medicines across 36 comparison groups registered with DRAP (Drug Regulatory Authority of Pakistan).
- It provides verified medicine information including uses, side effects, precautions, dosage guidance, and multi-brand price comparisons.
- It supports three languages: English, Urdu (اردو), and Roman Urdu.
- It uses RAG (Retrieval-Augmented Generation) to ground all responses in verified medical data.
- It does NOT diagnose conditions or prescribe medications. It only provides authoritative information about verified medicines.
- All medicine prices and MRP baselines are sourced from DRAP Pakistan's official regulated pricing.

{OWNERS_INFO}"""

    is_first_turn = not conversation_history or len(conversation_history) == 0

    # Build system and user prompt
    system_prompt = build_safety_system_prompt(language, is_first_turn=is_first_turn)

    instructions = [
        "- Provide a helpful, clear, and structured response based on the verified context above.",
        "- Ground all medicine details (active generic ingredient, uses, dosage, precautions, side effects, prices, alternative brands) strictly in the verified context.",
    ]

    if is_owner_question:
        instructions.append(
            "- The user is asking about the OWNERS, CREATORS, DEVELOPERS, or TEAM of Afiya AI. "
            "Clearly state the three names: Muhammad Taha Khan (Team Lead & Project Visionary), "
            "Muhammad Mubashir Khalid (Lead Developer & Software Engineer), and "
            "Muhammad Sultan Abbasi (Research & Quality Assurance), highlighting their roles."
        )
    elif is_catalog_question:
        instructions.append(
            "- The user is asking about AVAILABLE MEDICINES or the DATABASE CATALOG. "
            "Provide a clean overview of the therapeutic categories and medicines supported in our verified database."
        )
    elif is_general_alt:
        instructions.append(
            "- The user is asking generally about ALTERNATIVE MEDICINES. "
            "Explain how Afiya AI helps users find verified same-generic alternative brands and save on healthcare costs."
        )
    elif detected_condition_name:
        instructions.append(
            f"- The user is asking what medicine to take for the disease, illness, or condition: '{detected_condition_name}'. "
            "You MUST recommend the verified medicine(s) from our dataset indicated for this condition (including their active generic molecule, popular brand names in the context, and their approved clinical 'when to use' facts). "
            "MANDATORY NON-GUARANTEE ADVISORY RULE: You must provide this as helpful informational advice, but EXPLICITLY state that you do NOT guarantee that they should take this medicine, as individual medical conditions vary and this advice may not be 100% accurate. "
            "MANDATORY DOCTOR CONFIRMATION RULE: You MUST always instruct the user to consult a qualified doctor or licensed healthcare professional for medical confirmation and proper dosage before taking any medicine, particularly for prescription medications and chronic illnesses."
        )
    else:
        is_alt_query = any(kw in message.lower() for kw in ["alternative", "substitute", "instead", "replace", "cheaper", "sasta", "mutabadil", "badal"])
        is_comp_query = any(kw in message.lower() for kw in ["compare", "vs", "versus", "difference", "farq"])

        if is_alt_query:
            instructions.append(
                "- The user is specifically asking for ALTERNATIVES / SUBSTITUTES. "
                "Clearly highlight the verified alternative brands provided in the context, stating each brand name, manufacturer, pack price, per-unit price, and savings percentage vs the queried medicine. "
                "Explain that they share the exact same active generic molecule (bioequivalent), and remind the user to consult a doctor or pharmacist before switching."
            )
        elif is_comp_query:
            instructions.append(
                "- The user is asking to COMPARE medicines. "
                "Provide a clear side-by-side comparison of active ingredients, strengths, manufacturers, uses, and prices based on the context."
            )
        else:
            instructions.append(
                "- When asked about uses, side effects, precautions, dosage guidance, or price comparisons, clearly summarize the verified points present in the context using clean bullet points."
            )
        instructions.append("- Do NOT include information about Afiya AI's creators or owners unless the user specifically asks about them.")

    instructions.append("- Do NOT invent clinical facts, prices, or sources not present in the verified context.")
    instructions.append("- If the requested detail is not found in the context, politely suggest consulting a doctor or pharmacist for clinical advice.")

    user_prompt = f"""Context from verified database:
{context if context else meta_context if meta_context else "No specific medicine context available. Answer clearly using verified medicine knowledge or ask the user which medicine they would like information on."}

User question: {message}

Instructions:
{chr(10).join(instructions)}"""

    # Call Gemini with automatic model fallback
    genai.configure(api_key=settings.gemini_api_key)
    model_candidates = [
        settings.gemini_chat_model,
        "models/gemini-3.1-flash-lite",
        "models/gemini-flash-lite-latest",
        "models/gemini-3.6-flash",
    ]
    models_to_try = list(dict.fromkeys([m for m in model_candidates if m]))

    history = sanitize_chat_history(conversation_history)
    contents = []
    if history:
        for turn in history:
            contents.append(turn)
    contents.append({"role": "user", "parts": [user_prompt]})

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt,
            )
            response = model.generate_content(
                contents,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                ),
            )

            response_text = (response.text or "").strip()
            if not response_text:
                continue

            # For subsequent turns, strip any repetitive opening greetings
            if not is_first_turn:
                response_text = re.sub(
                    r"^(?:hello!?|hi!?|assalam-?o?-?alaikum!?|greetings!?)[^\n]*?(?:afiya ai|medicine assistant|information assistant)[^\n]*?\n+",
                    "",
                    response_text,
                    flags=re.IGNORECASE,
                ).strip()

            response_text = validate_response(response_text)

            return ChatResponse(
                message=response_text,
                sources=sources,
                disclaimer=DISCLAIMER,
                medicine=med_schema,
            )
        except Exception as e:
            logger.warning(f"Chat model '{model_name}' failed: {e}. Trying fallback...")

    return ChatResponse(
        message="I'm sorry, I encountered an error processing your request. Please try again.",
        sources=[],
        disclaimer=DISCLAIMER,
    )
