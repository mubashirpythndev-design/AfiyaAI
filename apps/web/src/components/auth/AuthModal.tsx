"use client";

// Sign-in / sign-up modal (email + password only). Guests who click a gated
// action (View info / Compare prices) land here; on success the pending
// action is replayed by page.tsx. Field errors come verbatim from the API
// (duplicate email 409, wrong credentials 401, validation 422).

import { useState } from "react";
import type { Language, AuthUser } from "@/lib/types";
import { loginUser, registerUser } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

type Tab = "signin" | "signup";

interface AuthModalProps {
  language: Language;
  onClose: () => void;
  onSuccess: (user: AuthUser, isNewSignup?: boolean) => void;
}

export default function AuthModal({ language, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const isSignup = tab === "signup";
      const session =
        !isSignup
          ? await loginUser({ email, password })
          : await registerUser({ name, email, password });
      setSession(session.access_token, session.user);
      onSuccess(session.user, isSignup);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : t(language, "auth.errorGeneric")
      );
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const inputClass =
    "w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md p-5 sm:p-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-xl font-bold text-foreground">{t(language, "auth.title")}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-foreground transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-muted mb-6">{t(language, "auth.subtitle")}</p>

        {/* Tabs */}
        <div className="flex bg-background/50 rounded-xl border border-border p-1 gap-1 mb-6">
          {(["signin", "signup"] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => switchTab(tb)}
              className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === tb
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t(language, tb === "signin" ? "auth.signInTab" : "auth.signUpTab")}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                {t(language, "auth.nameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(language, "auth.namePlaceholder")}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              {t(language, "auth.emailLabel")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(language, "auth.emailPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              {t(language, "auth.passwordLabel")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
              placeholder={t(language, "auth.passwordHint")}
              className={inputClass}
            />
            {tab === "signup" && (
              <p className="text-xs text-muted mt-1">{t(language, "auth.passwordHint")}</p>
            )}
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password || (tab === "signup" && !name)}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
          >
            {loading
              ? t(language, tab === "signin" ? "auth.signingIn" : "auth.creating")
              : t(language, tab === "signin" ? "auth.signInBtn" : "auth.signUpBtn")}
          </button>

          <button
            onClick={() => switchTab(tab === "signin" ? "signup" : "signin")}
            className="w-full text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            {t(language, tab === "signin" ? "auth.switchToSignUp" : "auth.switchToSignIn")}
          </button>
        </div>
      </div>
    </div>
  );
}
