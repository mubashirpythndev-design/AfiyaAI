import Link from "next/link";
import type {ReactNode} from "react";
import {ArrowLeft,ArrowUpRight} from "lucide-react";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
import Footer from "@/components/layout/Footer";

export type LegalSection={id:string;title:string;content:ReactNode};
export default function LegalPage({title,description,sections}:{title:string;description:string;sections:LegalSection[]}) {
  return <><header className="legal-header"><div className="page-shell"><Link href="/" className="wordmark" aria-label="Afiya home"><BrandLogo/><span className="brand-name">Afiya.</span></Link><nav aria-label="Legal pages"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><ThemeToggle/></nav></div></header>
    <main className="page-shell legal-page"><Link href="/" className="quiet-link"><ArrowLeft size={15}/>Back to Afiya</Link><div className="legal-intro"><p className="eyebrow"><span className="eyebrow-rule"/>TRANSPARENCY & TRUST</p><h1>{title}</h1><p>{description}</p><span>Last updated: 22 October 2026</span></div>
    <div className="legal-layout"><nav className="legal-contents" aria-label={`${title} contents`}><p>ON THIS PAGE</p>{sections.map(section=><a key={section.id} href={`#${section.id}`}>{section.title}<ArrowUpRight size={13}/></a>)}</nav><div className="legal-copy">{sections.map((section,index)=><section id={section.id} key={section.id}><p className="legal-section-number">{String(index+1).padStart(2,"0")}</p><h2>{section.title}</h2>{section.content}</section>)}</div></div></main><Footer/></>;
}
