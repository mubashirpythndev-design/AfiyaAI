import {ShieldCheck} from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import LegalLinks from "./LegalLinks";
import {MEDICAL_DISCLAIMER} from "@/lib/constants";
import type {Language} from "@/lib/types";
import {t} from "@/lib/i18n";
export default function Footer({language="en"}:{language?:Language}) {return <footer className="site-footer"><div className="page-shell"><div className="footer-notice"><ShieldCheck size={21}/><div><h4>{t(language,"footer.disclaimerTitle")}</h4><p>{MEDICAL_DISCLAIMER}</p></div></div><div className="footer-bottom"><div className="wordmark"><BrandLogo/><span><span className="brand-name">Afiya.</span><span className="brand-subtitle">Medicine, made clearer</span></span></div><p>{t(language,"footer.builtFor")} · {new Date().getFullYear()}</p><p>{language==="ur"?"معلومات۔ موازنہ۔ تنظیم۔":language==="roman_ur"?"Maloomat. Muqabla. Tanzeem.":"Information. Comparison. Organisation."}</p></div></div><LegalLinks language={language}/></footer>;}
