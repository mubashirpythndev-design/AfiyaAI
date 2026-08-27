"use client";

import { useEffect, useState } from "react";
import { fetchCabinet, removeFromCabinet } from "@/lib/api";
import type { CabinetResponse, Language } from "@/lib/types";

interface CabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export default function CabinetModal({
  isOpen,
  onClose,
}: CabinetModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CabinetResponse | null>(null);

  const loadCabinetData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCabinet();
      setData(res);
    } catch (e: any) {
      setError(e.message || "Failed to load medicine cabinet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCabinetData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = async (medicineId: string) => {
    try {
      await removeFromCabinet(medicineId);
      await loadCabinetData();
    } catch (e: any) {
      setError(e.message || "Failed to remove item.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface-hover flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-xl">⭐</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                My Digital Medicine Cabinet
                {data && data.recalled_items_count > 0 && (
                  <span className="bg-danger text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">
                    {data.recalled_items_count} Recall Alert
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted">
                {data ? `${data.total_items} saved medications · DRAP Automated Recall Watchdog` : "Loading your saved cabinet..."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-background border border-border hover:bg-surface flex items-center justify-center text-muted hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 text-xs text-danger font-medium">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="py-12 flex items-center justify-center gap-3 text-muted text-sm">
              <svg className="w-5 h-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Checking DRAP recall database for your cabinet...
            </div>
          )}

          {data && data.recalled_items_count > 0 && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="text-xs font-bold text-danger uppercase tracking-wider">
                  Automated Watchdog Safety Warning
                </h4>
                <p className="text-xs text-foreground/90 mt-1 leading-relaxed">
                  DRAP has issued active recall alerts for <strong>{data.recalled_items_count}</strong> medication(s) in your cabinet. Please inspect the flagged item(s) below.
                </p>
              </div>
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="py-12 text-center text-muted space-y-3">
              <span className="text-4xl block">🗄️</span>
              <p className="text-sm font-medium text-foreground">Your cabinet is empty</p>
              <p className="text-xs max-w-xs mx-auto text-muted">
                Search for any medicine and click <strong>"⭐ Save to Cabinet"</strong> to track price caps and automated safety recalls.
              </p>
            </div>
          )}

          {data && data.items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border ${
                item.has_recall_alert ? "border-danger bg-danger/5" : "border-border bg-background/50"
              } p-4 space-y-3 transition-all`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    {item.medicine.brand_name} {item.medicine.strength}
                    <span className="text-xs font-normal text-muted bg-surface px-2 py-0.5 rounded-md border border-border">
                      {item.medicine.dosage_form}
                    </span>
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {item.medicine.generic_name} · {item.medicine.category}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(item.medicine_id)}
                  className="text-xs font-medium text-muted hover:text-danger border border-border hover:border-danger/30 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Remove
                </button>
              </div>

              {/* Price Tag */}
              {item.notified_mrp && (
                <div className="inline-block text-xs font-semibold bg-surface border border-border px-3 py-1 rounded-lg text-foreground">
                  Official DRAP MRP: PKR {item.notified_mrp}
                </div>
              )}

              {/* Recall Alert Details */}
              {item.has_recall_alert && item.active_alerts.map((alert, idx) => (
                <div key={idx} className="bg-danger/10 border border-danger/20 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase bg-danger text-white px-2 py-0.5 rounded-full">
                      DRAP RECALL: {alert.alert_type}
                    </span>
                    {alert.issued_at && (
                      <span className="text-[11px] text-muted font-medium">Date: {alert.issued_at}</span>
                    )}
                  </div>
                  <p className="text-xs text-danger font-semibold">{alert.description}</p>
                  {alert.batch_no && (
                    <p className="text-[11px] text-foreground/80 font-mono">Affected Batch: {alert.batch_no}</p>
                  )}
                  <p className="text-[10px] text-muted border-t border-danger/20 pt-1">
                    Do not consume recalled batches. Consult your doctor or pharmacist immediately.
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-hover flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-primary text-white text-xs font-semibold px-5 py-2 rounded-xl hover:bg-primary-dark transition-colors"
          >
            Close Cabinet
          </button>
        </div>
      </div>
    </div>
  );
}
