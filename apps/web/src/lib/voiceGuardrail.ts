/**
 * Afiya AI — Voice Search Phonetic Normalizer & Safety Guardrail.
 *
 * Catches and fixes acoustic speech-to-text misrecognitions of Pakistani
 * medicine brand names (e.g. 'Ponstan Forte' misrecognized as 'porn star forte' or 'corn star',
 * 'Panadol' as 'panda doll', 'Flagyl' as 'fragile', etc.)
 * Also strips unwanted acoustic profanity artifacts to ensure medical search safety.
 */

interface PhoneticRule {
  pattern: RegExp;
  replacement: string;
}

const PHONETIC_RULES: PhoneticRule[] = [
  // Ponstan / Ponstan Forte (Critical acoustic confusion fix)
  {
    pattern: /\b(?:porn\s*star|pornstar|pawn\s*star|corn\s*star|point\s*star)\s*forte\b/gi,
    replacement: "Ponstan Forte",
  },
  {
    pattern: /\b(?:porn\s*star|pornstar|pawn\s*star|corn\s*star|point\s*star|pon\s*stan)\b/gi,
    replacement: "Ponstan",
  },
  {
    pattern: /\b(?:porn|pornstar|pawnstar)\b/gi,
    replacement: "Ponstan",
  },

  // Panadol / Panadol CF
  {
    pattern: /\b(?:panda\s*doll|pana\s*doll|panadoll|panador)\s*c\s*f\b/gi,
    replacement: "Panadol CF",
  },
  {
    pattern: /\b(?:panda\s*doll|pana\s*doll|panadoll|panador)\b/gi,
    replacement: "Panadol",
  },

  // Flagyl
  {
    pattern: /\b(?:fragile|flannel|flag\s*ill|flag\s*all)\b/gi,
    replacement: "Flagyl",
  },

  // Brufen
  {
    pattern: /\b(?:brew\s*fan|blue\s*fan|broofen|roofin|brew\s*fin)\b/gi,
    replacement: "Brufen",
  },

  // Disprin
  {
    pattern: /\b(?:this\s*print|dis\s*print|this\s*spring|desperate)\b/gi,
    replacement: "Disprin",
  },

  // Augmentin
  {
    pattern: /\b(?:argument\s*in|argumentation|aug\s*mention|aug\s*mentin)\b/gi,
    replacement: "Augmentin",
  },

  // Entamizole
  {
    pattern: /\b(?:anti\s*missile|anti\s*misole|inter\s*misole)\b/gi,
    replacement: "Entamizole",
  },

  // Cac 1000
  {
    pattern: /\b(?:cat\s*1000|crack\s*1000|cat\s*thousand|cac\s*thousand)\b/gi,
    replacement: "Cac-1000",
  },

  // Risek
  {
    pattern: /\b(?:rice\s*cake|rise\s*sec|ryse\s*sec)\b/gi,
    replacement: "Risek",
  },

  // Ceftum / Cefspan
  {
    pattern: /\b(?:chef\s*tum|safe\s*thumb|safe\s*tom)\b/gi,
    replacement: "Ceftum",
  },
  {
    pattern: /\b(?:safe\s*span|chef\s*span)\b/gi,
    replacement: "Cefspan",
  },

  // Hydryllin / Sancos
  {
    pattern: /\b(?:high\s*drilling|hydro\s*line)\b/gi,
    replacement: "Hydryllin",
  },
  {
    pattern: /\b(?:sun\s*cause|some\s*cost)\b/gi,
    replacement: "Sancos",
  },

  // Gravinate / Arinac
  {
    pattern: /\b(?:gravy\s*net|graduate)\b/gi,
    replacement: "Gravinate",
  },
  {
    pattern: /\b(?:arena|ari\s*nak)\b/gi,
    replacement: "Arinac",
  },

  // Loprin / Avil / Kestine / Motilium
  {
    pattern: /\b(?:law\s*print|low\s*print)\b/gi,
    replacement: "Loprin",
  },
  {
    pattern: /\b(?:evil\s*25|evil\s*tablet)\b/gi,
    replacement: "Avil 25mg",
  },
  {
    pattern: /\b(?:kiss\s*teen)\b/gi,
    replacement: "Kestine",
  },
  {
    pattern: /\b(?:motel\s*yum)\b/gi,
    replacement: "Motilium",
  },
];

const INAPPROPRIATE_TOKENS: RegExp[] = [
  /\bxxx\b/gi,
  /\bsex\b/gi,
  /\bnude\b/gi,
  /\bnsfw\b/gi,
  /\bbitch\b/gi,
  /\bass\b/gi,
  /\bfuck\b/gi,
  /\bshit\b/gi,
  /\bdick\b/gi,
  /\bpussy\b/gi,
];

/**
 * Normalizes speech recognition transcripts for medicine search.
 * 1. Corrects acoustic misrecognitions of Pakistani brand names.
 * 2. Cleanses accidental profanity or inappropriate phonetic slips.
 */
export function applyVoiceGuardrail(rawTranscript: string): string {
  if (!rawTranscript) return "";

  let cleaned = rawTranscript.trim();

  // Step 1: Apply phonetic brand corrections
  for (const { pattern, replacement } of PHONETIC_RULES) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, replacement);
    }
  }

  // Step 2: Strip any remaining isolated adult/profane words
  for (const token of INAPPROPRIATE_TOKENS) {
    cleaned = cleaned.replace(token, "");
  }

  // Step 3: Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}
