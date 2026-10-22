import Link from "next/link";
import type {Language} from "@/lib/types";
export default function LegalLinks({language="en"}:{language?:Language}){
  const text=(en:string,ur:string,roman:string)=>language==="ur"?ur:language==="roman_ur"?roman:en;
  return <div className="page-shell footer-legal"><nav aria-label="Legal and privacy"><Link href="/privacy">{text("Privacy Policy","رازداری کی پالیسی","Privacy Policy")}</Link><Link href="/terms">{text("Terms of Service","استعمال کی شرائط","Istemaal ki sharaait")}</Link><Link href="/#feedback">{text("Contact the team","ٹیم سے رابطہ","Team se rabta")}</Link></nav><p>{text("Information and reference prices. No diagnosis or prescribing.","معلومات اور حوالہ جاتی قیمتیں۔ کوئی تشخیص یا دوا تجویز نہیں کی جاتی۔","Maloomat aur reference qeematein. Diagnosis ya dawa prescribe nahi ki jati.")}</p></div>;
}
