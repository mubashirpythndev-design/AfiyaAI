// Application constants

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const MEDICAL_DISCLAIMER =
  "This information is for educational purposes only and is not a substitute for professional medical advice. Always consult a qualified healthcare provider for diagnosis, treatment, and answers to your personal medical questions.";

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
