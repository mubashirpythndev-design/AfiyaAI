"use client";
import {useEffect,useState,type ReactNode} from "react";
import {X,ShoppingBag,ClipboardList,Stethoscope} from "lucide-react";
import useModalFocus from "@/components/shared/useModalFocus";
import {fetchStorePrescription} from "@/lib/api";
import {errorMessage} from "@/lib/marketplace";

export const button = "market-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const secondary = "market-secondary inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border border-border bg-surface hover:bg-surface-hover disabled:opacity-40";
export const input = "market-input w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export function ErrorBanner({message}: {message:string | null}) { return message ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{message}</div> : null; }
export function Panel({title,onClose,children,drawer=false}: {title:string;onClose:()=>void;children:ReactNode;drawer?:boolean}) {
  const ref = useModalFocus(true,onClose);
  const Icon=title==="Smart Cart"?ShoppingBag:title==="My orders"?ClipboardList:Stethoscope;
  return <div className={`market-panel fixed inset-0 z-[100] flex ${drawer?"justify-end":"items-center justify-center p-3"}`}>
    <div className="market-panel-backdrop absolute inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden="true"/>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`market-dialog relative flex min-w-0 flex-col bg-background text-foreground shadow-2xl w-full ${drawer?"market-drawer max-w-xl h-dvh":"max-w-2xl max-h-[92dvh] rounded-3xl"}`}>
      <div className="market-panel-heading"><span className="market-panel-icon"><Icon size={22} strokeWidth={1.6}/></span><div><p>YOUR PHARMACY</p><h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>
      <div className="market-panel-body overflow-y-auto overscroll-contain space-y-5">{children}</div>
    </div>
  </div>;
}
export function PrescriptionImage({url,zoom=false}: {url:string;zoom?:boolean}) {
  const [src,setSrc] = useState<string|null>(null);
  const [error,setError] = useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false, objectUrl:string|undefined;
    const controller = new AbortController();
    setSrc(null);setError(null);
    async function load() {
      try {
        if (url.startsWith("https://")) { if(!cancelled)setSrc(url); return; }
        if (!/^\/uploads\/[a-f0-9-]{36}$/.test(url)) throw new Error("This prescription reference cannot be previewed.");
        const image = await fetchStorePrescription(url,controller.signal);
        if(cancelled)return;
        objectUrl=URL.createObjectURL(image);
        if(!cancelled)setSrc(objectUrl);
      } catch(error) {if(!cancelled)setError(errorMessage(error));}
    }
    void load();
    return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[url]);
  return <div className={`overflow-auto rounded-xl border border-border bg-surface ${zoom?"max-h-[70vh]":"max-h-96"}`}><ErrorBanner message={error}/>{src ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="Attached prescription for pharmacist review" onError={()=>setError("The prescription image could not be displayed.")} className={zoom?"max-w-none w-[150%]":"w-full h-auto object-contain"}/> : !error && <p className="p-6 text-sm" role="status">Loading private prescription…</p>}</div>;
}
