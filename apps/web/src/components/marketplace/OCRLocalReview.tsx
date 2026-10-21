"use client";
import {useState} from "react";
import type {MedicineCandidate,MedicineDetail} from "@/lib/types";
import {useMarketplace} from "./MarketplaceProvider";
import OCRCartStaging from "./OCRCartStaging";
import {button,input,secondary} from "./MarketplaceUI";
import {price as money} from "@/lib/marketplace";

export default function OCRLocalReview({file,rawText,demoItems=[]}:{file:File;rawText:string;demoItems?:MedicineDetail[]}) {
  const store=useMarketplace();
  const [name,setName]=useState(""),[items,setItems]=useState<MedicineCandidate[]>([]);
  const [showDemo,setShowDemo]=useState(demoItems.length>0),[swaps,setSwaps]=useState<Record<string,string>>({});
  const examples=demoItems.length?demoItems:store.catalog.filter(med=>/^(panadol|augmentin)(?:\s|$)/i.test(med.brand_name));
  function addWrittenName(event:React.FormEvent) {
    event.preventDefault();const text=name.trim();if(!text)return;
    setItems(current=>[...current,{raw_text:text,raw_line:text,original_name:text,confidence:0,
      is_verified:false,needs_confirmation:true,user_edited:true,reviewed:false,line_id:`manual-${current.length+1}`}]);
    setName("");
  }
  return <section className="max-w-4xl mx-auto mb-6 rounded-2xl border border-border bg-surface p-5 space-y-5">
    <div><h2 className="text-lg font-bold">Review the scan</h2><p className="text-sm text-muted mt-1">No medicine was added automatically. You can enter a name exactly as written or ask the pharmacist to identify it. Do not use example medicines to fill gaps in your prescription.</p></div>
    <details open={!!rawText}><summary className="cursor-pointer text-sm font-semibold">Recognized text — unverified</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border p-3 text-sm">{rawText||"No readable text was returned. Try a clearer photo or use manual review below."}</pre></details>
    <form onSubmit={addWrittenName} className="space-y-2"><label className="block text-sm font-semibold" htmlFor="manual-prescription-name">Medicine name exactly as written</label><div className="flex flex-col sm:flex-row gap-2"><input id="manual-prescription-name" className={input} value={name} maxLength={200} onChange={event=>setName(event.target.value)} placeholder="Enter only a name you can read on the image"/><button className={button} disabled={!name.trim()}>Add for review</button></div></form>
    {items.length>0&&<><p className="text-xs text-muted">The following names were entered by you, not extracted by OCR. Select the exact catalog medicine and confirm it against the image.</p><OCRCartStaging candidates={items} file={file} busy={false}/><button type="button" className={secondary} onClick={()=>setItems([])}>Clear manually entered names</button></>}
    <div className="border-t border-border pt-4 space-y-3"><button type="button" className={secondary} aria-expanded={showDemo} onClick={()=>setShowDemo(value=>!value)}>{showDemo?"Hide catalog demo":"Show catalog demo (not my prescription)"}</button>
      {showDemo&&<div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-900 p-4 space-y-3"><h3 className="font-bold">Demo cart preview — example catalog items only</h3><p className="text-sm">These medicines were not detected in your image and are not recommendations. This preview does not add anything to your real cart, attach your prescription or place an order.</p>
        {examples.length===0&&<p className="text-sm">Catalog examples are unavailable. Manual entry and pharmacist review are still available above.</p>}
        {examples.slice(0,2).map(example=>{
          const id=example.id??("medicine_id" in example?String(example.medicine_id):"");
          const currentId=swaps[id]??id;
          const med=store.catalog.find(row=>row.medicine_id===currentId);
          const alternative=med?.cheapest_alternative;
          return <div key={id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"><p className="font-semibold">{med?.brand_name??example.brand_name} · {med?.strength??example.strength} · {med?.dosage_form??example.dosage_form}</p><p className="text-sm">{med?.selling_price!=null?`Catalog pack price: ${money(med.selling_price)}`:"Catalog price unavailable"}</p>{alternative&&<button type="button" className={secondary} onClick={()=>setSwaps(previous=>({...previous,[id]:alternative.medicine_id}))}>Preview Switch &amp; Save: {alternative.brand_name} · {money(alternative.savings_pkr)} estimated savings</button>}</div>;
        })}
      </div>}
    </div>
  </section>;
}
