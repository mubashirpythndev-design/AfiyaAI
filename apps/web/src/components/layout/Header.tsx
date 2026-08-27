"use client";

import { useState } from "react";
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
}

export default function Header({ language, onLanguageChange, user, onSignIn, onSignOut, onOpenCabinet }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L12 22M2 12L22 12M7 7L17 17M17 7L7 17" opacity="0.3" />
                <path d="M12 2v20M2 12h20" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Afiya <span className="text-primary">AI</span>
              </h1>
              <p className="text-[10px] text-muted -mt-1 font-medium tracking-wider uppercase">
                Medicine Assistant
              </p>
            </div>
          </div>

          {/* Nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <a href="#features" className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all">
              {t(language, "nav.features")}
            </a>
            <a href="#how-it-works" className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all">
              {t(language, "nav.howItWorks")}
            </a>
          </nav>

          {/* Auth + Language Selector + Theme Toggle + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Auth: sign-in button when logged out; cabinet + name + sign-out menu when logged in */}
            {user ? (
              <div className="flex items-center gap-2">
                {onOpenCabinet && (
                  <button
                    onClick={onOpenCabinet}
                    className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                  >
                    <span>⭐</span>
                    <span className="hidden sm:inline">My Cabinet</span>
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 bg-surface rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:border-primary/30 transition-all"
                  >
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl border border-border shadow-xl p-2 animate-fade-in z-50">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setUserMenuOpen(false); onSignOut(); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-danger hover:bg-surface-hover rounded-lg transition-all"
                    >
                      {t(language, "nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <button
                onClick={onSignIn}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
              >
                {t(language, "nav.signIn")}
              </button>
            )}

            {/* Theme toggle */}
            <ThemeToggle />

            <div className="flex items-center bg-surface rounded-xl border border-border p-1 gap-0.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => onLanguageChange(lang.code)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    language === lang.code
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {lang.flag}
                </button>
              ))}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-surface-hover transition-colors"
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
          <div className="md:hidden pb-4 animate-fade-in">
            <nav className="flex flex-col gap-1">
              <a href="#features" className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all">
                {t(language, "nav.features")}
              </a>
              <a href="#how-it-works" className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-all">
                {t(language, "nav.howItWorks")}
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
