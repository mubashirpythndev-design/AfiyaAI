"use client";
import {useState,useRef} from "react";
import {submitConciergeRx,uploadStorePrescription} from "@/lib/api";
import {errorMessage} from "@/lib/marketplace";
import {useMarketplace} from "./MarketplaceProvider";
import {button,secondary,input,Panel,ErrorBanner} from "./MarketplaceUI";
export default function ConciergeRxModal({isOpen,onClose,onSent}:{isOpen:boolean;onClose:()=>void;onSent:()=>void}) {
  const store=useMarketplace();const [note,setNote]=useState(""),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);const submitting=useRef(false);
  async function send() {
    if(!store.attachment||submitting.current||!store.requireAuth())return;
    submitting.current=true;setBusy(true);setError(null);
    try {const uploaded=await uploadStorePrescription(store.attachment);await submitConciergeRx({...uploaded,customer_note:note||undefined});store.setAttachment(null);setNote("");onSent();}
    catch(error){setError(errorMessage(error));}finally{setBusy(false);submitting.current=false;}
  }
  if(!isOpen)return null;
  return <Panel title="Send prescription to pharmacist" onClose={()=>{if(!busy)onClose();}}><p className="text-sm text-muted">Prefer a person to read your prescription? Send a clear photo directly to the pharmacist queue. No OCR processing is needed. A pharmacist will prepare a cart for your approval.</p><ErrorBanner message={error}/><label className="block text-sm space-y-2">Prescription photo<input type="file" className={input} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file&&file.size>8*1024*1024){setError("Select an image under 8 MB.");event.target.value="";return;}store.setAttachment(file??null);}}/></label>{store.attachment&&<p className="text-sm">Selected: {store.attachment.name} <button className={secondary} disabled={busy} onClick={()=>store.setAttachment(null)}>Remove</button></p>}<label className="block text-sm">Optional note<textarea className={input} placeholder="For example: please confirm the pack quantities" value={note} maxLength={2000} disabled={busy} onChange={event=>setNote(event.target.value)}/></label><button className={button+" w-full"} disabled={!store.attachment||busy} onClick={()=>void send()}>{busy?"Sending prescription…":"Send to Pharmacist (Zero AI Wait)"}</button><p className="text-xs text-muted">Local demo: images are stored privately on this computer. This is a review request, not an instant order or prescription approval.</p></Panel>;
}
