import { ArrowUpRight, BookOpen, ChevronDown } from "lucide-react";
import type { Language } from "@/lib/types";

// The compiled catalog names this portal, but its records remain pending verification.
// This attribution must not imply that DRAP supplied or endorsed clinical explanations.
export default function DataSourceNotice({ language }: { language: Language }) {
  const text = (en: string, ur: string, roman: string) =>
    language === "ur" ? ur : language === "roman_ur" ? roman : en;

  return (
    <aside className="source-notice" aria-label={text("Data sources", "معلومات کے ذرائع", "Maloomat ke sources")}>
      <div className="page-shell source-notice-row">
        <BookOpen size={19} strokeWidth={1.6} aria-hidden="true" className="source-notice-icon" />
        <div className="source-notice-copy">
          <p>
            <span>{text("Catalog reference", "کیٹلاگ کا حوالہ", "Catalog ka reference")}</span>
            <a href="https://e.dra.gov.pk/public/price" target="_blank" rel="noopener noreferrer">
              {text("DRAP price portal", "DRAP قیمتوں کا پورٹل", "DRAP price portal")}
              <ArrowUpRight size={13} aria-hidden="true" />
              <span className="sr-only">{text("(opens in a new tab)", "(نئے ٹیب میں کھلے گا)", "(naye tab mein khulega)")}</span>
            </a>
          </p>
          <p className="source-verification-note">{text(
            "Compiled reference data. Individual records still require source verification.",
            "مرتب کردہ حوالہ معلومات۔ ہر اندراج کی ماخذ سے تصدیق ابھی باقی ہے۔",
            "Compiled reference data. Har record ki source se tasdeeq abhi baqi hai."
          )}</p>
        </div>
        <details className="source-details">
          <summary>{text("About the data", "معلومات کے بارے میں", "Data ke bare mein")}<ChevronDown size={14} aria-hidden="true" /></summary>
          <p>{text(
            "Our stored catalog cites the DRAP price portal alongside compiled market research. This is not a live DRAP feed or a claim that every entry is verified. The portal reference applies to catalog and price data, not prescription transcription or clinical explanations. Afiya is independent and is not affiliated with or endorsed by DRAP. Check each medicine’s source and date, and confirm current details with your pharmacist.",
            "ہمارا محفوظ کیٹلاگ مرتب شدہ مارکیٹ تحقیق کے ساتھ DRAP قیمتوں کے پورٹل کا حوالہ دیتا ہے۔ یہ DRAP کی براہ راست فیڈ یا ہر اندراج کی تصدیق کا دعویٰ نہیں ہے۔ پورٹل کا حوالہ کیٹلاگ اور قیمتوں کے لیے ہے، نسخہ پڑھنے یا طبی وضاحتوں کے لیے نہیں۔ افیہ آزاد پلیٹ فارم ہے اور DRAP سے وابستہ یا اس کا توثیق شدہ نہیں ہے۔ ہر دوا کا ماخذ اور تاریخ دیکھیں اور موجودہ معلومات فارماسسٹ سے تصدیق کریں۔",
            "Hamara stored catalog compiled market research ke saath DRAP price portal ka reference deta hai. Yeh live DRAP feed ya har entry verified hone ka claim nahi hai. Portal ka reference catalog aur qeematon ke liye hai, prescription transcription ya clinical explanations ke liye nahi. Afiya independent hai aur DRAP se affiliated ya endorsed nahi hai. Har dawai ka source aur date dekhein aur current details pharmacist se confirm karein."
          )}</p>
        </details>
      </div>
    </aside>
  );
}
