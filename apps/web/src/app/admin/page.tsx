"use client";

/**
 * Admin Portal — Registered Users & Community Feedback / Healthcare Needs Survey.
 *
 * Unlisted (no public link in header). Server-side is_admin gate protects all data.
 */

import { useCallback, useEffect, useState } from "react";
import { useUser, useClerk, UserButton, SignInButton } from "@clerk/nextjs";
import { isLoggedIn } from "@/lib/auth";
import {
  fetchAdminUsers,
  fetchAdminFeedbacks,
  deleteAdminFeedback,
  type AdminUser,
  type AdminUsersResponse,
  type AdminFeedbackListResponse,
  type FeedbackResponseItem,
} from "@/lib/api";

type TabType = "users" | "feedback";

export default function AdminPortalPage() {
  const { isSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();
  const [activeTab, setActiveTab] = useState<TabType>("feedback");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Users data
  const [usersData, setUsersData] = useState<AdminUsersResponse | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Feedback data
  const [feedbackData, setFeedbackData] = useState<AdminFeedbackListResponse | null>(null);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [filterNeed, setFilterNeed] = useState<string>("");
  const [filterRating, setFilterRating] = useState<number | undefined>(undefined);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackResponseItem | null>(null);

  // Check auth
  useEffect(() => {
    setLoggedIn(Boolean(isSignedIn || isLoggedIn()));
  }, [isSignedIn]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, fRes] = await Promise.all([
        fetchAdminUsers({ limit: 1000 }),
        fetchAdminFeedbacks({ limit: 1000 }),
      ]);
      setUsersData(uRes);
      setFeedbackData(fRes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch admin data";
      if (msg.includes("Admin access required") || msg.includes("403")) {
        setError("You do not have admin access.");
      } else if (msg.includes("Not authenticated") || msg.includes("401")) {
        setLoggedIn(false);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn || isSignedIn) {
      loadData();
    }
  }, [loggedIn, isSignedIn, loadData]);

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feedback submission?")) return;
    try {
      await deleteAdminFeedback(id);
      if (feedbackData) {
        setFeedbackData({
          ...feedbackData,
          feedbacks: feedbackData.feedbacks.filter((f) => f.id !== id),
          summary: {
            ...feedbackData.summary,
            total_submissions: Math.max(0, feedbackData.summary.total_submissions - 1),
          },
        });
      }
      if (selectedFeedback?.id === id) setSelectedFeedback(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete feedback.");
    }
  };

  // Not logged in: show sign-in card
  if (!loggedIn && !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface rounded-3xl border border-border shadow-2xl p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Admin Sign-in Required</h1>
          <p className="text-xs sm:text-sm text-muted mb-6">
            Sign in with an authorized Afiya AI admin account to view users & community survey responses.
          </p>
          <SignInButton mode="modal">
            <button type="button" className="bg-gradient-to-r from-primary to-accent text-white px-6 py-3 rounded-2xl font-bold hover:opacity-95 transition-all w-full cursor-pointer shadow-lg shadow-primary/20">
              Sign In with Clerk
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  // 403: not an admin
  if (error === "You do not have admin access.") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface rounded-3xl border border-border shadow-2xl p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-xs sm:text-sm text-muted">
            This account does not have admin privileges. If you are an administrator, ensure your email is added to ADMIN_EMAILS.
          </p>
        </div>
      </div>
    );
  }

  function formatDate(dateStr: string | null | undefined): string {
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

  const users = usersData?.users ?? [];
  const filteredUsers = userSearch.trim()
    ? users.filter((u) => {
        const q = userSearch.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : users;

  const feedbacks = feedbackData?.feedbacks ?? [];
  const filteredFeedbacks = feedbacks.filter((f) => {
    if (feedbackSearch.trim()) {
      const q = feedbackSearch.toLowerCase();
      const matchesSearch =
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.city && f.city.toLowerCase().includes(q)) ||
        f.feedback.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (filterNeed && f.primary_need !== filterNeed) return false;
    if (filterRating && f.rating !== filterRating) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Header bar */}
      <header className="bg-surface border-b border-border px-4 sm:px-6 py-4 sticky top-0 z-30 backdrop-blur-md bg-surface/90">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20 shrink-0">
              🛡️
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                Afiya AI Admin Dashboard
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                  Admin Panel
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted font-medium">
                Community Feedback, Healthcare Needs & User Oversight
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
            <UserButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-4 pt-3 border-t border-border/70">
          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "feedback"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <span>💬</span> User Feedback & Needs ({feedbackData?.summary.total_submissions ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <span>👥</span> Registered Users ({usersData?.total ?? 0})
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ==================== TAB 1: FEEDBACK ==================== */}
        {activeTab === "feedback" && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Summary Cards */}
            {feedbackData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-sm">
                  <div className="flex items-center justify-between text-muted text-xs font-bold mb-1">
                    <span>Total Feedback</span>
                    <span>📝</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-foreground">
                    {feedbackData.summary.total_submissions}
                  </div>
                  <div className="text-[11px] text-muted mt-1 font-medium">
                    Submitted by visitors across Pakistan
                  </div>
                </div>

                <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-sm">
                  <div className="flex items-center justify-between text-muted text-xs font-bold mb-1">
                    <span>Average Rating</span>
                    <span>⭐</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-1.5">
                    {feedbackData.summary.average_rating} <span className="text-sm text-muted font-normal">/ 5.0</span>
                  </div>
                  <div className="text-[11px] text-muted mt-1 font-medium">
                    Overall community satisfaction
                  </div>
                </div>

                <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-sm">
                  <div className="flex items-center justify-between text-muted text-xs font-bold mb-1">
                    <span>Recommendation Rate</span>
                    <span>❤️</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {feedbackData.summary.recommend_percentage}%
                  </div>
                  <div className="text-[11px] text-muted mt-1 font-medium">
                    Would recommend Afiya AI
                  </div>
                </div>

                <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-sm">
                  <div className="flex items-center justify-between text-muted text-xs font-bold mb-1">
                    <span>Top Health Need</span>
                    <span>🎯</span>
                  </div>
                  <div className="text-sm font-extrabold text-foreground truncate mt-1">
                    {feedbackData.summary.top_primary_need || "Affordable Alternatives"}
                  </div>
                  <div className="text-[11px] text-muted mt-1 font-medium">
                    Most requested capability
                  </div>
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <input
                type="text"
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
                placeholder="Search by name, email, city, or comments…"
                className="w-full md:max-w-md bg-background border border-border rounded-xl px-4 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterNeed}
                  onChange={(e) => setFilterNeed(e.target.value)}
                  className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">All Primary Needs</option>
                  <option value="Find Affordable Alternative Medicines">💊 Affordable Alternatives</option>
                  <option value="Prescription Scanner (OCR)">📸 Prescription Scanner</option>
                  <option value="Check DRAP MRP & Overcharging">⚖️ DRAP MRP Checker</option>
                  <option value="Medicine Safety, Dosages & Side Effects">🛡️ Safety & Dosage</option>
                  <option value="AI Medicine Chatbot Assistant">🤖 AI Chatbot</option>
                  <option value="Digital Medicine Cabinet & Recall Watchdog">📦 Medicine Cabinet</option>
                </select>

                <select
                  value={filterRating || ""}
                  onChange={(e) => setFilterRating(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">All Ratings</option>
                  <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
                  <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
                  <option value="3">⭐⭐⭐ (3 Stars)</option>
                  <option value="2">⭐⭐ (2 Stars)</option>
                  <option value="1">⭐ (1 Star)</option>
                </select>

                {(feedbackSearch || filterNeed || filterRating) && (
                  <button
                    onClick={() => {
                      setFeedbackSearch("");
                      setFilterNeed("");
                      setFilterRating(undefined);
                    }}
                    className="text-xs font-bold text-muted hover:text-foreground px-2 py-1"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Feedback List Table */}
            <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[750px]">
                  <thead>
                    <tr className="border-b border-border bg-background/50 text-muted uppercase text-[11px] font-bold">
                      <th className="text-left px-4 py-3">User Details</th>
                      <th className="text-left px-4 py-3">Age / City</th>
                      <th className="text-left px-4 py-3">Primary Need</th>
                      <th className="text-left px-4 py-3">Rating</th>
                      <th className="text-left px-4 py-3">Comments & Suggestions</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredFeedbacks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted">
                          {feedbackSearch || filterNeed || filterRating
                            ? "No feedback matches your selected filters."
                            : "No feedback submissions recorded yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredFeedbacks.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-hover/70 transition-colors">
                          {/* User */}
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-bold text-foreground">{item.name}</div>
                            <div className="text-muted text-[11px]">{item.email}</div>
                            {item.would_recommend ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-1 border border-emerald-500/20">
                                ❤️ Recommends
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted bg-surface-hover px-2 py-0.5 rounded-full mt-1">
                                ⚠️ Needs Work
                              </span>
                            )}
                          </td>

                          {/* Age & City */}
                          <td className="px-4 py-3.5 align-top text-foreground/90">
                            <div>{item.age ? `${item.age} yrs` : "—"}</div>
                            <div className="text-muted text-[11px]">{item.city || "—"}</div>
                          </td>

                          {/* Primary Need */}
                          <td className="px-4 py-3.5 align-top">
                            <span className="inline-block bg-primary/10 text-primary font-bold text-[11px] px-2.5 py-1 rounded-xl border border-primary/20 max-w-[180px] truncate">
                              {item.primary_need}
                            </span>
                            {item.frequency_of_medicine_purchase && (
                              <div className="text-[10px] text-muted mt-1 truncate max-w-[180px]">
                                🔄 {item.frequency_of_medicine_purchase}
                              </div>
                            )}
                          </td>

                          {/* Rating */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <div className="font-black text-amber-500 text-sm">
                              {"⭐".repeat(item.rating)}
                            </div>
                            {item.ease_of_use && (
                              <div className="text-[10px] text-muted font-medium mt-0.5">
                                {item.ease_of_use}
                              </div>
                            )}
                          </td>

                          {/* Feedback Text */}
                          <td className="px-4 py-3.5 align-top max-w-xs">
                            <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">
                              {item.feedback}
                            </p>
                            <button
                              onClick={() => setSelectedFeedback(item)}
                              className="text-[11px] font-bold text-primary hover:underline mt-1 cursor-pointer block"
                            >
                              Read full comments ➔
                            </button>
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3.5 align-top text-muted text-xs whitespace-nowrap">
                            {formatDate(item.created_at)}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 align-top text-right">
                            <button
                              onClick={() => handleDeleteFeedback(item.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer text-xs"
                              title="Delete submission"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: REGISTERED USERS ==================== */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-fade-in">
            {/* Search box */}
            <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex items-center justify-between gap-3">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search registered users by name or email…"
                className="w-full max-w-md bg-background border border-border rounded-xl px-4 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="text-xs font-bold text-muted">
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>

            {/* Users Table */}
            <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border bg-background/50 text-muted uppercase text-[11px] font-bold">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Joined Date</th>
                      <th className="text-left px-4 py-3">Last Active</th>
                      <th className="text-left px-4 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted">
                          {userSearch.trim() ? "No users match your search." : "No registered users found."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u, idx) => (
                        <tr key={u.id} className="hover:bg-surface-hover/70 transition-colors">
                          <td className="px-4 py-3 text-muted font-bold">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{u.name}</td>
                          <td className="px-4 py-3 text-foreground/80">{u.email}</td>
                          <td className="px-4 py-3 text-muted">{formatDate(u.created_at)}</td>
                          <td className="px-4 py-3 text-muted">{formatDate(u.last_login_at)}</td>
                          <td className="px-4 py-3">
                            {u.is_admin ? (
                              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold border border-primary/20">
                                🛡️ Admin
                              </span>
                            ) : (
                              <span className="text-muted text-xs">User</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal to Inspect Full User Feedback */}
        {selectedFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 relative">
              <button
                onClick={() => setSelectedFeedback(null)}
                className="absolute top-4 right-4 text-muted hover:text-foreground w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-xl font-bold">
                  💬
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">{selectedFeedback.name}</h3>
                  <p className="text-xs text-muted">{selectedFeedback.email} • {selectedFeedback.city || "Pakistan"} ({selectedFeedback.age ? `${selectedFeedback.age} yrs` : "—"})</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-background p-3.5 rounded-2xl border border-border">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Primary Health Need</span>
                  <span className="font-bold text-primary mt-0.5 block">{selectedFeedback.primary_need}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Purchase Frequency</span>
                  <span className="font-semibold text-foreground mt-0.5 block">{selectedFeedback.frequency_of_medicine_purchase || "—"}</span>
                </div>
                <div className="mt-2">
                  <span className="text-muted block text-[10px] uppercase font-bold">Rating & Experience</span>
                  <span className="font-bold text-amber-500 mt-0.5 block">{"⭐".repeat(selectedFeedback.rating)} ({selectedFeedback.rating}/5)</span>
                </div>
                <div className="mt-2">
                  <span className="text-muted block text-[10px] uppercase font-bold">Would Recommend?</span>
                  <span className="font-bold text-emerald-500 mt-0.5 block">{selectedFeedback.would_recommend ? "❤️ Yes, definitely" : "⚠️ Needs work"}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-muted mb-1.5">Full Comments & Feature Suggestions</label>
                <div className="bg-background p-4 rounded-2xl border border-border text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedFeedback.feedback}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border">
                <span>Submitted on {formatDate(selectedFeedback.created_at)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
