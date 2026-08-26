"use client";

/**
 * Admin — Registered Users view.
 *
 * Unlisted (no link in the header/main UI). The real protection is the
 * server-side is_admin gate (HTTP 403 for non-admins). English-only UI;
 * this is an internal admin tool so i18n is skipped intentionally.
 */

import { useCallback, useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth";
import {
  fetchAdminUsers,
  type AdminUser,
  type AdminUsersResponse,
} from "@/lib/api";

// Lazy-import AuthModal only when needed (keeps the initial bundle small).
import AuthModal from "@/components/auth/AuthModal";

export default function AdminUsersPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [search, setSearch] = useState("");

  // Check auth on mount (client-only).
  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers({ limit: 1000 });
      setData(res);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to fetch users";
      if (msg.includes("Admin access required") || msg.includes("403")) {
        setError("You do not have admin access.");
      } else if (msg.includes("Not authenticated") || msg.includes("401")) {
        // Token expired/cleared — show sign-in prompt again
        setLoggedIn(false);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on login state change
  useEffect(() => {
    if (loggedIn) {
      loadUsers();
    }
  }, [loggedIn, loadUsers]);

  // ── Not logged in: show sign-in card ──
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Admin sign-in required
          </h1>
          <p className="text-sm text-muted mb-6">
            Sign in with an admin account to view registered users.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition-colors w-full"
          >
            Sign in
          </button>
        </div>

        {showAuthModal && (
          <AuthModal
            language="en"
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              setLoggedIn(true);
            }}
          />
        )}
      </div>
    );
  }

  // ── 403: not an admin ──
  if (error === "You do not have admin access.") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-14 h-14 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-danger"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Access denied
          </h1>
          <p className="text-sm text-muted">
            You do not have admin access.
          </p>
        </div>
      </div>
    );
  }

  // ── Generic error ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 max-w-md w-full text-center animate-fade-in">
          <p className="text-danger font-medium mb-4">{error}</p>
          <button
            onClick={loadUsers}
            className="bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading users…
        </div>
      </div>
    );
  }

  // ── Admin table ──
  const users = data?.users ?? [];
  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
    : users;

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <header className="bg-surface border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Registered Users
              </h1>
              <p className="text-xs text-muted">
                {data ? `${data.total} total` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Search box */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full max-w-md bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {search.trim() && (
            <p className="text-xs text-muted mt-1">
              Showing {filtered.length} of {users.length} users
            </p>
          )}
        </div>

        {/* Table */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">
                    Last login
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">
                    Admin
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-muted"
                    >
                      {search.trim()
                        ? "No users match your search."
                        : "No users registered yet."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((user, idx) => (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 hover:bg-surface-hover transition-colors"
                    >
                      <td className="px-4 py-3 text-muted">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(user.last_login_at)}
                      </td>
                      <td className="px-4 py-3">
                        {user.is_admin ? (
                          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Yes
                          </span>
                        ) : (
                          <span className="text-muted text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
