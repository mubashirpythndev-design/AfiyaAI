"use client";

import { useState } from "react";
import type { Language } from "@/lib/types";

interface OnboardingGuideModalProps {
  language: Language;
  onClose: () => void;
}

interface GuideStepItem {
  brand: string;
  price: string;
  note: string;
  isCheapest?: boolean;
  isAlert?: boolean;
}

interface GuideStep {
  stepNumber: number;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  highlightBox: {
    title: string;
    items: GuideStepItem[];
    footerText: string;
  };
}

export default function OnboardingGuideModal({ language, onClose }: OnboardingGuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: GuideStep[] = [
    {
      stepNumber: 1,
      badge: "Feature 1: Price Comparison",
      badgeColor: "bg-primary/10 text-primary border-primary/20",
      title: "How to Compare Brands and Find the Cheapest Medicine",
      description:
        "When doctors prescribe a brand name, other certified companies often manufacture the exact same medicine (same generic molecule and strength) for a fraction of the cost.",
      highlightBox: {
        title: "Example: Paracetamol 500mg Tablets",
        items: [
          { brand: "Panadol (GSK)", price: "Rs. 3.50 / tablet", note: "Prescribed / Popular" },
          { brand: "Calpol (GSK)", price: "Rs. 3.20 / tablet", note: "Alternative" },
          { brand: "Febrol (Barrett Hodgson)", price: "Rs. 2.80 / tablet", note: "🌟 Sab se Sasta (Cheapest)", isCheapest: true },
        ],
        footerText: "💡 All 3 have identical active ingredients. Look for the green Sab se Sasta badge to save up to 60%!",
      },
    },
    {
      stepNumber: 2,
      badge: "Feature 2: DRAP MRP & Overcharge Check",
      badgeColor: "bg-danger/10 text-danger border-danger/20",
      title: "How to Check if a Pharmacy Overcharged You",
      description:
        "Every registered medicine in Pakistan has an official legal Maximum Retail Price (MRP) regulated by DRAP (Drug Regulatory Authority of Pakistan).",
      highlightBox: {
        title: "How to Calculate in 2 Steps:",
        items: [
          { brand: "1. Select Quantity", price: "Strips, Tablets, or Full Box", note: "e.g. 2 Strips of Risek 20mg" },
          { brand: "2. Enter Price Paid", price: "e.g. Rs. 700", note: "Compare vs DRAP baseline (Rs. 610)" },
          { brand: "Overcharge Alert", price: "Rs. 90 Overcharged!", note: "⚠️ You can generate an official report", isCheapest: false, isAlert: true },
        ],
        footerText: "🛡️ Pharmacies cannot legally charge above MRP. If overcharged, report price gouging directly through Afiya AI.",
      },
    },
    {
      stepNumber: 3,
      badge: "Feature 3: Clinical Facts & AI Chat",
      badgeColor: "bg-success/10 text-success border-success/20",
      title: "Authoritative Medical Info & Multilingual AI",
      description:
        "Access verified drug uses, side effects, precautions, and food interactions in English and Roman Urdu, or chat with our grounded AI assistant.",
      highlightBox: {
        title: "What You Can Ask Afiya AI:",
        items: [
          { brand: "📋 Medical Info Tab", price: "When to use, side effects, food warnings", note: "100% DRAP Grounded" },
          { brand: "💬 Multilingual Chat", price: "English, Urdu (اردو), Roman Urdu", note: "Real-time streaming" },
          { brand: "🔒 Safety First", price: "No hallucinations or diagnosis", note: "Clinical safety guardrails" },
        ],
        footerText: "🩺 Always consult your doctor or pharmacist before switching brands or changing doses.",
      },
    },
  ];

  const current = steps[currentStep];

  const handleFinish = () => {
    try {
      localStorage.setItem("afiya_guide_seen", "true");
    } catch {}
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-3xl border-2 border-primary/25 shadow-2xl w-full max-w-xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-primary/15 via-surface to-accent/10 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-md shadow-primary/20">
              <span className="text-lg">💡</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Welcome to Afiya AI Guide</h2>
              <p className="text-[11px] sm:text-xs text-muted font-medium">Quick 3-step walkthrough on how to save money on medicines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="w-8 h-8 rounded-lg bg-surface-hover hover:bg-border border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Step Indicator and Badge */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${current.badgeColor}`}>
              {current.badge}
            </span>
            <span className="text-xs font-bold text-muted">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          {/* Title and Description */}
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-foreground leading-snug">
              {current.title}
            </h3>
            <p className="text-xs sm:text-sm text-foreground/80 mt-1 leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Interactive Highlight Card */}
          <div className="bg-background/80 rounded-2xl p-4 border border-border space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                {current.highlightBox.title}
              </h4>
            </div>

            <div className="space-y-2">
              {current.highlightBox.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    item.isCheapest
                      ? "bg-success/10 border-success/30 text-foreground font-bold shadow-sm"
                      : item.isAlert
                      ? "bg-danger/10 border-danger/30 text-foreground font-bold"
                      : "bg-surface border-border text-foreground/80"
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold">{item.brand}</p>
                    <p className="text-[10px] text-muted">{item.note}</p>
                  </div>
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${
                      item.isCheapest
                        ? "bg-success text-white"
                        : item.isAlert
                        ? "bg-danger text-white"
                        : "bg-surface-hover text-foreground"
                    }`}
                  >
                    {item.price}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] sm:text-xs text-foreground/90 font-medium bg-primary/[0.05] p-2.5 rounded-xl border border-primary/10">
              {current.highlightBox.footerText}
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-5 sm:px-6 py-3.5 bg-surface-hover border-t border-border flex items-center justify-between gap-3">
          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
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

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-3.5 py-2 text-xs font-bold text-muted hover:text-foreground rounded-xl border border-border hover:bg-surface transition-all"
              >
                Previous
              </button>
            )}

            {currentStep < steps.length - 1 ? (
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
                🚀 Got It! Start Exploring
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
