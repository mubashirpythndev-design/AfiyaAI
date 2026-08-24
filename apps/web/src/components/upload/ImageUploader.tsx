"use client";

import { useCallback, useState, useRef } from "react";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  isProcessing: boolean;
  language?: Language;
}

export default function ImageUploader({ onImageSelected, isProcessing, language = "en" }: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden group ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-surface-hover"
        } ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {preview ? (
          <div className="relative aspect-[4/3] max-h-64 overflow-hidden">
            <img src={preview} alt="Prescription preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
                {t(language, "upload.changeImage")}
              </span>
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">{t(language, "upload.extracting")}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 px-8 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
              dragOver ? "bg-primary/20 scale-110" : "bg-primary/10"
            }`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-foreground font-semibold text-base mb-1">
              {dragOver ? t(language, "upload.titleDrag") : t(language, "upload.title")}
            </p>
            <p className="text-muted text-sm mb-4">
              {t(language, "upload.subtitle")}
            </p>
            <p className="text-muted/60 text-xs">
              {t(language, "upload.hint")}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger flex items-center gap-1.5 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
