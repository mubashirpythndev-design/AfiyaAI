"use client";

import { useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import type { Language, AuthUser } from "@/lib/types";
import { LANGUAGES } from "@/lib/constants";
import { t } from "@/lib/i18n";
import ThemeToggle from "@/components/shared/ThemeToggle";

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  user: AuthUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenCabinet?: () => void;
  onOpenGuide?: () => void;
  onOpenFeedback?: () => void;
  onNavigateHome?: () => void;
}

export default function Header({
  language,
  onLanguageChange,
  user,
  onSignIn,
  onSignOut,
  onOpenCabinet,
  onOpenGuide,
  onOpenFeedback,
  onNavigateHome,
}: HeaderProps) {
  const { isSignedIn, user: clerkUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = "/";
    }
  };

  const isUserAuthenticated = !!isSignedIn || !!user;

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Clickable Logo */}
          <button
            onClick={handleLogoClick}
            type="button"
            className="flex items-center gap-2.5 shrink-0 text-left cursor-pointer group transition-transform duration-200 hover:scale-[1.02] focus:outline-none"
            aria-label="Afiya AI Home"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 group-hover:shadow-primary/30 transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
                <path d="M12 2L12 22M2 12L22 12M7 7L17 17M17 7L7 17" opacity="0.3" />
                <path d="M12 2v20M2 12h20" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors">
                Afiya <span className="text-primary">AI</span>
              </h1>
              <p className="hidden xs:block text-[9px] sm:text-[10px] text-muted -mt-0.5 font-medium tracking-wider uppercase">
                Medicine Assistant
              </p>
            </div>
          </button>

          {/* Nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <a href="#features" className="px-3 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all">
              {t(language, "nav.features")}
            </a>
            {onOpenGuide ? (
              <button
                type="button"
                onClick={onOpenGuide}
                className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span>💡</span>
                <span>How to Compare</span>
              </button>
            ) : (
              <a href="#how-it-works" className="px-3 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all">
                {t(language, "nav.howItWorks")}
              </a>
            )}
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="px-3 py-1.5 text-xs font-bold text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span>💬</span>
                <span>Feedback</span>
              </button>
            )}
          </nav>

          {/* Auth + Language Selector + Theme Toggle + Mobile Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auth: Clerk UserButton / SignInButton */}
            {isUserAuthenticated ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {onOpenCabinet && (
                  <button
                    onClick={onOpenCabinet}
                    aria-label="Open My Cabinet"
                    className="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer"
                  >
                    <span>⭐</span>
                    <span className="hidden md:inline">My Cabinet</span>
                  </button>
                )}
                {isSignedIn ? (
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8 rounded-xl border border-border shadow-sm",
                      },
                    }}
                  />
                ) : (
                  <button
                    onClick={onSignOut}
                    className="bg-surface hover:bg-surface-hover text-foreground border border-border px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  >
                    {t(language, "nav.signOut")}
                  </button>
                )}
              </div>
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="bg-primary hover:bg-primary-dark text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 shrink-0 cursor-pointer"
                >
                  {t(language, "nav.signIn")}
                </button>
              </SignInButton>
            )}

            {/* Desktop Theme toggle & Language selector */}
            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />

              <div className="flex items-center bg-surface rounded-xl border border-border p-1 gap-0.5 shrink-0">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => onLanguageChange(lang.code)}
                    aria-label={lang.label}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      language === lang.code
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {lang.flag}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors shrink-0 text-foreground"
              aria-label="Toggle Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 animate-fade-in border-t border-border/50 pt-3 mt-1 space-y-3">
            <nav className="flex flex-col gap-1">
              <a
                href="#features"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all"
              >
                {t(language, "nav.features")}
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all"
              >
                {t(language, "nav.howItWorks")}
              </a>
              {onOpenGuide && (
                <button
                  onClick={() => { setMenuOpen(false); onOpenGuide(); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-all text-left"
                >
                  <span>💡</span> How to Compare & Check MRP
                </button>
              )}
              {onOpenFeedback && (
                <button
                  onClick={() => { setMenuOpen(false); onOpenFeedback(); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 rounded-lg transition-all text-left"
                >
                  <span>💬</span> Share Feedback & Comments
                </button>
              )}
              {user && onOpenCabinet && (
                <button
                  onClick={() => { setMenuOpen(false); onOpenCabinet(); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-all text-left"
                >
                  <span>⭐</span> My Cabinet
                </button>
              )}
            </nav>

            {/* Mobile-only Language & Theme Selector */}
            <div className="pt-3 border-t border-border space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-muted px-3 mb-2 uppercase tracking-wider">
                  Language / زبان
                </p>
                <div className="grid grid-cols-3 gap-1.5 px-3">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => onLanguageChange(lang.code)}
                      className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all text-center flex flex-col items-center gap-0.5 ${
                        language === lang.code
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-surface border-border text-muted hover:text-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="text-xs font-bold">{lang.flag}</span>
                      <span className="text-[10px]">{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between px-3 pt-1">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Appearance / تھیم
                </span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
