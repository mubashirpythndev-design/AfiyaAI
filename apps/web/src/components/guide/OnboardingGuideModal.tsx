"use client";

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
  const [currentStep, setCurrentStep] = useState(0);

  const guideTabs: GuideTab[] = [
    {
      id: "search",
      icon: "🔍",
      shortLabel: "Search",
      badge: "Step 1: Instant Search",
      badgeColor: "bg-primary/10 text-primary border-primary/20",
      title: "Where & How to Search for Any Medicine",
      subtitle: "Instant access to 100+ DRAP-verified medicines",
      description:
        "Type any commercial brand name (e.g. Panadol, Brufen, Risek, Augmentin) or generic chemical name (e.g. Paracetamol, Ibuprofen, Omeprazole) in the search bar. Afiya AI instantly retrieves verified clinical guidance and registered alternatives.",
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
        "Click the prescription upload box or drag & drop a photo of your prescription. Our medical OCR model extracts candidate drug names, matches them against DRAP records, and checks price ceilings automatically.",
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
      subtitle: "Save up to 60% with identical active ingredients",
      description:
        "When doctors prescribe an expensive brand name, other licensed pharmaceutical companies manufacture the exact same active generic molecule at a much lower cost. Look for the green '🌟 Sab se Sasta' badge to find the most affordable certified option.",
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
      subtitle: "Official price gouging detector backed by DRAP ceilings",
      description:
        "Every registered medicine in Pakistan has a legal Maximum Retail Price (MRP). In the MRP Checker, select your quantity (Strips, Tablets, or Full Box) and enter what the medical store charged you to immediately calculate overcharges.",
      previewType: "mrp",
      actionText: "Check Risek 20mg MRP",
      actionType: "search",
      actionPayload: "Risek",
    },
    {
      id: "chat",
      icon: "💬",
      shortLabel: "AI Assistant",
      badge: "Step 6: Multilingual AI Chat",
      badgeColor: "bg-primary/10 text-primary border-primary/20",
      title: "24/7 AI Medical Assistant (English & Roman Urdu)",
      subtitle: "Grounded in verified DRAP facts with real-time streaming",
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
        className="bg-surface rounded-3xl border-2 border-primary/25 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-primary/15 via-surface to-accent/10 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-md shadow-primary/20 text-lg shrink-0">
              💡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Afiya AI — Quick Start Guide & Walkthrough
                </h2>
                <span className="hidden sm:inline-flex text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                  Interactive Tour
                </span>
              </div>
              <p className="text-xs text-muted font-medium">
                Master how to search, upload prescriptions, compare brands, and detect overcharges
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
                  ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-surface text-muted hover:text-foreground border border-border hover:border-primary/30"
              }`}
            >
              <span>{tab.icon}</span>
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

          {/* Interactive Feature Visual Mockup */}
          <div className="bg-background/80 rounded-2xl p-4 sm:p-5 border border-border shadow-inner space-y-3">
            {/* Step 1 Preview: Search Bar Mockup */}
            {current.previewType === "search" && (
              <div className="space-y-3">
                <div className="bg-surface rounded-xl border-2 border-primary/30 p-2.5 flex items-center gap-2 shadow-sm">
                  <span className="text-primary text-base">🔍</span>
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    Panadol <span className="text-muted font-normal">(or Paracetamol 500mg)</span>
                  </span>
                  <span className="ml-auto bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                    Search
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface/80 p-2.5 rounded-xl border border-border">
                    <p className="font-bold text-foreground">💊 Commercial Brand Search</p>
                    <p className="text-[11px] text-muted">Type names like Panadol, Brufen, Risek, Augmentin.</p>
                  </div>
                  <div className="bg-surface/80 p-2.5 rounded-xl border border-border">
                    <p className="font-bold text-foreground">🧪 Generic Salt Search</p>
                    <p className="text-[11px] text-muted">Type salts like Paracetamol, Ibuprofen, Omeprazole.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Preview: Prescription Upload Mockup */}
            {current.previewType === "upload" && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-primary/40 rounded-2xl p-4 bg-primary/[0.03] text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto text-primary text-lg">
                    📸
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-foreground">
                    Drop doctor prescription image here or Browse Files
                  </p>
                  <p className="text-[11px] text-muted">
                    Supports JPG, PNG, WebP (Camera shots & scanned prescriptions)
                  </p>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-border flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">✨ AI OCR Recognition</span>
                  <span className="text-success font-bold bg-success/10 px-2 py-0.5 rounded-md">
                    Matches with DRAP Verified DB
                  </span>
                </div>
              </div>
            )}

            {/* Step 3 Preview: Therapeutic Category Mockup */}
            {current.previewType === "category" && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-muted uppercase tracking-wider">
                  Quick Filter by Therapeutic Need:
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-surface border-2 border-primary/30 px-3 py-1.5 rounded-xl text-xs font-bold text-foreground flex items-center gap-1.5 shadow-sm">
                    <span>💊</span> Pain & Fever (Analgesics)
                  </span>
                  <span className="bg-surface border border-border px-3 py-1.5 rounded-xl text-xs font-medium text-muted flex items-center gap-1.5">
                    <span>🦠</span> Broad Antibiotics
                  </span>
                  <span className="bg-surface border border-border px-3 py-1.5 rounded-xl text-xs font-medium text-muted flex items-center gap-1.5">
                    <span>🫁</span> Gastro & Acid Reflux
                  </span>
                  <span className="bg-surface border border-border px-3 py-1.5 rounded-xl text-xs font-medium text-muted flex items-center gap-1.5">
                    <span>🩸</span> Diabetes Control
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  💡 Clicking any category filters all 102 verified medicines instantly.
                </p>
              </div>
            )}

            {/* Step 4 Preview: Multi-Brand Comparison Mockup */}
            {current.previewType === "comparison" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted px-1">
                  <span>Paracetamol 500mg Comparison</span>
                  <span className="text-success">Same Active Salt</span>
                </div>
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl border border-border bg-surface flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">Panadol (GSK)</p>
                      <p className="text-[10px] text-muted">Popular Brand</p>
                    </div>
                    <span className="font-bold text-foreground">Rs. 3.50 / tab</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border bg-surface flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">Calpol (GSK)</p>
                      <p className="text-[10px] text-muted">Alternative</p>
                    </div>
                    <span className="font-bold text-foreground">Rs. 3.20 / tab</span>
                  </div>
                  <div className="p-2.5 rounded-xl border-2 border-success/40 bg-success/10 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">Febrol (Barrett Hodgson)</p>
                      <span className="text-[10px] font-extrabold text-success bg-success/20 px-1.5 py-0.5 rounded">
                        🌟 Sab se Sasta (Cheapest)
                      </span>
                    </div>
                    <span className="font-extrabold text-success text-sm">Rs. 2.80 / tab (Save 20%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5 Preview: MRP Overcharge Mockup */}
            {current.previewType === "mrp" && (
              <div className="space-y-2.5">
                <div className="bg-surface rounded-xl p-3 border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-foreground">1. Selected: 2 Strips of Risek 20mg</span>
                    <span className="text-primary">DRAP Legal MRP: Rs. 610.00</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-foreground">2. Pharmacy Charged: Rs. 700.00</span>
                    <span className="text-danger bg-danger/10 px-2 py-0.5 rounded">
                      ⚠️ Overcharged by Rs. 90.00!
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted">
                  🛡️ Afiya AI lets you print and export official price gouging complaints according to DRAP S.R.O. regulations.
                </p>
              </div>
            )}

            {/* Step 6 Preview: AI Chat Mockup */}
            {current.previewType === "chat" && (
              <div className="space-y-2">
                <div className="bg-surface rounded-xl p-3 border border-border space-y-1.5 text-xs">
                  <div className="bg-primary text-white p-2 rounded-xl rounded-br-none ml-auto max-w-[80%] font-medium">
                    Brufen ke side effects kya hain?
                  </div>
                  <div className="bg-background text-foreground p-2.5 rounded-xl rounded-bl-none border border-border max-w-[90%] space-y-1">
                    <p className="font-bold text-primary text-[11px]">Afiya AI (DRAP Grounded):</p>
                    <p className="text-[11px]">
                      - Mede mein jalan aur matli (Stomach upset, nausea)<br />
                      - Zyada miqdar lene se ulcer ka khatra
                    </p>
                    <span className="inline-block text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold mt-1">
                      🔍 View Brufen 400mg Details
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                <span>⚡</span>
                <span>{current.actionText}</span>
              </button>
            )}

            {currentStep < guideTabs.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="bg-gradient-to-r from-success to-primary hover:opacity-95 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-lg shadow-success/25 transition-all hover:scale-[1.02]"
              >
                🚀 Start Exploring Afiya AI
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
