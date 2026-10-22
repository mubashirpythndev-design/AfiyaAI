"use client";
import {useRef,useState} from "react";
import {AlertTriangle,Send,CheckCircle2} from "lucide-react";
import {submitConciergeRx,uploadStorePrescription,type StoreOrder} from "@/lib/api";
import {errorMessage} from "@/lib/marketplace";
import {useMarketplace} from "./MarketplaceProvider";
import {button,secondary,ErrorBanner} from "./MarketplaceUI";
import DemoNotice from "./DemoNotice";

export default function OCRBusyFallback({file}:{file:File}) {
  const store=useMarketplace();
  const [order,setOrder]=useState<StoreOrder|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const submitting=useRef(false),attachment=useRef<string|null>(null);
  async function send() {
    if(submitting.current||order||!store.requireAuth())return;
    submitting.current=true;setBusy(true);setError(null);
    try {
      // Reuse an uploaded reference if order submission fails; never rescan with AI.
      attachment.current??=(await uploadStorePrescription(file)).prescription_image_url;
      const created=await submitConciergeRx({prescription_image_url:attachment.current,
        customer_note:"Prescription sent for manual pharmacist review after OCR service unavailability."});
      setOrder(created);
    } catch(error){setError(errorMessage(error));}
    finally{submitting.current=false;setBusy(false);}
  }
  return <section role="status" aria-live="polite" className={`max-w-4xl mx-auto my-6 rounded-2xl border p-5 sm:p-6 space-y-4 ${order?"border-emerald-300 bg-emerald-50 text-emerald-950":"border-amber-300 bg-amber-50 text-amber-950"}`}>
    {store.catalog.some(item=>item.is_demo_seller)&&<DemoNotice/>}{order?<><h2 className="flex gap-2 items-center text-lg font-bold"><CheckCircle2 size={22}/>Prescription sent to the pharmacist</h2><p className="text-sm">Your request is awaiting a pharmacist-built cart. You can review the medicines and total before placing an order.</p><p className="text-xs break-all">Reference: {order.id} · {order.status}</p><button className={secondary} onClick={store.openOrders}>View My Orders</button></>:<><h2 className="flex gap-2 items-center text-lg font-bold"><AlertTriangle size={22}/>All AI OCR models are temporarily busy.</h2><p className="text-sm leading-relaxed">Don’t worry! Send your prescription directly to a pharmacist, who can review the image and build your cart manually.</p><p className="text-xs">Selected photo: {file.name}. This skips the AI queue; pharmacist review is not instantaneous. Demo sellers remain labeled in the store.</p><ErrorBanner message={error}/><button className={button} disabled={busy} onClick={()=>void send()}><Send size={16}/>{busy?"Sending prescription…":"Send Rx to Pharmacist (Zero Wait)"}</button></>}
  </section>;
}
