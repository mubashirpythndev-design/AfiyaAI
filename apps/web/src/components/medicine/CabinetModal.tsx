"use client";

import useModalFocus from "@/components/shared/useModalFocus";
import AppIcon from "@/components/shared/AppIcon";
import { useEffect, useRef, useState } from "react";
import { fetchCabinet, removeFromCabinet, updateCabinetReminder } from "@/lib/api";
import type { CabinetResponse, CabinetItem, Language } from "@/lib/types";
import { previewCabinetBudget } from "@/lib/cabinetPrices";
import CabinetQuantity from "./CabinetQuantity";
import { localizeDirections } from "@/lib/i18n";

interface CabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

const REMINDER_OPTIONS = [
  { id: "morning", labelEn: "Morning (8 AM)", labelUr: "صبح (8 بجے)", labelRoman: "Subah (8 AM)", icon: "🌅" },
  { id: "afternoon", labelEn: "Afternoon (2 PM)", labelUr: "دوپہر (2 بجے)", labelRoman: "Dopehar (2 PM)", icon: "☀️" },
  { id: "night", labelEn: "Night (8 PM)", labelUr: "رات (8 بجے)", labelRoman: "Raat (8 PM)", icon: "🌙" },
];

export default function CabinetModal({
  isOpen,
  onClose,
  language = "en",
}: CabinetModalProps) {
  const modalRef = useModalFocus(isOpen, onClose);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CabinetResponse | null>(null);
  const [editingDosageId, setEditingDosageId] = useState<string | null>(null);
  const [dosageDraft, setDosageDraft] = useState("");
  const pendingReminder = useRef(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  const loadCabinetData = async (throwOnError = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCabinet();
      setData(res);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load medicine cabinet.");
      if (throwOnError) throw e;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQuantityDrafts({});
      loadCabinetData();
      if (typeof window !== "undefined" && "Notification" in window) {
        setNotifPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = async (medicineId: string) => {
    try {
      await removeFromCabinet(medicineId);
      await loadCabinetData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove item.");
    }
  };

  const handleToggleReminderTime = async (item: CabinetItem, timeId: string) => {
    if (pendingReminder.current || loading || updatingId) return;
    pendingReminder.current = true;
    setUpdatingId(item.medicine_id);
    setError(null);
    const currentTimes = item.reminder_times || [];
    const newTimes = currentTimes.includes(timeId)
      ? currentTimes.filter((t) => t !== timeId)
      : [...currentTimes, timeId];

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.medicine_id === item.medicine_id ? { ...i, reminder_times: newTimes } : i
        ),
      };
    });

    try {
      await updateCabinetReminder(item.medicine_id, {
        reminder_times: newTimes,
      });
    } catch (err) {
      await loadCabinetData();
      setError(err instanceof Error ? err.message : "Could not save reminder");
    } finally {
      pendingReminder.current = false;
      setUpdatingId(null);
    }
  };

  const handleSaveDosage = async (item: CabinetItem) => {
    if (pendingReminder.current || updatingId) return;
    setUpdatingId(item.medicine_id);
    try {
      await updateCabinetReminder(item.medicine_id, {
        dosage_instruction: dosageDraft,
      });
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.medicine_id === item.medicine_id ? { ...i, dosage_instruction: dosageDraft } : i
          ),
        };
      });
      setEditingDosageId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save directions");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestNotification = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifMessage("Browser notifications are not supported on this device.");
      return;
    }
    const permission = await Notification.requestPermission();
    localStorage.setItem("afiya_reminders_enabled", permission === "granted" ? "true" : "false");
    setNotifPermission(permission);
    if (permission === "granted") {
      new Notification("Afiya AI - Medicine Reminders Enabled", {
        body: "Notifications are allowed. Keep Afiya AI open for scheduled reminders.",
        icon: "/favicon.ico",
      });
      setNotifMessage(
        language === "ur"
          ? "اطلاعات کی اجازت مل گئی۔ یاد دہانی کے لیے عافیہ ایپ کھلی رکھیں۔"
          : language === "roman_ur"
          ? "Ijazat mil gayi. Reminders ke liye Afiya AI khula rakhein."
          : "Notifications allowed. Reminders run while Afiya AI is open."
      );
      setTimeout(() => setNotifMessage(null), 4000);
    }
  };

  // Safe numeric price parser to prevent string concatenation or NaN
  const getPriceNum = (val: unknown): number => {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const items = data?.items || [];
  const hasQuantityDrafts = Object.keys(quantityDrafts).some(id => items.some(item => item.medicine_id === id));
  const liveBudget = hasQuantityDrafts ? previewCabinetBudget(items, quantityDrafts) : data?.budget;
  const totalMonthlyMrp = liveBudget?.monthly_cost ?? null;
  const estimatedGenericSavings = liveBudget?.monthly_savings ?? null;
  const annualSavings = liveBudget?.annual_savings ?? null;
  // WhatsApp Share Text Generator
  const generateWhatsAppShare = () => {
    if (items.length === 0 || hasQuantityDrafts) return;

    let text = `💊 *Afiya AI - My Personal Medicine Schedule & Cabinet*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    items.forEach((item, index) => {
      text += `\n${index + 1}. *${item.medicine.brand_name} ${item.medicine.strength}* (${item.medicine.dosage_form})\n`;
      text += `   • Salt: ${item.medicine.generic_name}\n`;
      if (item.dosage_instruction) {
        text += `   • Dose: ${item.dosage_instruction}\n`;
      }
      if (item.reminder_times && item.reminder_times.length > 0) {
        const timings = item.reminder_times
          .map((t) => (t === "morning" ? "Morning" : t === "afternoon" ? "Afternoon" : "Night"))
          .join(", ");
        text += `   • Timing: ${timings}\n`;
      }
      const priceNum = getPriceNum(item.notified_mrp);
      if (priceNum > 0) {
        text += `   • Reference pack price: PKR ${priceNum.toFixed(2)}\n`;
      }
    });

    if (totalMonthlyMrp !== null && totalMonthlyMrp > 0) {
      text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📊 *Est. Monthly Prescription Cost:* PKR ${totalMonthlyMrp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
      if (estimatedGenericSavings !== null && estimatedGenericSavings > 0) {
        text += `💡 *Est. Monthly Generic Bachat:* PKR ${estimatedGenericSavings.toLocaleString()}\n`;
      }
    }
    text += `\n🔗 *Tracked with Afiya AI* - DRAP Price Benchmark & Medicine Assistant`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="cabinet-title" tabIndex={-1}
        className="bg-surface rounded-2xl border border-border shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-surface-hover flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              <span className="text-xl"><AppIcon symbol="🗄️" /></span>
            </div>
            <div className="min-w-0">
              <h2 id="cabinet-title" className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
                <span>
                  {language === "ur"
                    ? "میرا ذاتی میڈیسن کیبنٹ اور شیڈول"
                    : language === "roman_ur"
                    ? "Mera My medicine cabinet"
                    : "My medicine cabinet"}
                </span>

              </h2>
              <p className="text-xs text-muted truncate">
                {data
                  ? `${data.total_items} ${
                      language === "ur" ? "محفوظ ادویات" : language === "roman_ur" ? "saved dawaiyan" : "medications saved"
                    }`
                  : loading ? "Loading your saved cabinet..." : "Your saved medicines"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-background border border-border hover:bg-surface flex items-center justify-center text-muted hover:text-foreground transition-colors shrink-0 cursor-pointer"
            aria-label="Close Cabinet"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 text-xs text-danger font-medium">
              {error}
            </div>
          )}

          {notifMessage && (
            <div className="bg-success/15 border border-success/30 rounded-xl p-3 text-xs text-success font-medium flex items-center gap-2">
              <span><AppIcon symbol="🔔" /></span>
              <span>{notifMessage}</span>
            </div>
          )}

          {/* Afiya Monthly Budget Estimator / Bachat Calculator Banner */}
          {items.length > 0 && (
            <div className="rounded-2xl border border-primary/25 bg-surface p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl"><AppIcon symbol="💰" /></span>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      {language === "ur"
                        ? "عافیہ ماہانہ بجٹ اور بچت کا تخمینہ (Bachat Calculator)"
                        : language === "roman_ur"
                        ? "Mahana budget aur bachat"
                        : "Monthly budget & savings"}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-muted">
                      {language === "ur"
                        ? "سرکاری ڈریپ ایم آر پی کی بنیاد پر ادویات کا تخمینہ اور متبادل بچت"
                        : "Benchmark based on Stored reference prices and confirmed monthly units"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={generateWhatsAppShare}
                    disabled={hasQuantityDrafts}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all  cursor-pointer disabled:opacity-50"
                  >
                    <span><AppIcon symbol="📲" /></span>
                    <span>
                      {language === "ur"
                        ? "شیڈول واٹس ایپ کریں"
                        : language === "roman_ur"
                        ? "WhatsApp Par Share Karein"
                        : "Share on WhatsApp"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestNotification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/30 text-xs font-semibold text-foreground shadow-sm transition-all  cursor-pointer"
                  >
                    <span><AppIcon symbol="🔔" /></span>
                    <span>
                      {notifPermission === "granted"
                        ? language === "ur"
                          ? "الرٹس فعال ہیں"
                          : "Permission Granted"
                        : language === "ur"
                        ? "ریما ئنڈر آن کریں"
                        : "Enable Reminders"}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-surface/90 border border-border rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-muted block">
                    {language === "ur"
                      ? "مکمل پیک کا ماہانہ بجٹ"
                      : language === "roman_ur"
                      ? "Mahana Poore Packs ka Budget"
                      : "Monthly Whole-Pack Budget"}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5">
                    PKR {totalMonthlyMrp !== null ? totalMonthlyMrp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                  </span>
                </div>

                <div className="bg-surface border border-border rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 block">
                    {language === "ur"
                      ? "متوقع ماہانہ بچت (Generic Bachat)"
                      : language === "roman_ur"
                      ? "Generic Bachat (Mahana)"
                      : "Generic Bachat Potential"}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    PKR {estimatedGenericSavings !== null ? `~${estimatedGenericSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo` : "—"}
                  </span>
                </div>

                <div className="bg-surface border border-border rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-primary block">
                    {language === "ur"
                      ? "سالانہ متوقع بچت"
                      : language === "roman_ur"
                      ? "Salana Bachat (12 Months)"
                      : "Annual Projected Savings"}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-primary block mt-0.5">
                    PKR {annualSavings !== null ? `~${annualSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr` : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {loading && !data && (
            <div className="py-12 flex items-center justify-center gap-3 text-muted text-sm">
              <svg className="w-5 h-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading your cabinet...
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="py-12 text-center text-muted space-y-3">
              <span className="text-4xl block"><AppIcon symbol="🗄️" /></span>
              <p className="text-sm font-medium text-foreground">
                {language === "ur" ? "آپ کا کیبنٹ خالی ہے" : "Your cabinet is empty"}
              </p>
              <p className="text-xs max-w-xs mx-auto text-muted">
                {language === "ur"
                  ? "کسی بھی دوا کو تلاش کریں یا نسخہ اسکین کر کے 'کیبنٹ میں محفوظ کریں' پر کلک کریں۔"
                  : "Search for any medicine or scan a prescription, then click ' Save to Cabinet' to track your regular medicines & daily dosage schedules."}
              </p>
            </div>
          )}

          {liveBudget?.monthly_cost == null && items.length > 0 && (
            <p className="text-xs text-warning">Budget unavailable: enter the prescribed monthly units for every medicine. Unknown pack sizes or missing prices also prevent calculation. Annual savings assume the same confirmed quantity for 12 months.</p>
          )}
          {hasQuantityDrafts && <p className="text-xs text-primary" role="status">{language === "ur" ? "قیمتیں منتخب مقدار کے مطابق دکھائی جا رہی ہیں۔ تبدیلیاں محفوظ کرنے اور شیئر کرنے کے لیے مقدار محفوظ کریں۔" : language === "roman_ur" ? "Qeematein selected miqdaar ke mutabiq preview hain. Changes aur sharing ke liye miqdaar save karein." : "Prices and budget preview your selected quantities. Save quantity changes to keep them and share your cabinet."}</p>}
          {/* Medicines List */}
          {items.map((item) => {
            const isEditingDosage = editingDosageId === item.medicine_id;
            const currentReminderTimes = item.reminder_times || [];

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-background/50 hover:bg-surface/50 p-4 sm:p-5 space-y-3.5 transition-all shadow-sm"
              >
                {/* Header Row: Title & Remove */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base sm:text-lg font-bold text-foreground">
                        {item.medicine.brand_name} {item.medicine.strength}
                      </h4>
                      <span className="text-xs font-semibold text-muted bg-surface px-2 py-0.5 rounded-md border border-border">
                        {item.medicine.dosage_form}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {item.medicine.generic_name} &bull; {item.medicine.category} &bull; {item.medicine.manufacturer}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemove(item.medicine_id)}
                    className="text-xs font-semibold text-muted hover:text-danger border border-border hover:border-danger/30 rounded-xl px-3 py-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {language === "ur" ? "حذف کریں" : "Remove"}
                  </button>
                </div>

                {/* Dosage Directions */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                      <span><AppIcon symbol="🕒" /></span>
                      <span>
                        {language === "ur"
                          ? "خوراک / ہدایات (Dosage Directions):"
                          : language === "roman_ur"
                          ? "Khurak ki hidayat (Dosage):"
                          : "Dosage Instructions:"}
                      </span>
                    </span>
                    {!isEditingDosage && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDosageId(item.medicine_id);
                          setDosageDraft(item.dosage_instruction || "");
                        }}
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {item.dosage_instruction ? "Edit" : "+ Add Instructions"}
                      </button>
                    )}
                  </div>

                  {isEditingDosage ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={dosageDraft}
                        onChange={(e) => setDosageDraft(e.target.value)}
                        placeholder="e.g. 1 tablet twice daily after meals"
                        className="flex-1 text-xs bg-surface border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveDosage(item)}
                        disabled={updatingId === item.medicine_id}
                        className="text-xs font-semibold bg-primary text-white px-3 py-2 rounded-xl hover:bg-primary-dark cursor-pointer disabled:opacity-50"
                      >
                        {updatingId === item.medicine_id ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDosageId(null)}
                        className="text-xs text-muted hover:text-foreground px-2 py-2 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : item.dosage_instruction ? (
                    <p className="text-xs font-medium text-foreground/90 bg-surface/70 border border-border/80 rounded-xl px-3 py-2">
                      {localizeDirections(item.dosage_instruction, language, item.medicine.dosage_form)}
                    </p>
                  ) : (
                    <p className="text-xs italic text-muted">
                      {language === "ur" ? "کوئی خوراک مقرر نہیں کی گئی" : "No dosage directions set yet."}
                    </p>
                  )}
                </div>

                <CabinetQuantity item={item} language={language} onPreview={(units) => setQuantityDrafts(prev => {
                    const next = { ...prev };
                    if (units === undefined) delete next[item.medicine_id]; else next[item.medicine_id] = units;
                    return next;
                  })}
                  onSaved={async () => {
                    await loadCabinetData(true);
                    setQuantityDrafts(prev => { const next = { ...prev }; delete next[item.medicine_id]; return next; });
                  }} />
                <p className="text-xs text-muted">Local notifications use this device’s time and run while Afiya AI is open. Closed browsers and sleeping devices cannot deliver these reminders.</p>
                {/* Daily Schedule Reminder Toggles */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                      <span><AppIcon symbol="⏰" /></span>
                      <span>
                        {language === "ur"
                          ? "روزانہ ریما ئنڈر شیڈول:"
                          : language === "roman_ur"
                          ? "Rozana Reminder Schedule:"
                          : "Daily Reminder Routine:"}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {REMINDER_OPTIONS.map((opt) => {
                      const isActive = currentReminderTimes.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={loading || updatingId !== null}
                          aria-pressed={isActive}
                          onClick={() => handleToggleReminderTime(item, opt.id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer  ${
                            isActive
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface text-muted hover:text-foreground border-border hover:border-primary/30"
                          }`}
                        >
                          <span><AppIcon symbol={opt.icon} /></span>
                          <span>
                            {language === "ur"
                              ? opt.labelUr
                              : language === "roman_ur"
                              ? opt.labelRoman
                              : opt.labelEn}
                          </span>
                          {isActive && <span className="text-[10px] font-bold ml-0.5">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-border bg-surface-hover flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {language === "ur"
              ? "ڈاکٹر کے نسخے کے مطابق دوائیاں استعمال کریں"
              : "Always take medications according to your doctor's exact advice."}
          </p>
          <button
            onClick={onClose}
            className="bg-primary text-white text-xs font-semibold px-5 py-2 rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
          >
            {language === "ur" ? "بند کریں" : "Close Cabinet"}
          </button>
        </div>
      </div>
    </div>
  );
}
