"use client";
import {useEffect,useState,type ReactNode} from "react";
import {X} from "lucide-react";
import useModalFocus from "@/components/shared/useModalFocus";
import {getAuthToken} from "@/lib/auth";
import {errorMessage} from "@/lib/marketplace";

export const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const secondary = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border border-border bg-surface hover:bg-surface-hover disabled:opacity-40";
export const input = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export function ErrorBanner({message}: {message:string | null}) { return message ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{message}</div> : null; }
export function Panel({title,onClose,children,drawer=false}: {title:string;onClose:()=>void;children:ReactNode;drawer?:boolean}) {
  const ref = useModalFocus(true,onClose);
  return <div className={`fixed inset-0 z-[100] flex ${drawer?"justify-end":"items-center justify-center p-3"}`}>
    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true"/>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`relative flex flex-col bg-background text-foreground shadow-2xl w-full ${drawer?"max-w-xl h-dvh motion-safe:animate-slide-up":"max-w-2xl max-h-[92dvh] rounded-3xl"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border p-5"><h2 className="text-xl font-bold">{title}</h2><button className={secondary} aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>
      <div className="overflow-y-auto overscroll-contain p-5 space-y-5">{children}</div>
    </div>
  </div>;
}
export function PrescriptionImage({url,zoom=false}: {url:string;zoom?:boolean}) {
  const [src,setSrc] = useState<string|null>(null);
  const [error,setError] = useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false, objectUrl:string|undefined;
    setSrc(null);setError(null);
    async function load() {
      try {
        if (url.startsWith("https://")) { if(!cancelled)setSrc(url); return; }
        if (!/^\/uploads\/[a-f0-9-]{36}$/.test(url)) throw new Error("This prescription reference cannot be previewed.");
        const token=await getAuthToken();
        const response=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:"no-store"});
        if(!response.ok)throw new Error("Could not load this private prescription. Retry or request a new attachment.");
        objectUrl=URL.createObjectURL(await response.blob());
        if(!cancelled)setSrc(objectUrl);
      } catch(error) {if(!cancelled)setError(errorMessage(error));}
    }
    void load();
    return()=>{cancelled=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[url]);
  return <div className={`overflow-auto rounded-xl border border-border bg-surface ${zoom?"max-h-[70vh]":"max-h-96"}`}><ErrorBanner message={error}/>{src ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="Attached prescription for pharmacist review" onError={()=>setError("The prescription image could not be displayed.")} className={zoom?"max-w-none w-[150%]":"w-full h-auto object-contain"}/> : !error && <p className="p-6 text-sm" role="status">Loading private prescription…</p>}</div>;
}
