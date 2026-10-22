"""Afiya AI — Voice Search Phonetic Normalizer & Safety Guardrail.
Author / Developer: Mubashir (Lead Developer)

Solves:
1. Acoustic misrecognitions of Pakistani brand names in speech-to-text models
   (e.g., 'Ponstan Forte' misrecognized as 'porn star forte' or 'corn star',
   'Panadol' as 'panda doll', 'Flagyl' as 'fragile', etc.)
2. Offensive / adult acoustic artifact filtering to protect healthcare search safety.
"""

import logging
import re

logger = logging.getLogger(__name__)

# Phonetic correction mappings for common acoustic confusions in Pakistani speech
PHONETIC_MEDICINE_MAP: list[tuple[re.Pattern, str]] = [
    # Ponstan / Ponstan Forte (Critical acoustic confusion fix)
    (re.compile(r"\b(?:porn\s*star|pornstar|pawn\s*star|corn\s*star|point\s*star)\s*forte\b", re.I), "Ponstan Forte"),
    (re.compile(r"\b(?:porn\s*star|pornstar|pawn\s*star|corn\s*star|point\s*star|pon\s*stan)\b", re.I), "Ponstan"),
    (re.compile(r"\b(?:porn|pornstar|pawnstar)\b", re.I), "Ponstan"),

    # Panadol / Panadol CF
    (re.compile(r"\b(?:panda\s*doll|pana\s*doll|panadoll|panador)\s*c\s*f\b", re.I), "Panadol CF"),
    (re.compile(r"\b(?:panda\s*doll|pana\s*doll|panadoll|panador)\b", re.I), "Panadol"),

    # Flagyl
    (re.compile(r"\b(?:fragile|flannel|flag\s*ill|flag\s*all)\b", re.I), "Flagyl"),

    # Brufen
    (re.compile(r"\b(?:brew\s*fan|blue\s*fan|broofen|roofin|brew\s*fin)\b", re.I), "Brufen"),

    # Disprin
    (re.compile(r"\b(?:this\s*print|dis\s*print|this\s*spring|desperate)\b", re.I), "Disprin"),

    # Augmentin
    (re.compile(r"\b(?:argument\s*in|argumentation|aug\s*mention|aug\s*mentin)\b", re.I), "Augmentin"),

    # Entamizole
    (re.compile(r"\b(?:anti\s*missile|anti\s*misole|inter\s*misole)\b", re.I), "Entamizole"),

    # Cac 1000
    (re.compile(r"\b(?:cat\s*1000|crack\s*1000|cat\s*thousand|cac\s*thousand)\b", re.I), "Cac-1000"),

    # Risek
    (re.compile(r"\b(?:rice\s*cake|rise\s*sec|ryse\s*sec)\b", re.I), "Risek"),

    # Ceftum / Cefspan
    (re.compile(r"\b(?:chef\s*tum|safe\s*thumb|safe\s*tom)\b", re.I), "Ceftum"),
    (re.compile(r"\b(?:safe\s*span|chef\s*span)\b", re.I), "Cefspan"),

    # Hydryllin / Sancos
    (re.compile(r"\b(?:high\s*drilling|hydro\s*line)\b", re.I), "Hydryllin"),
    (re.compile(r"\b(?:sun\s*cause|some\s*cost)\b", re.I), "Sancos"),

    # Gravinate / Arinac
    (re.compile(r"\b(?:gravy\s*net|graduate)\b", re.I), "Gravinate"),
    (re.compile(r"\b(?:arena|ari\s*nak)\b", re.I), "Arinac"),

    # Loprin / Avil / Kestine
    (re.compile(r"\b(?:law\s*print|low\s*print)\b", re.I), "Loprin"),
    (re.compile(r"\b(?:evil\s*25|evil\s*tablet)\b", re.I), "Avil 25mg"),
    (re.compile(r"\b(?:kiss\s*teen)\b", re.I), "Kestine"),
    (re.compile(r"\b(?:motel\s*yum)\b", re.I), "Motilium"),
]

# Profanity and inappropriate word guardrail (fallback scrubber)
INAPPROPRIATE_TOKENS = [
    r"\bxxx\b", r"\bsex\b", r"\bnude\b", r"\bnsfw\b", r"\bbitch\b", r"\bass\b",
    r"\bfuck\b", r"\bshit\b", r"\bdick\b", r"\bpussy\b"
]


def sanitize_and_correct_voice_transcript(text: str) -> str:
    """Apply phonetic medicine corrections and safety guardrails to speech transcripts."""
    if not text:
        return ""

    cleaned = text.strip()

    # Step 1: Apply phonetic brand corrections
    for pattern, replacement in PHONETIC_MEDICINE_MAP:
        if pattern.search(cleaned):
            logger.info(f"Voice Guardrail: Corrected phonetic confusion in '{cleaned}' using rule -> '{replacement}'")
            cleaned = pattern.sub(replacement, cleaned)

    # Step 2: Remove remaining isolated adult / offensive tokens that didn't match medicine patterns
    for token_pattern in INAPPROPRIATE_TOKENS:
        cleaned = re.sub(token_pattern, "", cleaned, flags=re.IGNORECASE)

    # Step 3: Clean excess spacing
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned
