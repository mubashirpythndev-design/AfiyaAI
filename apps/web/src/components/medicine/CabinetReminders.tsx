"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { fetchCabinet } from "@/lib/api";
const HOURS: Record<string, number> = { morning: 8, afternoon: 14, night: 20 };
export default function CabinetReminders() {
  const { isSignedIn, user } = useUser();
  const userId = user?.id;
  useEffect(() => {
    if (!isSignedIn || !userId || !("Notification" in window)) return;
    let stopped = false;
    let running = false;
    const check = async () => {
      if (running || Notification.permission !== "granted" || localStorage.getItem("afiya_reminders_enabled") !== "true") return;
      running = true;
      try {
        const cabinet = await fetchCabinet();
        if (stopped) return;
        const now = new Date();
        const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
        for (const item of cabinet.items) {
          for (const time of item.reminder_times ?? []) {
            if (HOURS[time] !== now.getHours() || now.getMinutes() > 4) continue;
            const key = "afiya_reminder:" + userId + ":" + item.medicine_id + ":" + time;
            if (localStorage.getItem(key) === date) continue;
            new Notification("Afiya AI — Scheduled reminder", {
              body: item.medicine.brand_name + " " + item.medicine.strength + ": Check your prescribed schedule. Follow your doctor's instructions.",
              tag: key,
              icon: "/favicon.ico",
            });
            localStorage.setItem(key, date);
          }
        }
      } catch { /* Retry next minute; failed delivery is never marked delivered. */ }
      finally { running = false; }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 60000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [isSignedIn, userId]);
  return null;
}
