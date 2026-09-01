"use client";

/**
 * Afiya AI — Main Web Application View Controller
 * Author / Developer: Mubashir (Lead Developer)
 */

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useUser, useClerk } from "@clerk/nextjs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ImageUploader from "@/components/upload/ImageUploader";
import OCRResults from "@/components/upload/OCRResults";
import MedicineCard from "@/components/medicine/MedicineCard";
import PriceTable from "@/components/medicine/PriceTable";
import MrpChecker from "@/components/medicine/MrpChecker";
import InfoPanel from "@/components/medicine/InfoPanel";
import SaveToCabinetButton from "@/components/medicine/SaveToCabinetButton";
import ChatInterface from "@/components/chat/ChatInterface";
import CabinetModal from "@/components/medicine/CabinetModal";
import OnboardingGuideModal from "@/components/guide/OnboardingGuideModal";
import Disclaimer from "@/components/shared/Disclaimer";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import type {
  Language,
  MedicineCandidate,
  MedicineDetail,
  PriceComparison,
  MedicineInfo,
  OCRResponse,
  AuthUser,
} from "@/lib/types";
import { extractFromImage, matchMedicine, getPrices, getMedicineInfo, getMedicinesByCategory, setOnUnauthorized } from "@/lib/api";
import { isLoggedIn, getCurrentUser, clearSession } from "@/lib/auth";
import { CATEGORY_ICONS } from "@/lib/constants";
import { t } from "@/lib/i18n";

type View = "home" | "results" | "info" | "prices" | "direct_search";

type PendingAction =
  | { kind: "info"; id: string }
  | { kind: "prices"; id: string }
  | { kind: "direct_search"; id: string };

export default function Home() {
  const { isSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();
  const [view, setView] = useState<View>("home");
  const [language, setLanguage] = useState<Language>("en");
  const [medicines, setMedicines] = useState<MedicineDetail[]>([]);
  const [candidates, setCandidates] = useState<MedicineCandidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<OCRResponse | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<MedicineInfo | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<PriceComparison | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [directTab, setDirectTab] = useState<"info" | "prices">("info");
  const [isGenericQuery, setIsGenericQuery] = useState(false);

  // Cabinet & Guide Modal State
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // === Auth state ===
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);

  // Sync Clerk user
  useEffect(() => {
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      const userObj: AuthUser = {
        id: clerkUser.id,
        name: clerkUser.fullName || clerkUser.firstName || email.split("@")[0] || "User",
        email: email,
        is_admin: clerkUser.publicMetadata?.role === "admin" || false,
      };
      setAuthUser(userObj);

      // Replay any pending action upon Clerk sign in
      if (pendingRef.current) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending.kind === "info") void handleViewDetails(pending.id);
        if (pending.kind === "prices") void handleViewPrices(pending.id);
        if (pending.kind === "direct_search") void loadDirectSearchData(pending.id);
      }
    } else if (!isSignedIn) {
      setAuthUser(getCurrentUser());
    }
  }, [isSignedIn, clerkUser]);

  const requestAuth = (pending?: PendingAction) => {
    if (pending) {
      pendingRef.current = pending;
    }
    clerk.openSignIn();
  };

  // Hydrate the session from localStorage after mount & trigger guide on first visit
  useEffect(() => {
    setAuthUser(getCurrentUser());
    try {
      const seen = localStorage.getItem("afiya_guide_seen");
      if (!seen) {
        setShowGuideModal(true);
      }
    } catch {}
  }, []);

  // Always reset scroll to top when changing views
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [view]);

  // Any 401 drops session and requests sign in
  useEffect(() => {
    setOnUnauthorized(() => {
      setAuthUser(null);
      requestAuth();
    });
  }, []);

  const handleGuideAction = (actionType: "search" | "category" | "upload" | "chat", payload?: string) => {
    setShowGuideModal(false);
    if (actionType === "search" && payload) {
      setSearchQuery(payload);
      void (async () => {
        setIsProcessing(true);
        try {
          const match = await matchMedicine(payload);
          const targetMed = match.medicine || (match.alternatives && match.alternatives[0]);
          if (targetMed) {
            setIsGenericQuery(!match.medicine);
            const isAuthenticated = Boolean(isSignedIn || authUser || isLoggedIn());
            if (!isAuthenticated) {
              requestAuth({ kind: "direct_search", id: targetMed.id });
              return;
            }
            if (!match.medicine) setDirectTab("prices");
            await loadDirectSearchData(targetMed.id);
          }
        } finally {
          setIsProcessing(false);
        }
      })();
    } else if (actionType === "category" && payload) {
      void handleCategorySearch(payload);
    } else if (actionType === "upload") {
      const el = document.getElementById("features");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (actionType === "chat") {
      const el = document.getElementById("how-it-works");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const loadDirectSearchData = async (id: string) => {
    setIsProcessing(true);
    try {
      const [info, prices] = await Promise.all([
        getMedicineInfo(id, language),
        getPrices(id),
      ]);
      setSelectedInfo(info);
      setSelectedPrices(prices);
      setView("direct_search");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.loadInfo"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = () => {
    clearSession();
    setAuthUser(null);
  };

  const handleImageSelected = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await extractFromImage(file);
      setView("results");

      const seenIds = new Set<string>();
      const enrichedCandidates: MedicineCandidate[] = [];
      const matched: MedicineDetail[] = [];

      for (const candidate of result.candidates) {
        try {
          const match = await matchMedicine(candidate.raw_text);
          // Strict accuracy check: only consider available if high confidence match returned
          const isStrongMatch = Boolean(match.medicine && (!match.needs_confirmation || match.confidence >= 0.8));

          if (isStrongMatch && match.medicine) {
            if (!seenIds.has(match.medicine.id)) {
              seenIds.add(match.medicine.id);
              matched.push(match.medicine);
            }
            enrichedCandidates.push({
              ...candidate,
              confidence: match.confidence,
              is_verified: true,
              matched_medicine: match.medicine,
            });
          } else {
            enrichedCandidates.push({
              ...candidate,
              confidence: match.confidence || candidate.confidence,
              is_verified: false,
              matched_medicine: null,
            });
          }
        } catch {
          enrichedCandidates.push({
            ...candidate,
            is_verified: false,
            matched_medicine: null,
          });
        }
      }
      setOcrData({
        ...result,
        candidates: enrichedCandidates,
      });
      setMedicines(matched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const match = await matchMedicine(searchQuery.trim());
      const isAuthenticated = Boolean(isSignedIn || authUser || isLoggedIn());
      if (match.medicine) {
        setIsGenericQuery(false);
        setMedicines([match.medicine]);
        if (!isAuthenticated) {
          requestAuth({ kind: "direct_search", id: match.medicine.id });
          return;
        }
        await loadDirectSearchData(match.medicine.id);
      } else if (match.alternatives && match.alternatives.length > 0) {
        // Multi-brand generic match (e.g. Paracetamol, Ibuprofen, Omeprazole)
        setIsGenericQuery(true);
        setMedicines(match.alternatives);
        const topMedId = match.alternatives[0].id;
        if (!isAuthenticated) {
          requestAuth({ kind: "direct_search", id: topMedId });
          return;
        }
        setDirectTab("prices");
        await loadDirectSearchData(topMedId);
      } else {
        setError(t(language, "error.noMatch"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.searchFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    setIsGenericQuery(false);
    const isAuthenticated = Boolean(isSignedIn || authUser || isLoggedIn());
    if (!isAuthenticated) {
      requestAuth({ kind: "info", id });
      return;
    }
    setIsProcessing(true);
    try {
      const info = await getMedicineInfo(id, language);
      setSelectedInfo(info);
      setView("info");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.loadInfo"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPrices = async (id: string) => {
    setIsGenericQuery(false);
    const isAuthenticated = Boolean(isSignedIn || authUser || isLoggedIn());
    if (!isAuthenticated) {
      requestAuth({ kind: "prices", id });
      return;
    }
    setIsProcessing(true);
    try {
      const prices = await getPrices(id);
      setSelectedPrices(prices);
      setView("prices");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.loadPrices"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCategorySearch = async (category: string) => {
    setIsGenericQuery(false);
    setIsProcessing(true);
    setError(null);
    try {
      const medicines = await getMedicinesByCategory(category);
      if (medicines.length > 0) {
        setMedicines(medicines);
        setView("results");
        window.scrollTo({ top: 0, behavior: "instant" });
      } else {
        setError(t(language, "error.noMatch"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.searchFailed"));
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div dir={language === "ur" ? "rtl" : "ltr"} suppressHydrationWarning>
      <Header
        language={language}
        onLanguageChange={setLanguage}
        user={authUser}
        onSignIn={() => requestAuth()}
        onSignOut={handleSignOut}
        onOpenCabinet={() => setShowCabinetModal(true)}
        onOpenGuide={() => setShowGuideModal(true)}
        onNavigateHome={() => {
          setView("home");
          setSelectedInfo(null);
          setSelectedPrices(null);
          setOcrData(null);
          setMedicines([]);
          setSearchQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <main className="flex-1">
        {/* ====== HERO SECTION ====== */}
        {view === "home" && (
          <section className="relative overflow-hidden min-h-[85vh] flex items-center">
            {/* Animated background */}
            <div className="absolute inset-0 hero-gradient" />
            <div className="absolute top-10 sm:top-20 right-5 sm:right-10 w-48 sm:w-72 h-48 sm:h-72 bg-primary/8 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-10 sm:bottom-20 left-5 sm:left-10 w-64 sm:w-96 h-64 sm:h-96 bg-accent/8 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[600px] h-[320px] sm:h-[600px] bg-primary/3 rounded-full blur-3xl" />

            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
                {/* Left: Text + CTA */}
                <div className="animate-slide-up">
                  <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-primary/10">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span>
                        {language === "ur" ? (
                          <>
                            <span>طاقتور از </span>
                            <a
                              href="https://e.dra.gov.pk/public/price"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-primary-dark font-bold inline-flex items-center gap-0.5 ml-1"
                              title="DRAP سرکاری پرائس پورٹل"
                            >
                              مصدقہ DRAP ڈیٹا ↗
                            </a>
                          </>
                        ) : language === "roman_ur" ? (
                          <>
                            <span>Mustanad </span>
                            <a
                              href="https://e.dra.gov.pk/public/price"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-primary-dark font-bold inline-flex items-center gap-0.5 ml-1"
                              title="Verify on DRAP Public Price Portal"
                            >
                              DRAP Data ↗
                            </a>
                            <span> se Taqatwar</span>
                          </>
                        ) : (
                          <>
                            <span>Powered by </span>
                            <a
                              href="https://e.dra.gov.pk/public/price"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-primary-dark font-bold inline-flex items-center gap-0.5 ml-1"
                              title="Verify on DRAP Public Price Portal"
                            >
                              Verified DRAP Data ↗
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(true)}
                      className="inline-flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 text-xs font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all shadow-sm hover:scale-105"
                    >
                      <span>💡</span>
                      <span>How to Use & Compare (Interactive Tour)</span>
                    </button>
                  </div>

                  <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.15] mb-4 sm:mb-6 break-words">
                    {t(language, "hero.title1")}{" "}
                    <span className="text-gradient">{t(language, "hero.titleHighlight")}</span>{" "}
                    {t(language, "hero.title2")}
                  </h1>

                  <p className="text-sm sm:text-base lg:text-lg text-muted leading-relaxed mb-6 sm:mb-10 max-w-lg">
                    {t(language, "hero.description")}
                  </p>

                  {/* Search bar */}
                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-md mb-6 sm:mb-8">
                    <div className="relative flex-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder={t(language, "hero.searchPlaceholder")}
                        className="w-full bg-surface/80 backdrop-blur-sm border border-border rounded-2xl pl-11 pr-4 py-3 sm:py-3.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={isProcessing || !searchQuery.trim()}
                      className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 shrink-0 w-full sm:w-auto"
                    >
                      {t(language, "hero.searchBtn")}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-6 text-xs sm:text-sm">
                    {[
                      { num: t(language, "hero.stat1Num"), label: t(language, "hero.stat1Label"), color: "primary" },
                      { num: t(language, "hero.stat2Num"), label: t(language, "hero.stat2Label"), color: "accent" },
                      { num: t(language, "hero.stat3Num"), label: t(language, "hero.stat3Label"), color: "success" },
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-2.5 text-center sm:text-left">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-${stat.color}/10 flex items-center justify-center shrink-0`}>
                          <span className={`text-${stat.color} font-bold text-xs`}>{stat.num}</span>
                        </div>
                        <span className="text-muted text-[11px] sm:text-xs leading-tight">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Hero image + Upload */}
                <div className="animate-fade-in space-y-4 sm:space-y-6" style={{ animationDelay: "0.3s" }}>
                  <a
                    href="https://www.dra.gov.pk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 border border-border/30 card-hover cursor-pointer"
                    title="Visit Official DRAP Website (dra.gov.pk)"
                  >
                    <Image
                      src="/hero-banner.png"
                      alt="Medical AI visualization - DRAP Pakistan"
                      width={800}
                      height={460}
                      className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-500"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
                    {/* Floating badge */}
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 bg-surface/90 backdrop-blur-md rounded-xl px-3 py-1.5 sm:px-4 sm:py-2.5 border border-border/30 shadow-lg group-hover:border-primary/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-[10px] sm:text-xs font-semibold text-foreground">
                          {t(language, "hero.drapBadge")} ↗
                        </span>
                      </div>
                    </div>
                  </a>

                  <ImageUploader
                    onImageSelected={handleImageSelected}
                    isProcessing={isProcessing}
                    language={language}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====== BROWSE CATEGORIES ====== */}
        {view === "home" && (
          <section className="py-12 sm:py-20 border-t border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8 sm:mb-14">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">{t(language, "category.title")}</h2>
                <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">{t(language, "category.subtitle")}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 stagger-children">
                {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
                  <button
                    key={cat}
                    onClick={() => handleCategorySearch(cat)}
                    className="group bg-surface rounded-2xl border border-border p-3.5 sm:p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 text-center card-hover cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                      {icon}
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{cat}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====== HOW IT WORKS ====== */}
        {view === "home" && (
          <section id="how-it-works" className="py-14 sm:py-24 border-t border-border bg-surface/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10 sm:mb-16">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">{t(language, "howItWorks.title")}</h2>
                <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">{t(language, "howItWorks.subtitle")}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 stagger-children">
                {[
                  {
                    step: "01",
                    title: t(language, "howItWorks.step1Title"),
                    desc: t(language, "howItWorks.step1Desc"),
                    icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                    gradient: "from-primary to-primary-light",
                  },
                  {
                    step: "02",
                    title: t(language, "howItWorks.step2Title"),
                    desc: t(language, "howItWorks.step2Desc"),
                    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
                    gradient: "from-accent to-accent-light",
                  },
                  {
                    step: "03",
                    title: t(language, "howItWorks.step3Title"),
                    desc: t(language, "howItWorks.step3Desc"),
                    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                    gradient: "from-success to-primary",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="relative bg-surface rounded-2xl border border-border p-6 sm:p-8 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group card-hover"
                  >
                    {/* Step number watermark */}
                    <span className="absolute top-4 right-6 text-6xl sm:text-7xl font-black text-border/30 group-hover:text-primary/10 transition-colors leading-none select-none">
                      {item.step}
                    </span>

                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-5 sm:mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6">
                        <path d={item.icon} />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground mb-2 relative">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-muted leading-relaxed relative">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====== FEATURES ====== */}
        {view === "home" && (
          <section id="features" className="py-14 sm:py-24 border-t border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10 sm:mb-16">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">{t(language, "features.title")}</h2>
                <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">{t(language, "features.subtitle")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 stagger-children">
                {[
                  {
                    title: t(language, "features.ocr"),
                    desc: t(language, "features.ocrDesc"),
                    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
                    color: "primary",
                  },
                  {
                    title: t(language, "features.price"),
                    desc: t(language, "features.priceDesc"),
                    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                    color: "success",
                  },
                  {
                    title: t(language, "features.chat"),
                    desc: t(language, "features.chatDesc"),
                    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                    color: "accent",
                  },
                  {
                    title: t(language, "features.safety"),
                    desc: t(language, "features.safetyDesc"),
                    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                    color: "danger",
                  },
                ].map((feat) => (
                  <div
                    key={feat.title}
                    className="group bg-surface rounded-2xl border border-border p-5 sm:p-6 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/15 transition-all duration-300 card-hover"
                  >
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-${feat.color}/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-${feat.color}/20 transition-colors`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`text-${feat.color} sm:w-[22px] sm:h-[22px]`}>
                        <path d={feat.icon} />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1.5 sm:mb-2">{feat.title}</h3>
                    <p className="text-xs text-muted leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====== CHAT SECTION ====== */}
        {view === "home" && (
          <section className="py-14 sm:py-24 border-t border-border bg-surface/50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8 sm:mb-10">
                <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-xs font-semibold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full mb-3 sm:mb-4 border border-accent/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {t(language, "chat.sectionBadge")}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">{t(language, "chat.sectionTitle")}</h2>
                <p className="text-sm sm:text-base text-muted max-w-md mx-auto">{t(language, "chat.sectionSubtitle")}</p>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl shadow-accent/5 border border-border/50">
                <ChatInterface
                  language={language}
                  onSelectMedicine={(med: any) => loadDirectSearchData(med.id)}
                />
              </div>
              <div className="mt-4">
                <Disclaimer language={language} />
              </div>
            </div>
          </section>
        )}

        {/* ====== RESULTS VIEW ====== */}
        {view === "results" && (
          <section className="py-6 sm:py-8 lg:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => {
                  setView("home");
                  setOcrData(null);
                  setMedicines([]);
                }}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4 sm:mb-6 transition-colors group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                {t(language, "results.backHome")}
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="space-y-6">
                  {ocrData && (
                    <OCRResults
                      candidates={ocrData.candidates}
                      rawText={ocrData.raw_text}
                      language={language}
                      onSelectCandidate={(cand) => {
                        if (cand.matched_medicine) {
                          handleViewDetails(cand.matched_medicine.id);
                        }
                      }}
                    />
                  )}
                  <div className="grid gap-4 stagger-children">
                    {medicines.map((med, i) => (
                      <MedicineCard
                        key={`${med.id}-${i}`}
                        medicine={med}
                        onViewDetails={handleViewDetails}
                        onViewPrices={handleViewPrices}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <ChatInterface
                    language={language}
                    medicineId={medicines[0]?.id}
                    onSelectMedicine={(med: any) => loadDirectSearchData(med.id)}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====== INFO VIEW ====== */}
        {view === "info" && selectedInfo && (
          <section className="py-8 lg:py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setView("results")}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6 transition-colors group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                {t(language, "results.backResults")}
              </button>
              <InfoPanel
                info={selectedInfo}
                language={language}
                isGenericSearch={isGenericQuery}
                onSelectMedicine={(id) => {
                  void loadDirectSearchData(id);
                  setDirectTab("prices");
                }}
                onRequireAuth={() => requestAuth({ kind: "info", id: selectedInfo.medicine.id })}
              />
              <div className="mt-6">
                <Disclaimer language={language} />
              </div>
            </div>
          </section>
        )}

        {/* ====== PRICES VIEW ====== */}
        {view === "prices" && selectedPrices && (
          <section className="py-8 lg:py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setView("results")}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6 transition-colors group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                {t(language, "results.backResults")}
              </button>

              {/* Medicine header with Save to Cabinet */}
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-5 border border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    {selectedPrices.medicine.brand_name}
                  </h3>
                  <p className="text-sm text-muted">
                    {selectedPrices.medicine.generic_name} &bull; {selectedPrices.medicine.strength} &bull; {selectedPrices.medicine.dosage_form}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Manufacturer: {selectedPrices.medicine.manufacturer}
                  </p>
                </div>
                <SaveToCabinetButton
                  medicineId={selectedPrices.medicine.id}
                  onRequireAuth={() => requestAuth({ kind: "prices", id: selectedPrices.medicine.id })}
                />
              </div>

              {/* Price Table */}
              <PriceTable comparison={selectedPrices} />
              {/* Phase-1 Feature A: check the paid price vs the DRAP MRP */}
              <MrpChecker medicine={selectedPrices.medicine} language={language} />
              <div className="mt-6">
                <Disclaimer language={language} />
              </div>
            </div>
          </section>
        )}

        {/* ====== DIRECT SEARCH VIEW (Info + Price Comparison + Quantity Calculator) ====== */}
        {view === "direct_search" && selectedInfo && selectedPrices && (
          <section className="py-6 sm:py-8 lg:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <button
                  onClick={() => {
                    setView("home");
                    setSelectedInfo(null);
                    setSelectedPrices(null);
                    setMedicines([]);
                  }}
                  className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors group self-start"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  {t(language, "results.backHome")}
                </button>

                {/* View switcher tabs: Medical Info (First) & Compare Prices (Second) */}
                <div className="flex items-center gap-1.5 bg-surface border border-border p-1 rounded-xl self-start sm:self-auto">
                  <button
                    onClick={() => setDirectTab("info")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      directTab === "info"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    📋 Medical Info
                  </button>
                  <button
                    onClick={() => setDirectTab("prices")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      directTab === "prices"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    ⚖️ Compare Prices
                  </button>
                </div>
              </div>

              {/* Layout depending on active tab */}
              {directTab === "prices" && (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Medicine summary header with Save to Cabinet */}
                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-5 border border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {isGenericQuery ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                            🧪 Generic Molecule Search
                          </span>
                          <span className="text-[11px] font-semibold text-muted">
                            {selectedPrices.prices.length} Brands Registered
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">
                          {selectedPrices.medicine.generic_name} ({selectedPrices.medicine.strength})
                        </h3>
                        <p className="text-xs text-muted mt-1">
                          Showing verified bioequivalent brands in Pakistan &bull; Ranked from lowest to highest price
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-xl font-bold text-foreground">
                          {selectedPrices.medicine.brand_name}
                        </h3>
                        <p className="text-sm text-muted">
                          {selectedPrices.medicine.generic_name} &bull; {selectedPrices.medicine.strength} &bull; {selectedPrices.medicine.dosage_form}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          Manufacturer: {selectedPrices.medicine.manufacturer}
                          {selectedPrices.medicine.registration_info && ` • DRAP Reg: ${selectedPrices.medicine.registration_info}`}
                        </p>
                      </div>
                    )}
                    <SaveToCabinetButton
                      medicineId={selectedPrices.medicine.id}
                      onRequireAuth={() => requestAuth({ kind: "direct_search", id: selectedPrices.medicine.id })}
                    />
                  </div>

                  {/* Bioequivalent Alternative Brands Comparison & Quick Switcher */}
                  {selectedInfo.cheapest_brands && selectedInfo.cheapest_brands.options.length > 1 && (
                    <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">⚖️</span>
                          <h4 className="text-sm font-bold text-foreground">
                            {isGenericQuery
                              ? "Registered Brands & Bioequivalent Alternatives"
                              : `Alternative Brands for ${selectedPrices.medicine.generic_name} ${selectedPrices.medicine.strength}`}
                          </h4>
                        </div>
                        <span className="text-[11px] font-semibold text-muted bg-surface-hover px-2.5 py-1 rounded-full border border-border">
                          {selectedInfo.cheapest_brands.options.length} Verified Brands Available
                        </span>
                      </div>

                      <p className="text-xs text-muted">
                        Click any brand below to view its price details, official DRAP MRP, and calculate quantities:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {selectedInfo.cheapest_brands.options.map((opt, idx) => {
                          const isSelected = opt.medicine_id === selectedPrices.medicine.id;
                          const isCheapest = idx === 0;
                          return (
                            <button
                              key={opt.medicine_id}
                              type="button"
                              onClick={() => {
                                void loadDirectSearchData(opt.medicine_id);
                              }}
                              className={`text-start p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm scale-[1.02]"
                                  : isCheapest
                                  ? "border-success/40 bg-success/5 hover:border-success hover:bg-success/10"
                                  : "border-border bg-background/50 hover:border-primary/40 hover:bg-surface-hover"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-sm font-bold text-foreground truncate">
                                    {opt.brand_name}
                                  </span>
                                  {isCheapest && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-success text-white shrink-0">
                                      🌟 Sab se Sasta
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted truncate">{opt.manufacturer}</p>
                              </div>

                              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                                <div>
                                  <span className="text-xs font-extrabold text-foreground">Rs. {opt.per_unit.toFixed(2)}</span>
                                  <span className="text-[10px] text-muted"> / unit</span>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    isSelected
                                      ? "bg-primary text-white"
                                      : "bg-surface text-muted border border-border"
                                  }`}
                                >
                                  {isSelected ? "✓ Active" : "Select"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price Comparison Table & Custom Quantity Calculator */}
                  <PriceTable comparison={selectedPrices} />

                  {/* MRP / Overcharge Checker */}
                  <MrpChecker medicine={selectedPrices.medicine} language={language} />

                  {/* AI Assistant Chat */}
                  <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                    <div className="px-4 py-3 bg-surface-hover border-b border-border flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="text-xs font-bold text-foreground">AI Medicine Assistant</span>
                    </div>
                    <ChatInterface
                      language={language}
                      medicineId={selectedPrices.medicine.id}
                      onSelectMedicine={(med: any) => loadDirectSearchData(med.id)}
                    />
                  </div>
                </div>
              )}

              {directTab === "info" && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <InfoPanel
                    info={selectedInfo}
                    language={language}
                    isGenericSearch={isGenericQuery}
                    onSelectMedicine={(id) => {
                      void loadDirectSearchData(id);
                      setDirectTab("prices");
                    }}
                    onRequireAuth={() => requestAuth({ kind: "direct_search", id: selectedInfo.medicine.id })}
                  />
                </div>
              )}

              <div className="mt-8">
                <Disclaimer language={language} />
              </div>
            </div>
          </section>
        )}


        {/* ====== LOADING / ERROR ====== */}
        {isProcessing && view !== "home" && (
          <LoadingSpinner text={t(language, "loading.text")} />
        )}
        {error && (
          <div className="max-w-lg mx-auto px-4 py-4 animate-fade-in">
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div>
                <p className="text-sm font-medium text-danger">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-muted hover:text-foreground mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer language={language} />

      <CabinetModal
        isOpen={showCabinetModal}
        onClose={() => setShowCabinetModal(false)}
        language={language}
      />

      {showGuideModal && (
        <OnboardingGuideModal
          language={language}
          onClose={() => setShowGuideModal(false)}
          onAction={handleGuideAction}
        />
      )}
    </div>
  );
}
