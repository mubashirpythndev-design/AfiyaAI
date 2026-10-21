"use client";
import {useEffect,useState} from "react";
import type {MedicineCandidate,MedicineDetail} from "@/lib/types";
import {matchMedicine} from "@/lib/api";
import {useMarketplace} from "./MarketplaceProvider";
import {button,input,ErrorBanner} from "./MarketplaceUI";
import {errorMessage} from "@/lib/marketplace";
type Row={choices:MedicineDetail[];selected:string;confirmed:boolean;error?:string};
export default function OCRCartStaging({candidates,file,busy}:{candidates:MedicineCandidate[];file:File|null;busy:boolean}) {
  const store=useMarketplace();const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();let live=true,next=0;
    setRows([]);setLoading(true);setError(null);
    const result:Row[]=candidates.map(()=>({choices:[],selected:"",confirmed:false}));
    async function worker(){while(next<candidates.length){const index=next++,candidate=candidates[index];
      if(candidate.unreadable) {result[index].error="Unreadable line: ask your pharmacist to identify it.";continue;}
      try{
        const match=await matchMedicine(candidate.raw_text,candidate.detected_strength,candidate.detected_form,{signal:controller.signal});
        const choices=[match.medicine,...(match.alternatives??[]),candidate.matched_medicine,match.lasa_warning?.candidate_a,match.lasa_warning?.candidate_b].filter((med):med is MedicineDetail=>!!med);
        const unique=Array.from(new Map(choices.map(med=>[med.id,med])).values());
        const confident=match.medicine&&!match.needs_confirmation&&!match.lasa_warning?.confirmation_required&&match.confidence>=0.85&&candidate.confidence>=0.85&&!candidate.form_conflict&&match.strength_assessment?.status!=="STRENGTH_MISMATCH"&&match.form_assessment?.status!=="FORM_MISMATCH";
        result[index]={choices:unique,selected:confident?match.medicine!.id:"",confirmed:false};
      }catch(error){result[index]={choices:[],selected:"",confirmed:false,error:errorMessage(error)};}
    }}
    void Promise.all(Array.from({length:Math.min(4,candidates.length)},worker)).then(()=>{if(live){setRows(result);setLoading(false);}});
    return()=>{live=false;controller.abort();};
  },[candidates]);
  const confirmed=Array.from(new Set(rows.filter(row=>row.confirmed&&row.selected).map(row=>row.selected)));
  const available=confirmed.every(id=>store.catalog.some(med=>med.medicine_id===id&&med.available));
  return <section className="rounded-2xl border border-primary/25 bg-surface p-5 space-y-4"><h3 className="font-bold text-lg">Review your prescription before shopping</h3><p className="text-sm text-muted">1. Confirm the exact name, strength and form. 2. Choose explicitly when a match is uncertain. 3. Your original photo will accompany the cart for pharmacist review. Each selection adds one whole pack; no dose is inferred.</p><ErrorBanner message={error}/>{loading&&<p role="status">Checking exact catalog matches…</p>}
    {rows.map((row,index)=><div key={candidates[index].line_id??index} className="rounded-xl border border-border p-3 space-y-2"><p className="text-sm font-semibold">{candidates[index].user_edited ? "Entered by you:" : "Scanned:"} {candidates[index].raw_text}</p>{row.error&&<p className="text-xs text-red-800">{row.error}</p>}{row.choices.length>0?<label className="block text-xs">Exact medicine<select className={input} value={row.selected} disabled={busy} onChange={event=>setRows(current=>current.map((item,i)=>i===index?{...item,selected:event.target.value,confirmed:false}:item))}><option value="">Choose brand, strength and form…</option>{row.choices.map(med=><option value={med.id} key={med.id}>{med.brand_name} · {med.strength} · {med.dosage_form}</option>)}</select></label>:<p className="text-xs text-muted">No confident catalog identity. Use “Send Rx to pharmacist” instead.</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={row.confirmed} disabled={!row.selected||busy} onChange={event=>setRows(current=>current.map((item,i)=>i===index?{...item,confirmed:event.target.checked}:item))}/>I confirm this medicine matches my prescription.</label></div>)}
    {!file&&<p className="text-sm text-red-800">Select the original prescription photo before adding these items.</p>}{confirmed.length>0&&!available&&<p className="text-sm text-red-800">Some selected medicines are unavailable. Refresh the catalog or ask the pharmacist to prepare your cart.</p>}
    <button className={button+" w-full"} disabled={busy||loading||!file||!confirmed.length||!available} onClick={()=>{store.addItems(confirmed.map(medicine_id=>({medicine_id,quantity:1})),file);setRows(current=>current.map(row=>({...row,confirmed:false})));}}>Add Confirmed Items to Smart Cart ({confirmed.length})</button>
    <button className="text-sm font-semibold text-primary" onClick={()=>store.openConcierge(file)}>Messy handwriting? Send Rx to pharmacist</button>
  </section>;
}
