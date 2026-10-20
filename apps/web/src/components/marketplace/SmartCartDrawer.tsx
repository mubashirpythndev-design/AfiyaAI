"use client";
import {useEffect,useRef,useState} from "react";
import {ShieldAlert,ArrowRightLeft,Trash2} from "lucide-react";
import {checkoutCart,evaluateCart,uploadStorePrescription,type CartEvaluation,type StoreOrder} from "@/lib/api";
import type {Language} from "@/lib/types";
import {errorMessage,price,switchCartItem,text,statusLabel} from "@/lib/marketplace";
import {useMarketplace} from "./MarketplaceProvider";
import {button,secondary,input,Panel,ErrorBanner} from "./MarketplaceUI";

export default function SmartCartDrawer({isOpen,onClose}:{isOpen:boolean;onClose:()=>void}) {
  const store=useMarketplace();
  const [lang,setLang]=useState<Language>("en"),[evaluation,setEvaluation]=useState<CartEvaluation|null>(null);
  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[evaluating,setEvaluating]=useState(false);
  const [order,setOrder]=useState<StoreOrder|null>(null),[note,setNote]=useState("");
  const serial=useRef(0),submitting=useRef(false);
  useEffect(()=>{
    if(!isOpen)return;
    const current=++serial.current,controller=new AbortController();
    setEvaluation(null);setError(null);setEvaluating(true);
    const timer=setTimeout(()=>{evaluateCart({items:store.items,prescription_attached:!!store.attachment,lang},controller.signal)
      .then(value=>{if(serial.current===current)setEvaluation(value);}).catch(error=>{if(serial.current===current&&!controller.signal.aborted)setError(errorMessage(error));})
      .finally(()=>{if(serial.current===current)setEvaluating(false);});},250);
    return()=>{serial.current++;clearTimeout(timer);controller.abort();};
  },[isOpen,store.items,store.attachment,lang]);
  useEffect(()=>{if(isOpen)setOrder(null);},[isOpen]);
  async function checkout() {
    if(submitting.current||!evaluation?.can_checkout||evaluating||!store.requireAuth())return;
    submitting.current=true;setBusy(true);setError(null);
    try {
      const attachment=store.attachment?await uploadStorePrescription(store.attachment):null;
      const created=await checkoutCart({items:store.items,prescription_image_url:attachment?.prescription_image_url,customer_note:note||undefined});
      setOrder(created);store.setItems([]);store.setAttachment(null);setNote("");void store.refreshCatalog();
    } catch(error){setError(errorMessage(error));}finally{submitting.current=false;setBusy(false);}
  }
  if(!isOpen)return null;
  return <Panel title="Smart Cart" drawer onClose={()=>{if(!busy)onClose();}}>
    {order ? <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 space-y-3"><h3 className="font-bold">Order received</h3><p>{statusLabel[order.status]}</p><p className="text-sm">{order.status==="PENDING_RX_REVIEW"?"A pharmacist must review your prescription before confirmation.":"Your order is confirmed. This local demo does not take payment or arrange delivery."}</p><p className="text-xs break-all">Reference: {order.id}</p><button className={button} onClick={()=>{onClose();store.openOrders();}}>View my orders</button></div> : <>
    <p className="text-sm text-muted">Quantities are whole packs. Prices and availability are checked again before placing your order.</p>
    <label className="block text-xs">Warning language<select className={input} value={lang} onChange={event=>setLang(event.target.value as Language)}><option value="en">English</option><option value="ur">اردو</option><option value="roman_ur">Roman Urdu</option></select></label>
    <ErrorBanner message={error}/>
    {!store.items.length&&<p className="py-8 text-center text-muted">Your cart is empty. Browse the store catalog to get started.</p>}
    {store.items.map(item=>{
      const med=store.catalog.find(row=>row.medicine_id===item.medicine_id), suggestion=evaluation?.switch_suggestions.find(row=>row.from_medicine_id===item.medicine_id);
      return <article key={item.medicine_id} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex justify-between gap-3"><div><h3 className="font-bold">{med?.brand_name??"Unavailable medicine"} {med?.strength}</h3><p className="text-xs text-muted">{med?.generic_name} · {med?.dosage_form} · {med?.pack_size}</p><span className="text-xs font-semibold text-primary">{med?.requires_prescription?"Rx Required":"OTC"}</span></div><p className="text-sm font-semibold">{price(med?.selling_price)}<small className="block text-muted font-normal">per pack</small></p></div>
        <div className="flex items-center gap-3"><button aria-label={`Decrease ${med?.brand_name??"quantity"}`} className={secondary} disabled={busy||item.quantity<=1} onClick={()=>store.setItems(rows=>rows.map(row=>row.medicine_id===item.medicine_id?{...row,quantity:row.quantity-1}:row))}>−</button><span aria-live="polite">{item.quantity} pack{item.quantity!==1?"s":""}</span><button aria-label={`Increase ${med?.brand_name??"quantity"}`} className={secondary} disabled={busy||item.quantity>=Math.min(10000,med?.stock_quantity??0)} onClick={()=>store.setItems(rows=>rows.map(row=>row.medicine_id===item.medicine_id?{...row,quantity:row.quantity+1}:row))}>+</button><button className={secondary} disabled={busy} onClick={()=>store.setItems(rows=>rows.filter(row=>row.medicine_id!==item.medicine_id))}><Trash2 size={14}/>Remove</button></div>
        {suggestion&&<div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-950 text-sm space-y-2"><p className="font-semibold">Save {price(suggestion.savings_pkr)} ({Number(suggestion.savings_pct).toFixed(1)}%): switch to {suggestion.brand_name}</p><p className="text-xs">Same stored generic, strength and form. {suggestion.target_quantity} pack(s) of {suggestion.pack_size}. Confirm suitability with your pharmacist.</p><button className={button} disabled={busy} onClick={()=>{try{store.setItems(switchCartItem(store.items,item.medicine_id,suggestion));}catch(error){setError(errorMessage(error));}}}><ArrowRightLeft size={15}/>1-Click Switch</button></div>}
      </article>;
    })}
    {evaluation?.duplication_warnings.map((warning,index)=><div key={index} className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-4 space-y-3" dir={lang==="ur"?"rtl":"ltr"}><p className="font-semibold flex gap-2"><ShieldAlert size={18}/>{warning.severity} · Possible therapeutic overlap</p><p className="text-sm">{warning.message}</p><div className="flex flex-wrap gap-2">{warning.medicines.map(med=><button key={med.medicine_id} className={secondary} disabled={busy} onClick={()=>store.setItems(items=>items.filter(item=>item.medicine_id!==med.medicine_id))}>Remove duplicate: {med.brand_name}</button>)}</div>{evaluation.duplication_lock&&<p className="text-sm">For your safety, attach your doctor’s prescription to request pharmacist review of this overlap.</p>}</div>)}
    {evaluation?.rx_gate_lock&&<div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-4"><h3 className="font-bold">Prescription required</h3><p className="text-sm">{evaluation.rx_required_items.map(item=>item.brand_name).join(", ")} — attach a prescription before requesting checkout.</p></div>}
    {!!store.items.length&&<><label className="block space-y-2 text-sm font-medium">Doctor’s prescription (JPEG, PNG or WebP, up to 8 MB)<input className={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file&&file.size>8*1024*1024){setError("Choose an image under 8 MB.");event.target.value="";return;}store.setAttachment(file??null);}}/></label>
    {store.attachment&&<div className="text-sm flex justify-between items-center gap-2"><span>Attached: {store.attachment.name} · pharmacist review required</span><button disabled={busy} className={secondary} onClick={()=>store.setAttachment(null)}>Remove photo</button></div>}
    <label className="block text-sm">Note for your pharmacist<textarea className={input} maxLength={2000} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label>
    <div className="border-t border-border pt-4 space-y-2" aria-live="polite"><p className="flex justify-between font-bold"><span>Total</span><span>{evaluation?price(evaluation.cart_total_pkr):"Checking…"}</span></p><p className="flex justify-between text-sm"><span>Estimated savings</span><span>{evaluation?price(evaluation.total_savings_pkr):"—"}</span></p>
    {evaluation&&!evaluation.can_checkout&&<p className="text-sm text-red-800">{evaluation.lock_reasons.map(reason=>reason.toLowerCase().replaceAll("_"," ")).join(" · ")}</p>}
    {evaluation?.stock_shortages.map(row=><p key={row.medicine_id} className="text-sm text-red-800">Only {row.available} pack(s) available; requested {row.requested}.</p>)}
    <button className={button+" w-full"} disabled={busy||evaluating||!evaluation?.can_checkout} onClick={()=>void checkout()}>{busy?"Submitting order…":evaluating?"Checking your cart…":text(lang,"Proceed to checkout","آرڈر جمع کریں","Order jama karein")}</button>
    <p className="text-xs text-muted">{evaluation?.disclaimer??"Medicine changes require advice from a doctor or pharmacist."}</p></div></>}
    </>}
  </Panel>;
}
