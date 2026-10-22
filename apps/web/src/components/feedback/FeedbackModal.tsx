"use client";

import useModalFocus from "@/components/shared/useModalFocus";
import AppIcon from "@/components/shared/AppIcon";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getCurrentUser, isLoggedIn } from "@/lib/auth";
import { submitUserFeedback, type FeedbackSubmission } from "@/lib/api";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "en" | "ur" | "roman_ur";
}

const PRIMARY_NEEDS = [
  { id: "Find Affordable Alternative Medicines", label: "Find Affordable Alternative Medicines", desc: "Compare prices for matching ingredient, strength and form" },
  { id: "Prescription Scanner (OCR)", label: "Prescription Scanner (OCR)", desc: "Read doctor prescriptions accurately" },
  { id: "Check DRAP MRP & Overcharging", label: "Check DRAP MRP & Overcharging", desc: "Compare with stored reference prices" },
  { id: "Medicine Safety, Dosages & Side Effects", label: "Medicine Safety & Side Effects", desc: "Understand precautions & usage safely" },
  { id: "AI Medicine Chatbot Assistant", label: "Medicine questions", desc: "Explore medicine information in Urdu / English" },
  { id: "Digital Medicine Cabinet & Recall Watchdog", label: "Digital Medicine Cabinet", desc: "Track daily medications & safety alerts" },
];

const FREQUENCY_OPTIONS = [
  "Monthly (Chronic - Diabetes, BP, Heart)",
  "Occasional / As Needed (Fever, Pain, Flu)",
  "Caregiver for Elderly / Family Member",
  "Healthcare Professional / Pharmacist",
  "General Health Awareness",
];

const EASE_OPTIONS = ["Very Easy & Smooth", "Easy", "Neutral", "Needs Improvement"];

const MAJOR_CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Peshawar", "Multan", "Quetta", "Other"];

export default function FeedbackModal({ isOpen, onClose, language = "en" }: FeedbackModalProps) {
  const modalRef = useModalFocus(isOpen, onClose);
  const { user: clerkUser, isSignedIn } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState<string>("");
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [primaryNeed, setPrimaryNeed] = useState(PRIMARY_NEEDS[0].id);
  const [frequency, setFrequency] = useState(FREQUENCY_OPTIONS[0]);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [easeOfUse, setEaseOfUse] = useState(EASE_OPTIONS[0]);
  const [feedback, setFeedback] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-fill user info on mount / when auth resolves
  useEffect(() => {
    if (clerkUser) {
      const emailVal = clerkUser.primaryEmailAddress?.emailAddress || "";
      const nameVal = clerkUser.fullName || clerkUser.firstName || "";
      if (nameVal && !name) setName(nameVal);
      if (emailVal && !email) setEmail(emailVal);
    } else {
      const internalUser = getCurrentUser();
      if (internalUser) {
        if (internalUser.name && !name) setName(internalUser.name);
        if (internalUser.email && !email) setEmail(internalUser.email);
      }
    }
  }, [clerkUser, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please provide your name and a valid email address.");
      return;
    }
    if (!feedback.trim() || feedback.trim().length < 3) {
      setError("Please share at least a few words in your feedback.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: FeedbackSubmission = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      age: age ? parseInt(age, 10) : null,
      city: city === "Other" ? customCity.trim() || "Other" : city.trim() || null,
      primary_need: primaryNeed,
      frequency_of_medicine_purchase: frequency,
      rating,
      ease_of_use: easeOfUse,
      feedback: feedback.trim(),
      would_recommend: wouldRecommend,
    };

    try {
      await submitUserFeedback(payload);
      setIsSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setError(null);
    setFeedback("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="feedback-title" tabIndex={-1} className="relative w-full max-w-2xl bg-surface border border-border/80 rounded-3xl shadow-2xl p-6 sm:p-8 my-auto overflow-hidden">
        {/* Decorative Top Accent Glow */}

        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          type="button"
          aria-label="Close feedback"
          className="absolute top-4 right-4 text-muted hover:text-foreground w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center transition-colors cursor-pointer text-lg"
        >
          ✕
        </button>

        {isSuccess ? (
          /* Success Screen */
          <div className="text-center py-8 space-y-4 animate-fade-in">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-inner border border-primary/20 animate-bounce">
              <AppIcon symbol="✨" />
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">
              Thank You for Helping Pakistan! <AppIcon symbol="🇵🇰" />
            </h3>
            <p className="text-muted text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Your valuable feedback helps us refine Afiya AI to provide accessible, affordable, and accurate medicine intelligence for every family across Pakistan.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="bg-primary hover:opacity-95 text-white font-bold py-3 px-8 rounded-2xl shadow-lg  transition-all hover:scale-105 cursor-pointer"
              >
                Done / Wapis Jayein
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="space-y-6 relative">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-2 border border-primary/20">
                <span><AppIcon symbol="💬" /></span> Community Voice & Feedback
              </div>
              <h2 id="feedback-title" className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Share Your Feedback & Healthcare Needs
              </h2>
              <p className="text-xs sm:text-sm text-muted mt-1">
                Help us understand how Afiya AI can serve you and your family best. Takes less than 1 minute!
              </p>
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-xs sm:text-sm p-3.5 rounded-2xl flex items-center gap-2 animate-fade-in">
                <span><AppIcon symbol="⚠️" /></span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Personal Details Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-foreground/80 mb-1.5">
                    Full Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ayesha Khan"
                    required
                    className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-foreground transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground/80 mb-1.5">
                    Email Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ayesha@gmail.com"
                    required
                    className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-foreground transition-all outline-none"
                  />
                </div>
              </div>

              {/* Age & City Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-foreground/80 mb-1.5">
                    Your Age (Years)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="110"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 32"
                    className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-foreground transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground/80 mb-1.5">
                    City / Shehar
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-foreground transition-all outline-none"
                  >
                    <option value="">Select your city...</option>
                    {MAJOR_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {city === "Other" && (
                    <input
                      type="text"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      placeholder="Enter your city name"
                      className="mt-2 w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-foreground outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Primary Healthcare Need */}
              <div>
                <label className="block text-xs font-bold text-foreground/80 mb-2">
                  What is your primary healthcare or medicine need? <span className="text-danger">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRIMARY_NEEDS.map((item) => {
                    const isSelected = primaryNeed === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPrimaryNeed(item.id)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                            : "border-border bg-background hover:bg-surface-hover text-foreground/80"
                        }`}
                      >
                        <div className="font-bold text-[12px]">{item.label}</div>
                        <div className="text-[10px] text-muted mt-0.5 font-normal">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Medicine Purchase Frequency */}
              <div>
                <label className="block text-xs font-bold text-foreground/80 mb-1.5">
                  How often do you purchase or research medicines?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFrequency(opt)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                        frequency === opt
                          ? "bg-primary text-white border-primary font-bold shadow-sm"
                          : "bg-background text-foreground/70 border-border hover:bg-surface-hover"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overall Satisfaction Rating */}
              <div className="bg-surface-hover/50 p-3.5 rounded-2xl border border-border/70">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-foreground">
                    How would you rate your experience with Afiya AI?
                  </span>
                  <span className="text-xs font-black text-primary">
                    {rating} / 5 Stars
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="text-2xl transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                    >
                      {(hoverRating || rating) >= star ? "⭐" : "☆"}
                    </button>
                  ))}
                  <span className="text-xs font-medium text-muted ml-2">
                    {rating === 5 ? "Outstanding!" : rating >= 4 ? "Good & Useful" : rating >= 3 ? "Average" : "Need Improvements"}
                  </span>
                </div>
              </div>

              {/* Comments & Suggestions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-foreground/80">
                    Your Honest Feedback, Comments & Feature Ideas <span className="text-danger">*</span>
                  </label>
                  <span className="text-[11px] text-muted">
                    {feedback.length} / 2000
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  maxLength={2000}
                  placeholder="Tell us about your experience, what you liked, or any new features you need (e.g. pharmacy store locator, Urdu voice search, etc.)..."
                  required
                  className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl p-3 text-xs sm:text-sm text-foreground transition-all outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Would Recommend Toggle */}
              <div className="flex items-center justify-between p-3 bg-surface rounded-2xl border border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span><AppIcon symbol="❤️" /></span> Would you recommend Afiya AI to friends or family?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(true)}
                    className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                      wouldRecommend
                        ? "bg-primary text-white shadow-sm"
                        : "bg-background text-muted border border-border"
                    }`}
                  >
                    Yes, definitely!
                  </button>
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(false)}
                    className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                      !wouldRecommend
                        ? "bg-muted text-foreground shadow-sm"
                        : "bg-background text-muted border border-border"
                    }`}
                  >
                    Not yet
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">Feedback is stored for review by the Afiya team. Avoid including prescription details or other sensitive information. <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Read the Privacy Policy (opens in a new tab)</a>.</p>
            {/* Submit Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/70">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="text-xs sm:text-sm font-bold text-muted hover:text-foreground px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-primary hover:opacity-95 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md  transition-all  disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <span><AppIcon symbol="🚀" /></span> Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
