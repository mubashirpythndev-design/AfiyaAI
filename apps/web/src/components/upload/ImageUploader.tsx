"use client";

/**
 * Afiya AI — Advanced Prescription Vision Uploader & Scanner
 * Author / Developer: Mubashir (Lead Developer)
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  isProcessing: boolean;
  language?: Language;
}

export default function ImageUploader({
  onImageSelected,
  isProcessing,
  language = "en",
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Progressive scan step animation during processing
  useEffect(() => {
    if (!isProcessing) {
      setScanStep(0);
      return;
    }
    const timer1 = setTimeout(() => setScanStep(1), 1200);
    const timer2 = setTimeout(() => setScanStep(2), 2600);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isProcessing]);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError(t(language, "upload.invalidType"));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(t(language, "upload.tooLarge"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      onImageSelected(file);
    },
    [onImageSelected, language]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Generates a quick sample prescription image for instant judge/user demo testing
  const handleSamplePrescription = () => {
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

  return (
    <div className="w-full space-y-3">
      {/* Hidden File & Camera inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* Main Upload Dropzone Frame */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!isProcessing) fileInputRef.current?.click();
        }}
        className={`relative cursor-pointer rounded-3xl border-2 transition-all duration-300 overflow-hidden group shadow-xl ${
          dragOver
            ? "border-primary bg-primary/10 shadow-primary/20 scale-[1.01]"
            : "border-border/80 bg-surface/90 hover:border-primary/50 hover:bg-surface-hover/80 hover:shadow-2xl hover:shadow-primary/10"
        } ${isProcessing ? "pointer-events-none" : ""}`}
      >
        {/* Holographic / Scanner Target Corners */}
        <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-primary/60 rounded-tl-sm transition-all group-hover:scale-110" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-primary/60 rounded-tr-sm transition-all group-hover:scale-110" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-primary/60 rounded-bl-sm transition-all group-hover:scale-110" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-primary/60 rounded-br-sm transition-all group-hover:scale-110" />

        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all pointer-events-none" />

        {preview ? (
          /* Preview & Live Laser Scanner Mode */
          <div className="relative aspect-[4/3] max-h-72 w-full overflow-hidden bg-black/5">
            <img
              src={preview}
              alt="Prescription preview"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Hover Change Image overlay */}
            {!isProcessing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs sm:text-sm font-semibold bg-black/60 border border-white/20 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {t(language, "upload.changeImage")}
                </span>
              </div>
            )}

            {/* Futuristic Laser Scan Animation */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-white">
                {/* Sweeping Laser Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-light to-transparent shadow-[0_0_15px_4px_rgba(45,212,191,0.8)] animate-scanline pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-3 max-w-xs">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary-light animate-pulse shadow-lg shadow-primary/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12h20M12 2v20" opacity="0.3" />
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm sm:text-base font-bold text-white tracking-wide">
                      {t(language, "upload.extracting")}
                    </p>
                    <p className="text-xs text-primary-light font-medium mt-1">
                      {scanStep === 0 && "Analyzing image structure & clarity..."}
                      {scanStep === 1 && "Deciphering handwriting with Gemini Vision..."}
                      {scanStep === 2 && "Matching against 40+ verified medicines..."}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary-light h-full rounded-full transition-all duration-500 shadow-sm shadow-primary-light"
                      style={{ width: scanStep === 0 ? "35%" : scanStep === 1 ? "70%" : "95%" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty Dropzone State */
          <div className="py-8 sm:py-12 px-4 sm:px-8 flex flex-col items-center text-center relative z-10">
            {/* Glowing Icon Container */}
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 shadow-md ${
                dragOver
                  ? "bg-primary text-white scale-110 shadow-primary/30"
                  : "bg-gradient-to-br from-primary/15 to-accent/15 text-primary border border-primary/20 group-hover:scale-105 group-hover:shadow-primary/20"
              }`}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="transition-transform group-hover:-translate-y-0.5"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>

            <h3 className="text-foreground font-bold text-base sm:text-lg mb-1 tracking-tight">
              {dragOver ? t(language, "upload.titleDrag") : t(language, "upload.title")}
            </h3>
            <p className="text-muted text-xs sm:text-sm mb-4 max-w-xs leading-relaxed">
              {t(language, "upload.subtitle")}
            </p>

            {/* Action Buttons inside Dropzone */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md hover:shadow-primary/25 transition-all flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Browse File
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="bg-surface hover:bg-surface-hover text-foreground border border-border text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Camera
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Demo Sample Pill & Security Badges Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 pt-0.5">
        <button
          type="button"
          onClick={handleSamplePrescription}
          disabled={isProcessing}
          className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1.5 transition-colors py-1 group disabled:opacity-50"
        >
          <span className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] group-hover:scale-110 transition-transform">
            ⚡
          </span>
          <span>Try Demo Prescription (1-Click)</span>
        </button>

        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Encrypted & Private
          </span>
          <span>•</span>
          <span>Max 10MB (JPG/PNG/WebP)</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs sm:text-sm text-danger flex items-center gap-2 animate-fade-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
