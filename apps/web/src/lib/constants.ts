// Application constants

// Resolve API_BASE_URL: Explicitly requires NEXT_PUBLIC_API_URL in production.
const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "");
  }
  // In development / local environment, default to local backend
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8000";
  }
  // In production, fail clearly if NEXT_PUBLIC_API_URL is missing
  if (typeof window !== "undefined") {
    console.error(
      "[Afiya AI] Configuration Error: NEXT_PUBLIC_API_URL is not set. " +
      "Please set NEXT_PUBLIC_API_URL in your Vercel environment variables."
    );
  }
  return "";
};

export const API_BASE_URL = getApiBaseUrl();

export const MEDICAL_DISCLAIMER =
  "This information is for educational and price comparison purposes only and is not a substitute for professional medical advice. Comparison data is aligned with DRAP baseline references; always verify current pharmacy availability and prices with official sources. Always consult a qualified healthcare provider for diagnosis and treatment.";

export const LANGUAGES = [
  { code: "en" as const, label: "English", flag: "EN" },
  { code: "ur" as const, label: "اردو", flag: "UR" },
  { code: "roman_ur" as const, label: "Roman Urdu", flag: "RU" },
];

export const CATEGORY_ICONS: Record<string, string> = {
  "Analgesic / Antipyretic": "💊",
  "Antibiotic (Broad Spectrum)": "🦠",
  "Antibiotic (Fluoroquinolone)": "🦠",
  "Antibiotic (Cephalosporin)": "🦠",
  "Antacid / Anti-ulcer": "🫁",
  "Antihistamine / Anti-allergy": "🤧",
  "Anti-diabetic": "🩸",
  "Anti-hypertensive": "❤️",
  "Antiemetic / GI Tract": "🫄",
  "Lipid-lowering Agent": "🧪",
  "Bronchodilator / Respiratory": "🌬️",
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
];
