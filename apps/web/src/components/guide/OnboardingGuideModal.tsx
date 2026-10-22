"use client";

import useModalFocus from "@/components/shared/useModalFocus";
import AppIcon from "@/components/shared/AppIcon";
import { useState, useEffect } from "react";
import type { Language } from "@/lib/types";

interface OnboardingGuideModalProps {
  language: Language;
  onClose: () => void;
  onAction?: (actionType: "search" | "category" | "upload" | "chat", payload?: string) => void;
}

interface GuideTab {
  id: string;
  icon: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  previewType: "search" | "upload" | "category" | "comparison" | "mrp" | "chat";
  actionText?: string;
  actionType?: "search" | "category" | "upload" | "chat";
  actionPayload?: string;
}

export default function OnboardingGuideModal({ language, onClose, onAction }: OnboardingGuideModalProps) {
  const modalRef = useModalFocus(true, onClose);
  const [currentStep, setCurrentStep] = useState(0);

  const guideTabs: GuideTab[] = [
    {
      id: "search",
      icon: "🔍",
      shortLabel: "Search",
      badge: "Step 1: Instant Search",
      badgeColor: "bg-primary/10 text-primary border-primary/20",
      title: "Where & How to Search for Any Medicine",
      subtitle: "Search the supported medicine directory",
      description:
        "Type any commercial brand name (e.g. Panadol, Brufen, Risek, Augmentin) or generic chemical name (e.g. Paracetamol, Ibuprofen, Omeprazole) in the search bar. Afiya displays available medicine information and comparison records.",
      previewType: "search",
      actionText: "Try Searching 'Panadol'",
      actionType: "search",
      actionPayload: "Panadol",
    },
    {
      id: "upload",
      icon: "📸",
      shortLabel: "Prescription OCR",
      badge: "Step 2: AI Prescription Scanner",
      badgeColor: "bg-accent/10 text-accent border-accent/20",
      title: "Where & How to Upload Your Prescription",
      subtitle: "AI extracts medicines from doctor's handwriting or printed slips",
      description:
        "Upload a clear, complete prescription photo. AI-assisted scanning extracts candidate medicine names. Review every line, including missing or uncertain entries, before continuing.",
      previewType: "upload",
      actionText: "Go to Prescription Upload",
      actionType: "upload",
    },
    {
      id: "category",
      icon: "🏷️",
      shortLabel: "Categories",
      badge: "Step 3: Therapeutic Categories",
      badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      title: "How to Browse by Disease & Category",
      subtitle: "Explore medicines organized by medical conditions",
      description:
        "Browse verified medicines by their therapeutic class—such as Pain Relief, Broad-Spectrum Antibiotics, Gastro & Anti-Ulcer, Blood Pressure, and Diabetes. Click any category pill to see all available brands.",
      previewType: "category",
      actionText: "Explore Pain Relief Category",
      actionType: "category",
      actionPayload: "Analgesic / Antipyretic",
    },
    {
      id: "comparison",
      icon: "⚖️",
      shortLabel: "Compare Prices",
      badge: "Step 4: Multi-Brand Comparison",
      badgeColor: "bg-success/10 text-success border-success/20",
      title: "How to Compare Brands & Find 'Sab se Sasta'",
      subtitle: "Compare the stored reference prices for compatible products",
      description:
        "Compare products with matching ingredients, strength and dosage form. Prices are reference values, not live pharmacy quotes. Ask your pharmacist or prescriber before switching products.",
      previewType: "comparison",
      actionText: "Compare Paracetamol Brands",
      actionType: "search",
      actionPayload: "Paracetamol",
    },
    {
      id: "mrp",
      icon: "🛡️",
      shortLabel: "MRP & Overcharge",
      badge: "Step 5: DRAP MRP Protection",
      badgeColor: "bg-danger/10 text-danger border-danger/20",
      title: "How to Check if a Pharmacy Overcharged You",
      subtitle: "Compare your purchase against the available price reference",
      description:
        "Select the correct pack or unit quantity and enter the amount you paid. The checker compares it with stored reference data; review the displayed source and date before drawing conclusions.",
      previewType: "mrp",
      actionText: "Check Risek 20mg MRP",
      actionType: "search",
      actionPayload: "Risek",
    },
    {
      id: "chat",
      icon: "💬",
      shortLabel: "Medicine questions",
      badge: "Step 6: Multilingual AI Chat",
      badgeColor: "bg-primary/10 text-primary border-primary/20",
      title: "Ask about a medicine",
      subtitle: "AI-assisted information with available sources",
      description:
        "Ask questions like 'What are the side effects of Brufen?' or in Roman Urdu 'Panadol ke kya faiday hain?'. Afiya AI provides stream typing answers with clickable badges to view full medicine profiles.",
      previewType: "chat",
      actionText: "Ask AI Assistant",
      actionType: "chat",
    },
  ];

  const current = guideTabs[currentStep];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentStep((prev) => Math.min(guideTabs.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentStep((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guideTabs.length, onClose]);

  const handleFinish = () => {
    try {
      localStorage.setItem("afiya_guide_seen", "true");
    } catch {}
    onClose();
  };

  const handleExecuteAction = () => {
    handleFinish();
    if (onAction && current.actionType) {
      onAction(current.actionType, current.actionPayload);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="guide-title" tabIndex={-1}
        className="bg-surface rounded-3xl border-2 border-primary/25 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 sm:px-6 py-4 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md  text-lg shrink-0">
              <AppIcon symbol="💡" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="guide-title" className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Getting started with Afiya
                </h2>

              </div>
              <p className="text-xs text-muted font-medium">
                Find medicine information, scan a prescription, and compare reference prices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Step Navigation Pill Bar */}
        <div className="px-4 py-2.5 bg-background/50 border-b border-border/70 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
          {guideTabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setCurrentStep(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                currentStep === idx
                  ? "bg-primary text-white shadow-md  scale-[1.02]"
                  : "bg-surface text-muted hover:text-foreground border border-border hover:border-primary/30"
              }`}
            >
              <span><AppIcon symbol={tab.icon} /></span>
              <span>{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Header Info */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${current.badgeColor}`}>
              {current.badge}
            </span>
            <span className="text-xs font-bold text-muted">
              Step {currentStep + 1} of {guideTabs.length}
            </span>
          </div>

          <div>
            <h3 className="text-base sm:text-xl font-extrabold text-foreground leading-snug">
              {current.title}
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-primary mt-0.5">
              {current.subtitle}
            </p>
            <p className="text-xs sm:text-sm text-foreground/80 mt-2 leading-relaxed">
              {current.description}
            </p>
          </div>

        </div>

        {/* Footer Navigation Bar */}
        <div className="px-5 sm:px-6 py-3.5 bg-surface-hover border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {guideTabs.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  currentStep === i ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-3.5 py-2 text-xs font-bold text-muted hover:text-foreground rounded-xl border border-border hover:bg-surface transition-all"
              >
                ← Previous
              </button>
            )}

            {current.actionText && (
              <button
                type="button"
                onClick={handleExecuteAction}
                className="hidden sm:inline-flex items-center gap-1 bg-surface hover:bg-surface-hover text-primary border border-primary/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <span><AppIcon symbol="⚡" /></span>
                <span>{current.actionText}</span>
              </button>
            )}

            {currentStep < guideTabs.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md  transition-all "
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="bg-primary hover:opacity-95 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-lg  transition-all "
              >
                <AppIcon symbol="🚀" /> Explore Afiya
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
