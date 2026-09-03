// Client-side auth state — the SINGLE centralized module for
// "is the user logged in?". Token lives in localStorage; logout is simply
// clearing it (stateless JWT). A future whole-app login gate can reuse
// isLoggedIn() from one place instead of per-feature checks.

import type { AuthUser } from "./types";

const TOKEN_KEY = "afiya_auth_token";
const USER_KEY = "afiya_auth_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(TOKEN_KEY);
  if (stored) {
    if (stored.startsWith("clerk_") || stored.startsWith("user_")) {
      window.localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return stored;
  }
  return null;
}

export async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // 1. If Clerk session is active on window, get the real fresh RS256 JWT
  try {
    const clerk = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } })?.Clerk;
    if (clerk?.session) {
      const freshToken = await clerk.session.getToken();
      if (freshToken) {
        window.localStorage.setItem(TOKEN_KEY, freshToken);
        return freshToken;
      }
    }
  } catch {}

  // 2. Fall back to valid stored token
  return getToken();
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(TOKEN_KEY) !== null) return true;
  try {
    return Boolean((window as unknown as { Clerk?: { user?: unknown } })?.Clerk?.user);
  } catch {
    return false;
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {}
  }
  try {
    const clerkUser = (window as unknown as {
      Clerk?: {
        user?: {
          id: string;
          fullName?: string;
          firstName?: string;
          primaryEmailAddress?: { emailAddress: string };
          publicMetadata?: { role?: string };
        };
      };
    })?.Clerk?.user;
    if (clerkUser?.id) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      return {
        id: clerkUser.id,
        name: clerkUser.fullName || clerkUser.firstName || email.split("@")[0] || "User",
        email: email,
        is_admin: clerkUser.publicMetadata?.role === "admin" || false,
      };
    }
  } catch {}
  return null;
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
