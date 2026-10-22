"use client";
import { useEffect, useRef, useState } from "react";
import type { Language, MedicineCandidate, OCRResponse } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { ScanOverlay, ScanProgress } from "./PrescriptionScanProgress";

type Props = { file: File | null; data: OCRResponse; language: Language; busy: boolean; scanning?: boolean; onRemove: () => void;
  onEdit: (index: number | null, candidate: MedicineCandidate) => Promise<void>;
  onRescan: (region?: number[]) => Promise<void> };
export default function OCRReview({ file, data, language, busy, scanning = false, onRemove, onEdit, onRescan }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [selecting,setSelecting] = useState(false);
  const [region,setRegion] = useState<number[] | null>(null);
  const [editing,setEditing] = useState<number | null | undefined>(undefined);
  const [name,setName] = useState("");
  const [strength,setStrength] = useState("");
  const [form,setForm] = useState("");
  const [working,setWorking] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const start = useRef<number[] | null>(null);
  const text = (en: string,ur: string,roman: string) => language === "ur" ? ur : language === "roman_ur" ? roman : en;
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const value = URL.createObjectURL(file); setUrl(value); setRegion(null); setSelecting(false); setEditing(undefined);
    return () => URL.revokeObjectURL(value);
  },[file]);
  const disabled = busy || working;
  const openEdit = (index: number | null) => {
    const candidate = index === null ? null : data.candidates[index];
    setEditing(index); setName(candidate?.unreadable ? "" : candidate?.detected_brand || candidate?.detected_generic || candidate?.raw_text || "");
    setStrength(candidate?.detected_strength || ""); setForm(candidate?.detected_form || ""); setError(null);
    if (candidate?.bbox) setRegion(candidate.bbox);
  };
  const task = async (fn: () => Promise<void>) => {
    setWorking(true); setError(null);
    try { await fn(); } catch(e) { setError(e instanceof Error ? e.message : "Could not finish review."); }
    finally { setWorking(false); }
  };
  const point = (event: React.PointerEvent) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return [Math.round(Math.max(0,Math.min(1000,(event.clientY-rect.top)/rect.height*1000))),Math.round(Math.max(0,Math.min(1000,(event.clientX-rect.left)/rect.width*1000)))];
  };
  const save = () => {
    if (!name.trim() || editing === undefined) { setError(text("Enter the medicine name you can read on the prescription.","نسخے پر نظر آنے والی دوا کا نام درج کریں۔","Nuskhe par nazar aane wali dawa ka naam dein.")); return; }
    const old = editing === null ? null : data.candidates[editing];
    void task(async () => {
      await onEdit(editing, { ...(old ?? {}), raw_text: [name.trim(),strength.trim(),form].filter(Boolean).join(" "),
        confidence: old?.confidence ?? 0, raw_line: old?.raw_line ?? "Manually added after image review", is_verified:false,
        detected_brand:name.trim(), detected_generic:null, detected_strength:strength.trim(), detected_form:form || null,
        unreadable:false,reviewed:true,user_edited:true,needs_confirmation:false,matched_medicine:null, correction_suggestion:null, alternative_reading:null, form_conflict:false, clinical_purpose:null, bbox:old?.bbox ?? region });
      setEditing(undefined);
    });
  };
  return <section className="rounded-2xl border border-primary/30 bg-surface p-4 space-y-3" dir={language === "ur" ? "rtl" : undefined}>
    <h3 className="font-bold text-foreground">{text("Review prescription coverage","نسخے کی تمام ادویات چیک کریں","Nuskhe ki tamam dawaiyan check karein")}</h3>
    <p className="text-xs text-muted">{text("Compare every line with the original. Enable region selection, then drag over an unclear region to rescan it; add or correct missing names. Confirm each entry before saving it to the cabinet.","اصل نسخے کی ہر سطر سے موازنہ کریں۔ حصہ منتخب کرنے کا اختیار کھولیں، پھر غیر واضح حصے کو منتخب کر کے دوبارہ اسکین کریں، نام شامل یا درست کریں۔ کیبنٹ میں محفوظ کرنے سے پہلے ہر دوا کی تصدیق کریں۔","Original nuskhe ki har line compare karein. Region selection on karein, phir unclear hissa select karke rescan karein, missing naam add ya correct karein. Cabinet mein save karne se pehle har entry confirm karein.")}</p>
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded bg-background border border-border px-2 py-1">{data.candidates.length} {text("entries","اندراجات","entries")}{data.medicine_line_count != null ? " / " + data.medicine_line_count + " " + text("model-counted lines","ماڈل کی گنی گئی سطریں","model-counted lines") : ""}</span>
      <span className="rounded bg-warning/10 text-warning px-2 py-1">{text("AI reading requires human review","اے آئی کی ریڈنگ انسانی تصدیق چاہتی ہے","AI reading ko insani review chahiye")}</span>
    </div>
    {data.warnings?.map((warning,index) => <p className="text-xs text-warning" key={index}>{warning}</p>)}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2">
        {url && <div className="max-h-[520px] overflow-auto rounded-xl border border-border bg-white">
          <div ref={imageRef} aria-busy={scanning} className={"relative select-none " + (selecting ? "touch-none" : "touch-pan-y")} onPointerDown={event => { if (disabled || !selecting) return; start.current = point(event); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => { if (!start.current) return; const p = point(event); if (p) setRegion([Math.min(start.current[0],p[0]),Math.min(start.current[1],p[1]),Math.max(start.current[0],p[0]),Math.max(start.current[1],p[1])]); }}
            onPointerUp={event => { if (start.current) { const p=point(event); if(p) { const box=[Math.min(start.current[0],p[0]),Math.min(start.current[1],p[1]),Math.max(start.current[0],p[0]),Math.max(start.current[1],p[1])]; setRegion(box[2]-box[0]>3 && box[3]-box[1]>3 ? box : null); } start.current=null; } }} onPointerCancel={() => { start.current=null; }}>
            <img src={url} alt={text("Original prescription for comparison","النسخے کی اصل تصویر","Comparison ke liye original nuskha")} className="block w-full h-auto" draggable={false}/>
            {scanning && <ScanOverlay/>}
            {region && <div className="pointer-events-none absolute border-2 border-primary bg-primary/10" style={{top:region[0]/10+"%",left:region[1]/10+"%",height:(region[2]-region[0])/10+"%",width:(region[3]-region[1])/10+"%"}}/>}
          </div>
        </div>}
        {scanning && <ScanProgress language={language}/>}
        <div className="flex flex-wrap gap-2">
          {file && <button type="button" onClick={onRemove} className="prescription-remove"><Trash2 size={15} aria-hidden="true"/>{text("Remove image","تصویر ہٹائیں","Tasveer hataein")}</button>}
          <button type="button" disabled={disabled || !file} aria-pressed={selecting} onClick={() => setSelecting(value => !value)} className="text-xs px-3 py-2 rounded border border-border">{selecting ? text("Finish selecting region","حصے کا انتخاب بند کریں","Region selection band karein") : text("Select a region","حصہ منتخب کریں","Region select karein")}</button>
          <button type="button" disabled={disabled || !file} onClick={() => { void task(() => onRescan()); }} className="text-xs px-3 py-2 rounded bg-primary text-white disabled:opacity-50">{text("Fresh full scan","نیا مکمل اسکین","Fresh full scan")}</button>
          <button type="button" disabled={disabled || !region || !file} onClick={() => { if(region) void task(() => onRescan(region)); }} className="text-xs px-3 py-2 rounded border border-primary text-primary disabled:opacity-50">{text("Rescan selected region","منتخب حصہ دوبارہ اسکین کریں","Selected hissa rescan karein")}</button>
          <button type="button" disabled={disabled} onClick={() => setRegion(null)} className="text-xs text-muted">{text("Clear region","حصہ صاف کریں","Region clear karein")}</button>
        </div>
      </div>
      <div className="space-y-2">
        {data.candidates.map((candidate,index) => <div className="rounded-lg border border-border p-3 space-y-1" key={candidate.line_id ?? index}>
          <p className="text-sm font-semibold">{candidate.raw_text}</p>
          <p className="text-xs text-muted">{candidate.raw_line}</p>
          {candidate.correction_suggestion && <p className="text-xs text-warning">{text("Catalog spelling suggestion:","ڈیٹا بیس کے مطابق نام:","Catalog spelling suggestion:")} {candidate.correction_suggestion}</p>}
          {candidate.alternative_reading && <p className="text-xs text-warning">{text("Another reading:","دوسری ریڈنگ:","Doosri reading:")} {candidate.alternative_reading}</p>}
          {candidate.form_conflict && <p className="text-xs text-warning">{text("The form readings disagree. Check the written form against the image.","دوا کی شکل کی ریڈنگ مختلف ہے۔ اصل تصویر سے چیک کریں۔","Form ki readings mukhtalif hain. Original tasveer se form check karein.")}</p>}
          {candidate.matched_medicine && <p className="text-xs text-primary">{text("Catalog record:","ڈیٹا بیس ریکارڈ:","Catalog record:")} {candidate.matched_medicine.brand_name} {candidate.matched_medicine.strength} {candidate.matched_medicine.dosage_form}</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" disabled={disabled} onClick={() => openEdit(index)} className="text-primary underline">{text("Edit / correct","درست کریں","Edit / correct")}</button>
            {candidate.bbox && <button type="button" disabled={disabled} onClick={() => setRegion(candidate.bbox!)} className="text-primary underline">{text("Show region","حصہ دکھائیں","Hissa dikhayein")}</button>}
            <button type="button" disabled={disabled || candidate.unreadable || candidate.reviewed} onClick={() => { void task(() => onEdit(index,{...candidate,reviewed:true,needs_confirmation:false})); }} className="text-primary underline disabled:opacity-50">{candidate.reviewed ? text("Reviewed","چیک ہو گیا","Reviewed") : text("Confirm this reading","اس ریڈنگ کی تصدیق کریں","Is reading ko confirm karein")}</button>
          </div>
        </div>)}
        <button type="button" disabled={disabled} onClick={() => openEdit(null)} className="text-sm text-primary font-semibold">{text("+ Add missing medicine","+ چھوٹی ہوئی دوا شامل کریں","+ Missing dawa add karein")}</button>
        {editing !== undefined && <div className="border border-primary/30 rounded-xl p-3 space-y-2">
          <label className="block text-xs">{text("Name on prescription","نسخے پر نام","Nuskhe par naam")}<input value={name} maxLength={200} onChange={e => setName(e.target.value)} className="block w-full mt-1 p-2 rounded border border-border bg-background"/></label>
          <label className="block text-xs">{text("Strength if written","لکھی ہوئی طاقت","Strength agar likhi hai")}<input value={strength} maxLength={100} onChange={e => setStrength(e.target.value)} className="block w-full mt-1 p-2 rounded border border-border bg-background"/></label>
          <label className="block text-xs">{text("Form if known","معلوم شکل","Form agar maloom hai")}<select value={form} onChange={e => setForm(e.target.value)} className="block w-full mt-1 p-2 rounded border border-border bg-background"><option value="">{text("Not clear","واضح نہیں","Clear nahi")}</option>{["Tablet","Capsule","Syrup","Suspension","Injection","Inhaler","Drops","Cream","Ointment","Gel","Lotion","Bar","Spray","Shampoo","Solution","Wash","Mouthwash","Powder","Patch","Suppository","Pessary","Paste","Foam","Emulsion"].map(value => <option key={value}>{value}</option>)}</select></label>
          <button type="button" disabled={disabled} onClick={save} className="rounded px-3 py-2 text-xs bg-primary text-white disabled:opacity-50">{text("Apply correction","درستگی محفوظ کریں","Correction apply karein")}</button>
          <button type="button" disabled={disabled} onClick={() => setEditing(undefined)} className="text-xs ml-3">{text("Cancel","منسوخ","Cancel")}</button>
        </div>}
      </div>
    </div>
    {working && <p role="status" className="text-xs text-primary">{text("Reading / updating…","پڑھ رہا ہے…","Reading / updating…")}</p>}
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
  </section>;
}
