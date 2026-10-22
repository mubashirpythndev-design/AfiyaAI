// Application constants

import type { Language } from "./types";

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

export interface CategoryItem {
  id: string;              // Exact database category key
  icon: string;            // Visual emoji icon
  name: string;            // User-friendly condition/symptom name
  medicalTerm: string;     // Scientific/pharmacological classification
  nameUrdu: string;        // Urdu translation
  nameRomanUrdu: string;   // Roman Urdu translation
}

export const CATEGORY_ITEMS: CategoryItem[] = [
  {
    id: "Analgesic / Antipyretic",
    icon: "💊",
    name: "Pain & Fever",
    medicalTerm: "Analgesics / Antipyretics",
    nameUrdu: "درد اور بخار",
    nameRomanUrdu: "Dard aur Bukhar",
  },
  {
    id: "Antibiotic (Broad Spectrum)",
    icon: "🦠",
    name: "General Bacterial Infections",
    medicalTerm: "Broad-Spectrum Antibiotics",
    nameUrdu: "عام جراثیمی انفیکشن",
    nameRomanUrdu: "Aam Bacterial Infection",
  },
  {
    id: "Antibiotic (Fluoroquinolone)",
    icon: "🦠",
    name: "Typhoid & Severe Infections",
    medicalTerm: "Fluoroquinolones",
    nameUrdu: "ٹائیفائیڈ اور شدید انفیکشن",
    nameRomanUrdu: "Typhoid aur Severe Infection",
  },
  {
    id: "Antibiotic (Cephalosporin)",
    icon: "🦠",
    name: "Chest, Throat & ENT",
    medicalTerm: "Cephalosporins",
    nameUrdu: "گلے، سینے اور کان کا انفیکشن",
    nameRomanUrdu: "Chest aur Galay ka Infection",
  },
  {
    id: "Antacid / Anti-ulcer",
    icon: "🫁",
    name: "Acidity, Heartburn & Ulcer",
    medicalTerm: "Antacids & Gastric Care",
    nameUrdu: "معدے کی تیزابیت اور جلن",
    nameRomanUrdu: "Meday ki Tezabiyat aur Jalan",
  },
  {
    id: "Antihistamine / Anti-allergy",
    icon: "🤧",
    name: "Allergy, Flu & Sneezing",
    medicalTerm: "Antihistamines",
    nameUrdu: "الرجی، نزلہ اور چھینکیں",
    nameRomanUrdu: "Allergy, Nazla aur Cheenkain",
  },
  {
    id: "Anti-diabetic",
    icon: "🩸",
    name: "Diabetes & Blood Sugar",
    medicalTerm: "Blood Glucose Control",
    nameUrdu: "شوگر اور ذیابیطس",
    nameRomanUrdu: "Sugar aur Diabetes Control",
  },
  {
    id: "Anti-hypertensive",
    icon: "❤️",
    name: "High Blood Pressure & Heart",
    medicalTerm: "Cardiovascular Care",
    nameUrdu: "بلڈ پریشر اور امراضِ قلب",
    nameRomanUrdu: "Blood Pressure aur Dil ka Ilaj",
  },
  {
    id: "Antiemetic / GI Tract",
    icon: "🫄",
    name: "Nausea, Vomiting & Motion",
    medicalTerm: "Antiemetic / GI Relief",
    nameUrdu: "متلی، قے اور پیٹ کی خرابی",
    nameRomanUrdu: "Matli, Qay aur Pait ki Kharabi",
  },
  {
    id: "Lipid-lowering Agent",
    icon: "🧪",
    name: "High Cholesterol & Lipids",
    medicalTerm: "Lipid Management (Statins)",
    nameUrdu: "کولیسٹرول اور چربی کنٹرول",
    nameRomanUrdu: "Cholesterol Control",
  },
  {
    id: "Bronchodilator / Respiratory",
    icon: "🌬️",
    name: "Asthma, Cough & Breathing",
    medicalTerm: "Respiratory Bronchodilators",
    nameUrdu: "دمہ، کھانسی اور سانس کی تکلیف",
    nameRomanUrdu: "Khansi, Dama aur Saans",
  },
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

export function getCategoryDisplayName(categoryKey: string, language: Language = "en"): string {
  const item = CATEGORY_ITEMS.find((c) => c.id.toLowerCase() === (categoryKey || "").toLowerCase());
  if (!item) return categoryKey;
  if (language === "ur") return item.nameUrdu;
  if (language === "roman_ur") return item.nameRomanUrdu;
  return item.name;
}

export function getCategoryMedicalTerm(categoryKey: string): string {
  const item = CATEGORY_ITEMS.find((c) => c.id.toLowerCase() === (categoryKey || "").toLowerCase());
  return item ? item.medicalTerm : categoryKey;
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
];
