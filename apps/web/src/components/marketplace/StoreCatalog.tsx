"use client";
import {useState} from "react";
import {ShoppingBag,Stethoscope} from "lucide-react";
import {useMarketplace} from "./MarketplaceProvider";
import {price,text} from "@/lib/marketplace";
import type {Language} from "@/lib/types";
import {button,secondary,input,ErrorBanner} from "./MarketplaceUI";
export function AddToCartButton({medicineId,language="en"}:{medicineId:string;language?:Language}) {
  const store=useMarketplace(),med=store.catalog.find(item=>item.medicine_id===medicineId);
  return <button type="button" className={secondary} disabled={!med?.available||store.catalogLoading} onClick={()=>store.addItems([{medicine_id:medicineId,quantity:1}])}>{text(language,"+ Add to Cart","+ کارٹ میں شامل کریں","+ Cart mein shamil karein")}{!store.catalogLoading&&!med?.available&&<span className="text-xs"> · unavailable</span>}</button>;
}
export default function StoreCatalog({language,prescriptionFile}:{language:Language;prescriptionFile:File|null}) {
  const store=useMarketplace(),[query,setQuery]=useState("");
  const filtered=store.catalog.filter(item=>`${item.brand_name} ${item.generic_name} ${item.category??""}`.toLowerCase().includes(query.toLowerCase()));
  return <section id="store-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-primary font-semibold">Afiya pharmacy marketplace / local demo</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{text(language,"Browse the store catalog","دوا کی کیٹلاگ دیکھیں","Dawai ki catalog dekhein")}</h2><p className="mt-2 text-sm text-muted max-w-2xl">Stored DRAP-aligned price references, clear pack sizes and pharmacist review. Demo sellers are labeled; a stored reference does not establish clinical suitability.</p></div><button className={button} onClick={()=>store.openConcierge(prescriptionFile)}><Stethoscope size={17}/>Send Rx to pharmacist</button></div>
    <div className="flex flex-wrap gap-3"><label className="flex-1 min-w-48"><span className="sr-only">Search store catalog</span><input className={input} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search brand, generic or category"/></label><button className={secondary} disabled={store.catalogLoading} onClick={()=>void store.refreshCatalog()}>Refresh availability</button><button className={secondary} onClick={store.openCart}><ShoppingBag size={17}/>Smart Cart ({store.items.reduce((sum,item)=>sum+item.quantity,0)})</button></div>
    <ErrorBanner message={store.catalogError}/>{store.catalogLoading&&<p role="status" className="text-sm text-muted">Loading store catalog…</p>}
    {!store.catalogLoading&&!store.catalogError&&!filtered.length&&<p className="text-muted py-6">No medicines match this search.</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(med=><article key={med.medicine_id} className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3"><div className="flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-primary/10 text-primary px-2 py-1">{med.requires_prescription?"Rx Required":"OTC"}</span><span className="rounded-full bg-surface-hover px-2 py-1">{med.notified_mrp!==null?"DRAP-aligned MRP reference":"Unverified demo price"}</span></div><h3 className="text-lg font-bold">{med.brand_name} <span className="text-sm font-normal">{med.strength}</span></h3><p className="text-xs text-muted">{med.generic_name} · {med.dosage_form}</p><p className="font-semibold">{price(med.selling_price)} <span className="text-xs font-normal text-muted">/ pack ({med.pack_size||"size not recorded"})</span></p><p className="text-xs text-muted">Reference MRP: {price(med.notified_mrp)} · {med.stock_quantity} packs in stock</p><p className="text-xs text-muted">{med.seller_name??"No seller assigned"}{med.is_demo_seller?" · Demo seller":""}</p>{med.batch_recalled&&<p className="text-xs text-red-800">Batch on hold — unavailable for purchase</p>}<div className="mt-auto"><AddToCartButton medicineId={med.medicine_id} language={language}/></div></article>)}</div>
  </section>;
}
