"use client";
import {useState} from "react";
import {SignInButton, UserButton, useUser} from "@clerk/nextjs";
import {Archive, Menu, X} from "lucide-react";
import MarketplaceHeaderActions from "@/components/marketplace/MarketplaceHeaderActions";
import type {Language,AuthUser} from "@/lib/types";
import {LANGUAGES} from "@/lib/constants";
import ThemeToggle from "@/components/shared/ThemeToggle";
import BrandLogo from "@/components/shared/BrandLogo";
type Props={language:Language;onLanguageChange:(language:Language)=>void;user:AuthUser|null;onSignIn:()=>void;onSignOut:()=>void;onOpenCabinet?:()=>void;onOpenGuide?:()=>void;onOpenFeedback?:()=>void;onNavigateHome?:(section?:string)=>void};
export default function Header({language,onLanguageChange,user,onSignOut,onOpenCabinet,onOpenGuide,onOpenFeedback,onNavigateHome}:Props){
 const {isSignedIn}=useUser(); const [menuOpen,setMenuOpen]=useState(false);
 const text=(en:string,ur:string,roman:string)=>language==="ur"?ur:language==="roman_ur"?roman:en;
 const navigate=()=>{window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});onNavigateHome?.();setMenuOpen(false);};
 const languageControl=<div className="language-control" aria-label="Choose language">{LANGUAGES.map(lang=><button key={lang.code} onClick={()=>onLanguageChange(lang.code)} aria-label={lang.label} aria-pressed={language===lang.code}>{lang.code==="en"?"EN":lang.code==="ur"?"اردو":"RU"}</button>)}</div>;
 const links=<><a href="#categories" onClick={e=>{e.preventDefault();onNavigateHome?.("categories");setMenuOpen(false);}}>{text("Medicine directory","دواؤں کی فہرست","Dawaiyon ki fehrist")}</a><button onClick={()=>{onOpenGuide?.();setMenuOpen(false);}}>{text("How it works","استعمال کا طریقہ","Istemaal ka tareeqa")}</button><button onClick={()=>{onOpenFeedback?.();setMenuOpen(false);}}>{text("Feedback","رائے دیں","Raye dein")}</button></>;
 return <header className="site-header"><div className="page-shell"><div className="header-row">
 <button onClick={navigate} className="wordmark" aria-label="Afiya home"><BrandLogo priority/><span><span className="brand-name">Afiya<span className="text-primary">.</span></span><span className="brand-subtitle">Medicine, made clearer</span></span></button>
 <nav className="header-nav" aria-label="Main navigation">{links}</nav>
 <div className="header-actions">{(isSignedIn||user)&&onOpenCabinet&&<button onClick={onOpenCabinet} className="header-cabinet" aria-label="Open My Cabinet"><Archive size={18}/><span>{text("My cabinet","میری کیبنٹ","Meri cabinet")}</span></button>}
 <div className="desktop-preferences flex items-center gap-2"><ThemeToggle/>{languageControl}</div>
 {isSignedIn?<UserButton appearance={{elements:{avatarBox:"w-8 h-8 border border-border"}}}/>:user?<button className="quiet-link" onClick={onSignOut}>{text("Sign out","لاگ آؤٹ","Sign out")}</button>:<SignInButton mode="modal"><button className="header-signin">{text("Sign in","سائن ان","Sign in")}</button></SignInButton>}
 <button className="icon-button mobile-menu-button" aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X size={18}/>:<Menu size={18}/>}</button></div>
 </div><MarketplaceHeaderActions onBrowse={()=>onNavigateHome?.("store-catalog")}/>{menuOpen&&<nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{links}<div className="mobile-preferences">{languageControl}<ThemeToggle/></div></nav>}</div></header>;
}
