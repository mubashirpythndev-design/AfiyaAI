import { LoaderCircle, ScanLine } from "lucide-react";
import type { Language } from "@/lib/types";

export function ScanOverlay() {
  return <div className="prescription-scan-overlay" aria-hidden="true">
    <span className="prescription-scan-corner"/>
    <span className="prescription-scan-beam"/>
    <span className="prescription-scan-mark"><ScanLine size={20}/></span>
  </div>;
}

export function ScanProgress({ language }: { language: Language }) {
  const text = (en: string, ur: string, roman: string) => language === "ur" ? ur : language === "roman_ur" ? roman : en;
  return <div className="prescription-scan-status" role="status" aria-live="polite" aria-atomic="true" dir={language === "ur" ? "rtl" : undefined}>
    <div className="prescription-scan-status-heading"><LoaderCircle size={20} className="animate-spin" aria-hidden="true"/>
      <strong>{text("Scanning your prescription","آپ کا نسخہ اسکین ہو رہا ہے","Aap ka nuskha scan ho raha hai")}</strong>
    </div>
    <p>{text("Reading medicine names and checking the prescription. Please wait for the results.","دواؤں کے نام پڑھ رہے ہیں اور نسخہ چیک کر رہے ہیں۔ نتائج کا انتظار کریں۔","Dawaiyon ke naam parh rahe hain aur nuskha check kar rahe hain. Results ka intezar karein.")}</p>
    <div className="prescription-scan-track" aria-hidden="true"><span/></div>
  </div>;
}
