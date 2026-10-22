"use client";

/**
 * Afiya AI — Main Web Application View Controller
 * Author / Developer: Mubashir (Lead Developer)
 */

import AppIcon from "@/components/shared/AppIcon";
import { useEffect, useState, useRef } from "react";
import HomeLanding from "@/components/home/HomeLanding";
import { useUser, useClerk } from "@clerk/nextjs";
import Header from "@/components/layout/Header";
import StoreCatalog from "@/components/marketplace/StoreCatalog";
import OCRCartStaging from "@/components/marketplace/OCRCartStaging";
import OCRBusyFallback from "@/components/marketplace/OCRBusyFallback";
import {useMarketplace} from "@/components/marketplace/MarketplaceProvider";
import Footer from "@/components/layout/Footer";
import DataSourceNotice from "@/components/layout/DataSourceNotice";
import OCRReview from "@/components/upload/OCRReview";
import { enrichOCRCandidates, mergeOCRRescan } from "@/lib/ocrReview";
import OCRResults from "@/components/upload/OCRResults";
import MedicineCard from "@/components/medicine/MedicineCard";
import PriceTable from "@/components/medicine/PriceTable";
import MrpChecker from "@/components/medicine/MrpChecker";
import InfoPanel from "@/components/medicine/InfoPanel";
import SaveToCabinetButton from "@/components/medicine/SaveToCabinetButton";
import ChatInterface from "@/components/chat/ChatInterface";
import CabinetModal from "@/components/medicine/CabinetModal";
import OnboardingGuideModal from "@/components/guide/OnboardingGuideModal";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import Disclaimer from "@/components/shared/Disclaimer";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import VoiceButton from "@/components/shared/VoiceButton";
import LASAConfirmationGate from "@/components/medicine/LASAConfirmationGate";
import type {
  Language,
  MedicineCandidate,
  MedicineDetail,
  PriceComparison,
  MedicineInfo,
  OCRResponse,
  AuthUser,
  LASAWarning,
  SafetyAssessment,
  LASACandidate,
} from "@/lib/types";
import { extractFromImage, matchMedicine, getPrices, getMedicineInfo, getMedicinesByCategory, setOnUnauthorized, isOCRServiceBusy } from "@/lib/api";
import { isLoggedIn, getCurrentUser, clearSession } from "@/lib/auth";
import { getCategoryDisplayName } from "@/lib/constants";
import { t } from "@/lib/i18n";

type View = "home" | "results" | "info" | "prices" | "direct_search";

type PendingAction =
  | { kind: "info"; id: string }
  | { kind: "prices"; id: string }
  | { kind: "direct_search"; id: string }
  | { kind: "search"; query: string }
  | { kind: "category"; category: string }
  | { kind: "upload" };

export default function Home() {
  const marketplace = useMarketplace();
  const { isSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();
  const [view, setView] = useState<View>("home");
  const [homeSection, setHomeSection] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [medicines, setMedicines] = useState<MedicineDetail[]>([]);
  const [candidates, setCandidates] = useState<MedicineCandidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const scanSerial = useRef(0);
  const scanAbort = useRef<AbortController | null>(null);
  const [ocrData, setOcrData] = useState<OCRResponse | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<MedicineInfo | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<PriceComparison | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [directTab, setDirectTab] = useState<"info" | "prices">("info");
  const [isGenericQuery, setIsGenericQuery] = useState(false);
  const [switchingBrandId, setSwitchingBrandId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
  const [lasaWarning, setLasaWarning] = useState<LASAWarning | null>(null);
  const [currentSafety, setCurrentSafety] = useState<SafetyAssessment | null>(null);

  useEffect(() => () => {
    scanSerial.current++;
    scanAbort.current?.abort();
  }, []);

  useEffect(() => {
    if (view === "results" && ocrData) {
      const confirmed = ocrData.candidates.filter(c => c.is_verified && c.reviewed && !c.needs_confirmation && c.matched_medicine).map(c => c.matched_medicine!);
      setMedicines(Array.from(new Map(confirmed.map(m => [m.id, m])).values()));
    }
  }, [ocrData, view]);

  // Cabinet, Guide & Feedback Modal State
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // === Auth state ===
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
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
        setAuthPromptMessage(null);
        if (pending.kind === "info") void handleViewDetails(pending.id);
        if (pending.kind === "prices") void handleViewPrices(pending.id);
        if (pending.kind === "direct_search") void loadDirectSearchData(pending.id);
        if (pending.kind === "search") {
          setSearchQuery(pending.query);
          void executeSearch(pending.query);
        }
        if (pending.kind === "category") void executeCategorySearch(pending.category);
      }
    } else if (!isSignedIn) {
      setAuthUser(getCurrentUser());
    }
  }, [isSignedIn, clerkUser]);

  const requestAuth = (pending?: PendingAction, reason?: string) => {
    if (pending) {
      pendingRef.current = pending;
    }
    const message = reason || t(language, "auth.infoRequired");
    setAuthPromptMessage(message);

    if (isSignedIn || authUser) {
      // User is already authenticated in Clerk / local session - execute action immediately
      setAuthPromptMessage(null);
      if (pending) {
        pendingRef.current = null;
        if (pending.kind === "info") void handleViewDetails(pending.id);
        if (pending.kind === "prices") void handleViewPrices(pending.id);
        if (pending.kind === "direct_search") void loadDirectSearchData(pending.id);
        if (pending.kind === "search") {
          setSearchQuery(pending.query);
          void executeSearch(pending.query);
        }
        if (pending.kind === "category") void executeCategorySearch(pending.category);
      }
      return;
    }
    try {
      clerk.openSignIn();
    } catch {}
  };

  // Hydrate the session from localStorage after mount & trigger guide on first visit
  useEffect(() => {
    setAuthUser(getCurrentUser());
  }, []);

  // Strict route/view guard: unauthenticated users cannot view info, prices, direct_search or results
  useEffect(() => {
    if (!isSignedIn && !authUser && (view === "info" || view === "prices" || view === "direct_search" || view === "results")) {
      setView("home");
      setSelectedInfo(null);
      setSelectedPrices(null);
      setMedicines([]);
    }
  }, [isSignedIn, authUser, view]);

  // Always reset scroll to top when changing views
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [view]);

  useEffect(() => {
    if (view === "home" && homeSection) {
      document.getElementById(homeSection)?.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
      setHomeSection(null);
    }
  }, [homeSection, view]);

  // Any 401 drops session and requests sign in
  useEffect(() => {
    setOnUnauthorized(() => {
      setAuthUser(null);
      requestAuth(undefined, t(language, "auth.sessionExpired"));
    });
  }, [language]);

  const handleGuideAction = (actionType: "search" | "category" | "upload" | "chat", payload?: string) => {
    setShowGuideModal(false);
    if (actionType === "search" && payload) {
      setSearchQuery(payload);
      if (!isSignedIn && !authUser) {
        requestAuth({ kind: "search", query: payload }, t(language, "auth.searchRequired"));
        return;
      }
      void executeSearch(payload);
    } else if (actionType === "category" && payload) {
      if (!isSignedIn && !authUser) {
        requestAuth({ kind: "category", category: payload }, t(language, "auth.categoryRequired"));
        return;
      }
      void executeCategorySearch(payload);
    } else if (actionType === "upload") {
      if (!isSignedIn && !authUser) {
        requestAuth({ kind: "upload" }, t(language, "auth.uploadRequired"));
        return;
      }
      setView("home");
      setHomeSection("prescription-upload");
    } else if (actionType === "chat") {
      setView("home");
      setHomeSection("medicine-help");
    }
  };

  const loadDirectSearchData = async (id: string, isGeneric = false) => {
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "direct_search", id }, t(language, "auth.infoRequired"));
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const [info, prices] = await Promise.all([
        getMedicineInfo(id, language),
        getPrices(id),
      ]);

      // When searching by generic formula, ensure the cheapest brand is displayed first
      if (isGeneric && info.cheapest_brands && info.cheapest_brands.options.length > 0) {
        const cheapestOpt = info.cheapest_brands.options[0];
        if (cheapestOpt.medicine_id !== id) {
          const [cheapestInfo, cheapestPrices] = await Promise.all([
            getMedicineInfo(cheapestOpt.medicine_id, language),
            getPrices(cheapestOpt.medicine_id),
          ]);
          setSelectedInfo(cheapestInfo);
          setSelectedPrices(cheapestPrices);
          setView("direct_search");
          window.scrollTo({ top: 0, behavior: "instant" });
          return;
        }
      }

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

  const handleBrandSwitch = async (id: string) => {
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "info", id }, t(language, "auth.infoRequired"));
      return;
    }
    if (switchingBrandId || (selectedPrices && selectedPrices.medicine.id === id)) return;
    setSwitchingBrandId(id);
    setError(null);
    try {
      const [info, prices] = await Promise.all([
        getMedicineInfo(id, language),
        getPrices(id),
      ]);
      setSelectedInfo(info);
      setSelectedPrices(prices);
      // Note: Do not reset isGenericQuery to false so the generic heading persists when comparing brands!
      setMedicines([info.medicine]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.loadInfo"));
    } finally {
      setSwitchingBrandId(null);
    }
  };

  const handleSignOut = () => {
    clearSession();
    setAuthUser(null);
    setView("home");
    setSelectedInfo(null);
    setSelectedPrices(null);
    setMedicines([]);
  };

  const applyOCRResult = async (result: OCRResponse, serial: number) => {
    if (serial !== scanSerial.current) return;
    // Show the transcription immediately; catalog availability must not hide it.
    setOcrData({ ...result, candidates: result.candidates.map(c => ({ ...c, is_verified: false, reviewed: false, matched_medicine: null, needs_confirmation: true })) });
    setMedicines([]);
    setView("results");
    setIsScanning(false);
    const signal = scanAbort.current?.signal;
    const enriched = await enrichOCRCandidates(result.candidates, (text, strength, form) =>
      matchMedicine(text, strength, form, { timeoutMs: 8000, signal }));
    if (serial !== scanSerial.current) return;
    setOcrData({ ...result, candidates: enriched });
    setMedicines(enriched.filter(c => c.is_verified && c.matched_medicine).map(c => c.matched_medicine!));
    setView("results");
  };

  const handleImageSelected = async (file: File) => {
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "upload" }, t(language, "auth.uploadRequired"));
      return;
    }
    const serial = ++scanSerial.current;
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    setPrescriptionFile(file); setOcrData(null); setMedicines([]); setOcrBusy(false);
    setIsScanning(true);
    setIsProcessing(true); setError(null);
    try {
      await applyOCRResult(await extractFromImage(file, { signal: controller.signal }), serial);
    } catch(e) {
      if (serial === scanSerial.current) {
        if(isOCRServiceBusy(e)){setOcrBusy(true);setError(null);}
        else setError(e instanceof Error ? e.message : "Failed to process image");
      }
    } finally { if (serial === scanSerial.current) { scanAbort.current = null; setIsProcessing(false); setIsScanning(false); } }
  };

  const handleRemoveImage = () => {
    setOcrBusy(false);
    scanSerial.current++;
    scanAbort.current?.abort();
    scanAbort.current = null;
    setPrescriptionFile(null);
    setOcrData(null);
    setCandidates([]);
    setMedicines([]);
    setIsScanning(false);
    setIsProcessing(false);
    setError(null);
    setChatPrompt(null);
    setView("home");
    setHomeSection("prescription-upload");
  };

  const handleOCRRescan = async (region?: number[]) => {
    setOcrBusy(false);
    if (!prescriptionFile || !ocrData) return;
    const serial = ++scanSerial.current;
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    setIsScanning(true);
    setIsProcessing(true); setError(null);
    try {
      const result = await extractFromImage(prescriptionFile, { forceRefresh: true, scanMode: "thorough", region, signal: controller.signal });
      await applyOCRResult(region ? { ...ocrData, candidates: mergeOCRRescan(ocrData.candidates,result.candidates),
        warnings: [...new Set([...(ocrData.warnings ?? []),...(result.warnings ?? [])])],review_required:true } : result, serial);
    } catch (e) {
      if (serial === scanSerial.current) {
        if(isOCRServiceBusy(e)){setOcrBusy(true);setError(null);}
        else setError(e instanceof Error ? e.message : "Could not rescan the prescription.");
      }
    } finally { if (serial === scanSerial.current) { scanAbort.current = null; setIsProcessing(false); setIsScanning(false); } }
  };

  const handleOCRCorrection = async (index: number | null, candidate: MedicineCandidate) => {
    if (!ocrData) return;
    const serial = scanSerial.current;
    const [enriched] = await enrichOCRCandidates([candidate], (text, strength, form) =>
      matchMedicine(text, strength, form, { timeoutMs: 8000 }));
    if (serial !== scanSerial.current) return;
    setOcrData(previous => {
      if (!previous) return previous;
      const list = [...previous.candidates];
      if (index === null) list.push({ ...enriched, line_id: "manual-" + Date.now() }); else list[index] = enriched;
      return { ...previous, candidates: list, raw_text: list.map(c => c.raw_text).join(", ") };
    });
  };

  const handleSelectLASACandidate = async (candidate: LASACandidate) => {
    setLasaWarning(null);
    setSearchQuery(candidate.brand_name);
    await loadDirectSearchData(candidate.id);
  };

  const executeSearch = async (q: string) => {
    setIsSearching(true);
    setIsProcessing(true);
    setError(null);
    setLasaWarning(null);
    setCurrentSafety(null);
    try {
      const match = await matchMedicine(q);
      if (match.safety) {
        setCurrentSafety(match.safety);
      }
      if (match.lasa_warning && match.lasa_warning.confirmation_required) {
        setLasaWarning(match.lasa_warning);
        return;
      }

      if (match.medicine) {
        const qLower = q.toLowerCase();
        const genLower = match.medicine.generic_name.toLowerCase();
        const isGeneric = genLower.includes(qLower) || qLower.includes(genLower);
        setIsGenericQuery(isGeneric);
        if (isGeneric) {
          setDirectTab("prices");
        }
        setMedicines([match.medicine]);
        await loadDirectSearchData(match.medicine.id, isGeneric);
      } else if (match.alternatives && match.alternatives.length > 0) {
        // Multi-brand generic match (e.g. Paracetamol, Ibuprofen, Omeprazole)
        setIsGenericQuery(true);
        setMedicines(match.alternatives);
        const topMedId = match.alternatives[0].id;
        setDirectTab("prices");
        await loadDirectSearchData(topMedId, true);
      } else {
        setError(t(language, "error.noMatch"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.searchFailed"));
    } finally {
      setIsProcessing(false);
      setIsSearching(false);
    }
  };

  const handleSearch = async (customQuery?: string | React.MouseEvent) => {
    const q = (typeof customQuery === "string" ? customQuery : searchQuery).trim();
    if (!q) return;
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "search", query: q }, t(language, "auth.searchRequired"));
      return;
    }
    await executeSearch(q);
  };

  const handleViewDetails = async (id: string) => {
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "info", id }, t(language, "auth.infoRequired"));
      return;
    }
    setIsGenericQuery(false);
    setIsProcessing(true);
    setError(null);
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
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "prices", id }, t(language, "auth.infoRequired"));
      return;
    }
    setIsGenericQuery(false);
    setIsProcessing(true);
    setError(null);
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

  const executeCategorySearch = async (category: string) => {
    setIsGenericQuery(false);
    setCurrentSafety(null);
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

  const handleCategorySearch = async (category: string) => {
    if (!isSignedIn && !authUser) {
      requestAuth({ kind: "category", category }, t(language, "auth.categoryRequired"));
      return;
    }
    await executeCategorySearch(category);
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
        onOpenFeedback={() => setShowFeedbackModal(true)}
        onNavigateHome={(section) => {
          setHomeSection(section ?? null);
          setView("home");
          setSelectedInfo(null);
          setSelectedPrices(null);
          setOcrData(null);
          setMedicines([]);
          setSearchQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <DataSourceNotice language={language} />

      {/* Mandatory Sign-In Alert Banner */}
      {authPromptMessage && !isSignedIn && !authUser && (
        <div className="sticky top-16 z-40 bg-surface    border-b border-amber-500/30 backdrop-blur-md px-4 py-3 sm:py-3.5 shadow-md animate-slide-down">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-base shadow-sm">
                <AppIcon symbol="🔒" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground">
                  {language === "ur" ? "سائن ان یا سائن اپ ضروری ہے" : language === "roman_ur" ? "Sign In / Sign Up Zaroori Hai" : "Sign In / Sign Up Required"}
                </p>
                <p className="text-[11px] sm:text-xs text-muted font-medium">
                  {authPromptMessage}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  try {
                    clerk.openSignIn();
                  } catch {}
                }}
                className="bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md  hover:scale-105 cursor-pointer"
              >
                {t(language, "nav.signIn")} / {t(language, "auth.signUpTab")} →
              </button>
              <button
                type="button"
                onClick={() => setAuthPromptMessage(null)}
                className="text-muted hover:text-foreground text-xs p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer"
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {ocrBusy && prescriptionFile && <OCRBusyFallback file={prescriptionFile}/>}
        {view === "home" && <aside className="page-shell pharmacist-callout"><div><span className="pharmacist-availability" aria-hidden="true"/><p><strong>Prefer a helping hand?</strong> Send your prescription for a pharmacist to prepare your cart.</p></div><button onClick={()=>marketplace.openConcierge(prescriptionFile)}>Ask a pharmacist <span aria-hidden="true">↗</span></button></aside>}
        {/* Local medicine workspace */}
        {view === "home" && <HomeLanding prescriptionFile={prescriptionFile} onRemoveImage={handleRemoveImage} language={language} isProcessing={isProcessing} isScanning={isScanning} isAuthenticated={Boolean(isSignedIn || authUser)} onUpload={handleImageSelected} onRequireAuth={() => requestAuth({kind:"upload"}, t(language,"auth.uploadRequired"))} onCategory={handleCategorySearch} onGuide={() => setShowGuideModal(true)} onFeedback={() => setShowFeedbackModal(true)} onCabinet={() => { if(isSignedIn || authUser) setShowCabinetModal(true); else requestAuth(undefined, t(language,"auth.infoRequired")); }} chat={<ChatInterface language={language} onSelectMedicine={(med:MedicineDetail) => { if(!isSignedIn && !authUser) {requestAuth({kind:"direct_search",id:med.id},t(language,"auth.infoRequired"));return;} void loadDirectSearchData(med.id); }}/>}>{/* Search bar */}
                  <div className="search-controls flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full mb-3">
                    <div className="relative flex-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors ${isSearching ? "text-primary animate-pulse" : "text-muted"}`}>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="search"
                        aria-label={t(language, "hero.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !isProcessing && handleSearch()}
                        placeholder={t(language, "hero.searchPlaceholder")}
                        disabled={isSearching}
                        className={`w-full bg-surface/80 backdrop-blur-sm border rounded-xl pl-11 pr-14 py-3 sm:py-3.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm ${
                          isSearching ? "border-primary/50 ring-2 ring-primary/20 bg-surface" : "border-border focus:border-primary"
                        }`}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {isSearching ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping mr-2" />
                        ) : (
                          <VoiceButton
                            language={language}
                            size="sm"
                            onTranscript={(spokenMedicine) => {
                              const trimmed = spokenMedicine.trim();
                              if (trimmed) {
                                setSearchQuery(trimmed);
                                handleSearch(trimmed);
                              }
                            }}
                            onInterimTranscript={(interim) => {
                              setSearchQuery(interim);
                            }}
                            title={
                              language === "ur"
                                ? "بول کر دوا تلاش کریں"
                                : language === "roman_ur"
                                ? "Bol kar dawa talash karein"
                                : "Speak medicine name to search"
                            }
                          />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSearch()}
                      disabled={isProcessing || !searchQuery.trim()}
                      className={`bg-primary hover:bg-primary-dark disabled:opacity-60 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl font-semibold text-sm transition-all duration-300  shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 ${
                        isSearching ? "ring-2 ring-primary/40 shadow-lg " : ""
                      }`}
                    >
                      {isSearching ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>
                            {language === "ur"
                              ? "تلاش جاری ہے..."
                              : language === "roman_ur"
                              ? "Talash..."
                              : "Searching..."}
                          </span>
                        </>
                      ) : (
                        t(language, "hero.searchBtn")
                      )}
                    </button>
                  </div>

                  {/* Dynamic search progress feedback banner */}
                  {isSearching && (
                    <div className="w-full max-w-md mb-6 p-3 bg-surface/95 border border-primary/30 rounded-xl shadow-lg backdrop-blur-md animate-fade-in flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <svg className="animate-spin w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground truncate">
                            {language === "ur"
                              ? `ڈیٹا بیس میں تلاش ہو رہی ہے: "${searchQuery}"`
                              : language === "roman_ur"
                              ? `Database mein talash ho rahi hai: "${searchQuery}"`
                              : `Searching database for "${searchQuery}"...`}
                          </span>
                          <span className="text-[10px] text-primary font-mono font-bold shrink-0 ml-2 animate-pulse">
                            DRAP Baseline
                          </span>
                        </div>
                        <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full bg-primary animate-shimmer rounded-full w-full" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Look-Alike / Sound-Alike (LASA) Interactive Confirmation Gate */}
                  {lasaWarning && (
                    <div className="w-full max-w-xl mb-6">
                      <LASAConfirmationGate
                        warning={lasaWarning}
                        language={language}
                        onSelectCandidate={handleSelectLASACandidate}
                        onCancel={() => setLasaWarning(null)}
                      />
                    </div>
                  )}

                  </HomeLanding>}

        {view === "home" && <StoreCatalog language={language} prescriptionFile={prescriptionFile}/>}
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
                    <>
                    <OCRReview file={prescriptionFile} data={ocrData} language={language} busy={isProcessing} scanning={isScanning} onRemove={handleRemoveImage} onEdit={handleOCRCorrection} onRescan={handleOCRRescan} />
                    <OCRCartStaging candidates={ocrData.candidates} file={prescriptionFile} busy={isProcessing}/>
                    <OCRResults
                      candidates={ocrData.candidates}
                      rawText={ocrData.raw_text}
                      clinicalSummary={ocrData.clinical_summary}
                      globalSafetyNotes={ocrData.global_safety_notes}
                      language={language}
                      onAskAI={(prompt) => {
                        setChatPrompt(prompt);
                      }}
                      onSelectCandidate={(cand) => {
                        if (cand.matched_medicine) {
                          handleViewDetails(cand.matched_medicine.id);
                        }
                      }}
                    />
                    </>
                  )}
                  <div className="grid gap-4 stagger-children">
                    {medicines.map((med, i) => (
                      <MedicineCard
                        key={`${med.id}-${i}`}
                        medicine={med}
                        onAddToCart={ocrData ? undefined : (id)=>marketplace.addItems([{medicine_id:id,quantity:1}])}
                        onViewDetails={handleViewDetails}
                        onViewPrices={handleViewPrices}
                        language={language}
                        safety={med.safety ?? (medicines.length === 1 ? currentSafety : null)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <ChatInterface
                    language={language}
                    medicineId={medicines[0]?.id}
                    externalPrompt={chatPrompt || undefined}
                    prescriptionContext={ocrData?.clinical_summary || undefined}
                    onSelectMedicine={(med: MedicineDetail) => {
                      if (!isSignedIn && !authUser) {
                        requestAuth({ kind: "direct_search", id: med.id }, t(language, "auth.infoRequired"));
                        return;
                      }
                      loadDirectSearchData(med.id);
                    }}
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
              <div className="bg-surface rounded-2xl p-5 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
              <PriceTable
                comparison={selectedPrices}
                cheapestBrands={selectedInfo?.cheapest_brands}
                onSelectBrand={handleBrandSwitch}
                switchingId={switchingBrandId}
              />
              {/* Phase-1 Feature A: check the paid price vs the DRAP MRP */}
              <MrpChecker key={selectedPrices.medicine.id} medicine={selectedPrices.medicine} language={language} packSize={selectedPrices.prices[0]?.package_size} />
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
                    <AppIcon symbol="📋" /> Medical Info
                  </button>
                  <button
                    onClick={() => setDirectTab("prices")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      directTab === "prices"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <AppIcon symbol="⚖️" /> Compare Prices
                  </button>
                </div>
              </div>

              {/* Main Heading for Generic Molecule Search */}
              {isGenericQuery && (
                <div className="mb-6 sm:mb-8 bg-surface    rounded-3xl border border-primary/20 p-6 sm:p-8 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 flex items-center gap-1.5 shadow-sm">
                      <span><AppIcon symbol="🧪" /></span>
                      <span>Generic Formula / فعال جزو</span>
                    </span>
                    <span className="text-xs font-semibold text-muted bg-surface px-2.5 py-1 rounded-full border border-border">
                      {selectedInfo.cheapest_brands?.options?.length ?? 1} Catalog Brands
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
                    {selectedPrices.medicine.generic_name}{" "}
                    <span className="text-primary font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl">
                      ({selectedPrices.medicine.strength})
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm md:text-base text-muted mt-2.5 max-w-3xl leading-relaxed">
                    {language === "ur"
                      ? `${selectedPrices.medicine.generic_name} کے یکساں جزو، طاقت اور شکل والے ڈیٹا بیس برانڈز کی حوالہ قیمتیں نیچے دیکھیں۔ دوا تبدیل کرنے سے پہلے فارماسسٹ سے پوچھیں۔`
                      : language === "roman_ur"
                      ? `${selectedPrices.medicine.generic_name} ke matching ingredient, strength aur form wale catalog brands ki reference qeematein neeche dekhein. Dawa badalne se pehle pharmacist se poochein.`
                      : `Stored reference prices for catalog brands matching ${selectedPrices.medicine.generic_name} (${selectedPrices.medicine.strength} ${selectedPrices.medicine.dosage_form}). Consult your pharmacist before switching brands.`}
                  </p>
                </div>
              )}

              {/* Layout depending on active tab */}
              {directTab === "prices" && (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Medicine summary header with Save to Cabinet */}
                  <div className="bg-surface rounded-2xl p-5 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {isGenericQuery ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/25">
                            Active Selected Brand
                          </span>
                          <span className="text-xs text-muted">
                            {selectedPrices.medicine.manufacturer}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                          <span>{selectedPrices.medicine.brand_name}</span>
                          <span className="text-xs font-normal text-muted">({selectedPrices.medicine.dosage_form})</span>
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          DRAP Reg: {selectedPrices.medicine.registration_info || "Not recorded"} &bull; Pack: {selectedPrices.prices[0]?.package_size || "Not recorded"}
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
                          <span className="text-base"><AppIcon symbol="⚖️" /></span>
                          <h4 className="text-sm font-bold text-foreground">
                            {isGenericQuery
                              ? `Compare All Brands for ${selectedPrices.medicine.generic_name} (${selectedPrices.medicine.strength})`
                              : `Alternative Brands for ${selectedPrices.medicine.generic_name} ${selectedPrices.medicine.strength}`}
                          </h4>
                        </div>
                        <span className="text-[11px] font-semibold text-muted bg-surface-hover px-2.5 py-1 rounded-full border border-border">
                          {selectedInfo.cheapest_brands.options.length} Catalog Brands Available
                        </span>
                      </div>

                      <p className="text-xs text-muted">
                        Click any brand below to view its price details, stored reference prices, and calculate quantities:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {selectedInfo.cheapest_brands.options.map((opt, idx) => {
                          const isSelected = opt.medicine_id === selectedPrices.medicine.id;
                          const isCheapest = idx === 0;
                          const isSwitchingThis = switchingBrandId === opt.medicine_id;
                          return (
                            <button
                              key={opt.medicine_id}
                              type="button"
                              onClick={() => {
                                void handleBrandSwitch(opt.medicine_id);
                              }}
                              disabled={isSwitchingThis}
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
                                      <AppIcon symbol="🌟" /> Sab se Sasta
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
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md transition-all ${
                                    isSelected
                                      ? "bg-primary text-white shadow-sm"
                                      : "bg-surface text-muted border border-border hover:border-primary"
                                  }`}
                                >
                                  {isSwitchingThis ? "Loading..." : isSelected ? "✓ Active" : "Select"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price Comparison Table & Custom Quantity Calculator */}
                  <PriceTable
                    comparison={selectedPrices}
                    cheapestBrands={selectedInfo.cheapest_brands}
                    onSelectBrand={handleBrandSwitch}
                    switchingId={switchingBrandId}
                  />

                  {/* MRP / Overcharge Checker */}
                  <MrpChecker key={selectedPrices.medicine.id} medicine={selectedPrices.medicine} language={language} packSize={selectedPrices.prices[0]?.package_size} />

                  {/* AI Assistant Chat */}
                  <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                    <div className="px-4 py-3 bg-surface-hover border-b border-border flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="text-xs font-bold text-foreground">AI Medicine Assistant</span>
                    </div>
                    <ChatInterface
                      language={language}
                      medicineId={selectedPrices.medicine.id}
                      onSelectMedicine={(med: MedicineDetail) => {
                        void handleBrandSwitch(med.id);
                        setDirectTab("prices");
                      }}
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
                      void handleBrandSwitch(id);
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

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        language={language}
      />
    </div>
  );
}
