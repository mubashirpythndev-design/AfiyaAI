// Application constants

// Resolve API_BASE_URL: Prefer NEXT_PUBLIC_API_URL if set; otherwise in browser outside localhost use Railway production backend.
const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "https://afiyaai-production.up.railway.app";
    }
  }
  return "http://localhost:8000";
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
export const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
