"use client";

import { useState } from "react";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ImageUploader from "@/components/upload/ImageUploader";
import OCRResults from "@/components/upload/OCRResults";
import MedicineCard from "@/components/medicine/MedicineCard";
import PriceTable from "@/components/medicine/PriceTable";
import MrpChecker from "@/components/medicine/MrpChecker";
import InfoPanel from "@/components/medicine/InfoPanel";
import ChatInterface from "@/components/chat/ChatInterface";
import Disclaimer from "@/components/shared/Disclaimer";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import type {
  Language,
  MedicineCandidate,
  MedicineDetail,
  PriceComparison,
  MedicineInfo,
  OCRResponse,
} from "@/lib/types";
import { extractFromImage, matchMedicine, getPrices, getMedicineInfo, getMedicinesByCategory } from "@/lib/api";
import { CATEGORY_ICONS } from "@/lib/constants";
import { t } from "@/lib/i18n";

type View = "home" | "results" | "info" | "prices";

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("home");
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<OCRResponse | null>(null);
  const [medicines, setMedicines] = useState<MedicineDetail[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<MedicineInfo | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<PriceComparison | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImageSelected = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await extractFromImage(file);
      setOcrData(result);
      setView("results");

      const matched: MedicineDetail[] = [];
      for (const candidate of result.candidates) {
        try {
          const match = await matchMedicine(candidate.raw_text);
          if (match.medicine) matched.push(match.medicine);
        } catch { /* skip unmatched */ }
      }
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
      if (match.medicine) {
        setMedicines([match.medicine]);
        setView("results");
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
    setIsProcessing(true);
    try {
      const info = await getMedicineInfo(id, language);
      setSelectedInfo(info);
      setView("info");
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.loadInfo"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPrices = async (id: string) => {
    setIsProcessing(true);
    try {
      const prices = await getPrices(id);
      setSelectedPrices(prices);
      setView("prices");
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, "error.loadPrices"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCategorySearch = async (category: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const medicines = await getMedicinesByCategory(category);
      if (medicines.length > 0) {
        setMedicines(medicines);
        setView("results");
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
    <div dir={language === "ur" ? "rtl" : "ltr"}>
      <Header language={language} onLanguageChange={setLanguage} />

      <main className="flex-1">
        {/* ====== HERO SECTION ====== */}
        {view === "home" && (
          <section className="relative overflow-hidden min-h-[90vh] flex items-center">
            {/* Animated background */}
            <div className="absolute inset-0 hero-gradient" />
            <div className="absolute top-20 right-10 w-72 h-72 bg-primary/8 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/8 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />

            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                {/* Left: Text + CTA */}
                <div className="animate-slide-up">
                  <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-primary/10">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    {t(language, "hero.badge")}
                  </div>

                  <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
                    {t(language, "hero.title1")}{" "}
                    <span className="text-gradient">{t(language, "hero.titleHighlight")}</span>{" "}
                    {t(language, "hero.title2")}
                  </h1>

                  <p className="text-lg text-muted leading-relaxed mb-10 max-w-lg">
                    {t(language, "hero.description")}
                  </p>

                  {/* Search bar */}
                  <div className="flex gap-3 max-w-md mb-8">
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
                        className="w-full bg-surface/80 backdrop-blur-sm border border-border rounded-2xl pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={isProcessing || !searchQuery.trim()}
                      className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-7 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 shrink-0"
                    >
                      {t(language, "hero.searchBtn")}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-8 text-sm">
                    {[
                      { num: t(language, "hero.stat1Num"), label: t(language, "hero.stat1Label"), color: "primary" },
                      { num: t(language, "hero.stat2Num"), label: t(language, "hero.stat2Label"), color: "accent" },
                      { num: t(language, "hero.stat3Num"), label: t(language, "hero.stat3Label"), color: "success" },
                    ].map((stat) => (
                      <div key={stat.label} className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl bg-${stat.color}/10 flex items-center justify-center`}>
                          <span className={`text-${stat.color} font-bold text-xs`}>{stat.num}</span>
                        </div>
                        <span className="text-muted">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Hero image + Upload */}
                <div className="animate-fade-in space-y-6" style={{ animationDelay: "0.3s" }}>
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 border border-border/30 card-hover">
                    <Image
                      src="/hero-banner.png"
                      alt="Medical AI visualization"
                      width={800}
                      height={460}
                      className="w-full h-auto"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
                    {/* Floating badge */}
                    <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-md rounded-xl px-4 py-2.5 border border-border/30 shadow-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-xs font-semibold text-foreground">{t(language, "hero.drapBadge")}</span>
                      </div>
                    </div>
                  </div>

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
          <section className="py-20 border-t border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-14">
                <h2 className="text-3xl font-bold text-foreground mb-3">{t(language, "category.title")}</h2>
                <p className="text-muted max-w-lg mx-auto">{t(language, "category.subtitle")}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 stagger-children">
                {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
                  <button
                    key={cat}
                    onClick={() => handleCategorySearch(cat)}
                    className="group bg-surface rounded-2xl border border-border p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 text-center card-hover"
                  >
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
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
          <section id="how-it-works" className="py-24 border-t border-border bg-surface/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-foreground mb-3">{t(language, "howItWorks.title")}</h2>
                <p className="text-muted max-w-lg mx-auto">{t(language, "howItWorks.subtitle")}</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8 stagger-children">
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
                    className="relative bg-surface rounded-2xl border border-border p-8 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group card-hover"
                  >
                    {/* Step number watermark */}
                    <span className="absolute top-4 right-6 text-7xl font-black text-border/30 group-hover:text-primary/10 transition-colors leading-none select-none">
                      {item.step}
                    </span>

                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={item.icon} />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 relative">{item.title}</h3>
                    <p className="text-sm text-muted leading-relaxed relative">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====== FEATURES ====== */}
        {view === "home" && (
          <section id="features" className="py-24 border-t border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-foreground mb-3">{t(language, "features.title")}</h2>
                <p className="text-muted max-w-lg mx-auto">{t(language, "features.subtitle")}</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
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
                    className="group bg-surface rounded-2xl border border-border p-6 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/15 transition-all duration-300 card-hover"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-${feat.color}/10 flex items-center justify-center mb-5 group-hover:bg-${feat.color}/20 transition-colors`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`text-${feat.color}`}>
                        <path d={feat.icon} />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-2">{feat.title}</h3>
                    <p className="text-xs text-muted leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====== CHAT SECTION ====== */}
        {view === "home" && (
          <section className="py-24 border-t border-border bg-surface/50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-xs font-semibold px-4 py-2 rounded-full mb-4 border border-accent/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {t(language, "chat.sectionBadge")}
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-3">{t(language, "chat.sectionTitle")}</h2>
                <p className="text-muted max-w-md mx-auto">{t(language, "chat.sectionSubtitle")}</p>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl shadow-accent/5 border border-border/50">
                <ChatInterface language={language} />
              </div>
              <div className="mt-4">
                <Disclaimer language={language} />
              </div>
            </div>
          </section>
        )}

        {/* ====== RESULTS VIEW ====== */}
        {view === "results" && (
          <section className="py-8 lg:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => { setView("home"); setOcrData(null); setMedicines([]); }}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6 transition-colors group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                {t(language, "results.backHome")}
              </button>

              <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {ocrData && (
                    <OCRResults
                      candidates={ocrData.candidates}
                      rawText={ocrData.raw_text}
                      onSelectCandidate={() => {}}
                    />
                  )}
                  <div className="grid gap-4 stagger-children">
                    {medicines.map((med) => (
                      <MedicineCard
                        key={med.id}
                        medicine={med}
                        onViewDetails={handleViewDetails}
                        onViewPrices={handleViewPrices}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <ChatInterface language={language} medicineId={medicines[0]?.id} />
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
              <InfoPanel info={selectedInfo} language={language} />
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
              <PriceTable comparison={selectedPrices} />
              {/* Phase-1 Feature A: check the paid price vs the DRAP MRP */}
              <MrpChecker medicine={selectedPrices.medicine} language={language} />
              <div className="mt-6">
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
    </div>
  );
}
