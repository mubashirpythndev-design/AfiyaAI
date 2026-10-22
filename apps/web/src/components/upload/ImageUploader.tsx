"use client";

/**
 * Afiya AI — Advanced Prescription Vision Uploader & Scanner
 * Author / Developer: Mubashir (Lead Developer)
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { Upload, Camera, FileImage, ScanLine, Trash2, CircleAlert } from "lucide-react";
import { ScanOverlay, ScanProgress } from "./PrescriptionScanProgress";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  file: File | null;
  onImageRemoved: () => void;
  isProcessing: boolean;
  showProgress?: boolean;
  language?: Language;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

export default function ImageUploader({
  onImageSelected,
  file,
  onImageRemoved,
  isProcessing,
  showProgress = isProcessing,
  language = "en",
  isAuthenticated = true,
  onRequireAuth,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const removeImage = () => {
    setPreview(null);
    setError(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    onImageRemoved();
  };

  const handleFile = useCallback(
    (file: File) => {
      if (isProcessing) return;
      if (!isAuthenticated && onRequireAuth) {
        onRequireAuth();
        return;
      }
      const isValidType =
        ALLOWED_FILE_TYPES.includes((file.type || "").toLowerCase()) ||
        /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!isValidType) {
        setError(t(language, "upload.invalidType"));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(t(language, "upload.tooLarge"));
        return;
      }
      setError(null);
      onImageSelected(file);
    },
    [onImageSelected, language, isAuthenticated, onRequireAuth, isProcessing]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (isProcessing) return;
      setDragOver(false);
      if (!isAuthenticated && onRequireAuth) {
        onRequireAuth();
        return;
      }
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, isAuthenticated, onRequireAuth, isProcessing]
  );

  // Generates a quick sample prescription image for instant judge/user demo testing
  const handleSamplePrescription = () => {
    if (!isAuthenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rx Pad background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 800, 600);

    // Header border
    ctx.fillStyle = "#0d9488";
    ctx.fillRect(40, 30, 720, 4);

    // Clinic Header
    ctx.font = "bold 26px sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("CITY MEDICAL CLINIC & CONSULTANCY", 40, 75);

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Dr. Tariq Mahmood (MBBS, FCPS) — Reg: PMC-48291", 40, 100);
    ctx.fillText("Date: " + new Date().toLocaleDateString(), 600, 100);

    // Divider
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 120);
    ctx.lineTo(760, 120);
    ctx.stroke();

    // Patient info
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText("Patient: Ahmed Khan (Age: 38 / Male)", 40, 150);

    // Rx Symbol
    ctx.font = "bold 44px serif";
    ctx.fillStyle = "#0d9488";
    ctx.fillText("℞", 40, 220);

    // Prescribed Medicines list
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("1. Augmentin 625mg Tablet", 100, 240);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("   1 tab twice daily after meal — 5 days", 100, 270);

    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("2. Panadol 500mg Tablet", 100, 330);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("   1-2 tabs for fever / body ache", 100, 360);

    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("3. Risek 20mg Capsule", 100, 420);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("   1 cap before breakfast daily — 14 days", 100, 450);

    // Doctor Signature
    ctx.font = "italic 22px cursive";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("Dr. Tariq M.", 600, 540);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Doctor's Signature & Stamp", 580, 565);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "sample_prescription_demo.png", { type: "image/png" });
        handleFile(file);
      }
    }, "image/png");
  };

  const text=(en:string,ur:string,roman:string)=>language==="ur"?ur:language==="roman_ur"?roman:en;
  const openFile=(camera=false)=>{if(isProcessing)return;if(!isAuthenticated&&onRequireAuth){onRequireAuth();return;}(camera?cameraInputRef:fileInputRef).current?.click();};
  return <div>
    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)handleFile(file);e.target.value="";}}/>
    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)handleFile(file);e.target.value="";}}/>
    <div className="upload-dropzone" data-drag={dragOver} onDragOver={e=>{e.preventDefault();if(!isProcessing)setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop}>
      <div className="upload-content"><span className="upload-icon"><FileImage size={23} strokeWidth={1.5}/></span><div><h3>{dragOver?t(language,"upload.titleDrag"):text("Read your prescription.","اپنا نسخہ پڑھیں۔","Apna nuskha parhein.")}</h3><p>{text("Drop a clear photo here, or choose an image from your device.","یہاں واضح تصویر ڈالیں یا اپنے آلے سے منتخب کریں۔","Yahan clear tasveer drop karein ya apne device se choose karein.")}</p><div className="upload-actions"><button type="button" disabled={isProcessing} onClick={()=>openFile()}><Upload size={15}/>{preview?t(language,"upload.changeImage"):text("Upload prescription","نسخہ اپ لوڈ کریں","Nuskha upload karein")}</button><button type="button" disabled={isProcessing} onClick={()=>openFile(true)}><Camera size={15}/>{text("Camera","کیمرہ","Camera")}</button></div></div></div>
      {file&&<div className="prescription-preview-heading"><span>{file.name}</span><button type="button" onClick={removeImage} className="prescription-remove"><Trash2 size={15} aria-hidden="true"/>{text("Remove image","تصویر ہٹائیں","Tasveer hataein")}</button></div>}
      {preview&&<div className="prescription-preview-frame" aria-busy={showProgress}><Image unoptimized fill sizes="(max-width: 700px) 100vw, 540px" src={preview} alt={text("Uploaded prescription","اپ لوڈ شدہ نسخہ","Uploaded nuskha")} className="upload-preview"/>{showProgress&&<ScanOverlay/>}</div>}
      {showProgress&&<ScanProgress language={language}/>}
    </div>
    <div className="upload-meta"><button type="button" disabled={isProcessing} onClick={handleSamplePrescription}><ScanLine size={14}/>{text("Try a sample","نمونہ دیکھیں","Sample try karein")}</button><span>JPG, PNG, WebP · {text("up to 10 MB","زیادہ سے زیادہ 10 MB","10 MB tak")}</span></div>
    <p className="scan-disclosure">{text("AI-assisted reading. Check every medicine against the original before saving.","اے آئی معاون ریڈنگ۔ محفوظ کرنے سے پہلے ہر دوا اصل نسخے سے ملائیں۔","AI-assisted reading. Save karne se pehle har dawa original nuskhe se milayein.")}</p>
    <p className="scan-disclosure">{text("AI scanning sends your image to Google. Use a fictional or fully de-identified prescription.","اے آئی اسکین آپ کی تصویر گوگل کو بھیجتا ہے۔ فرضی یا مکمل طور پر غیر شناختی نسخہ استعمال کریں۔","AI scan aap ki tasveer Google ko bhejta hai. Farzi ya poori tarah de-identified nuskha istemaal karein.")} <Link href="/privacy" className="underline underline-offset-2">{text("Privacy details","رازداری کی تفصیل","Privacy ki tafseel")}</Link></p>
    {error&&<div role="alert" className="mt-3 flex gap-2 items-center rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger"><CircleAlert size={16}/>{error}</div>}
  </div>;
}
