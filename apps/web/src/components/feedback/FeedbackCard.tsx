"use client";
import {ArrowUpRight} from "lucide-react";
import type {Language} from "@/lib/types";
export default function FeedbackCard({onOpenModal,language="en"}:{onOpenModal:()=>void;language?:Language}){
 const text=(en:string,ur:string,roman:string)=>language==="ur"?ur:language==="roman_ur"?roman:en;
 return <div className="feedback-panel" dir={language==="ur"?"rtl":undefined}><div><p className="eyebrow">{text("BUILT WITH YOUR INPUT","آپ کی رائے کے ساتھ","AAP KI RAYE KE SAATH")}</p><h3>{text("Help make everyday care simpler.","روزمرہ کی دیکھ بھال آسان بنانے میں مدد دیں۔","Rozmarah ki dekh bhaal asaan banane mein madad dein.")}</h3><p>{text("Tell us what works, what could be clearer, and what you would like to see next.","بتائیں کیا اچھا ہے، کیا واضح ہو سکتا ہے اور آپ مزید کیا دیکھنا چاہتے ہیں۔","Batayein kya acha hai, kya mazeed wazeh ho sakta hai aur aap agay kya dekhna chahte hain.")}</p></div><button onClick={onOpenModal}>{text("Share your feedback","اپنی رائے دیں","Apni raye dein")}<ArrowUpRight size={17}/></button></div>;
}
