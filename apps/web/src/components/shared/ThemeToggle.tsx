"use client";
import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";
let initialised = false;
const themeEvent = "afiya-theme-change";
function applyPreference() {
  let saved: string | null = null;
  try { saved = localStorage.getItem("afya-theme"); } catch {}
  const dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
function subscribe(callback: () => void) {
  if (!initialised) { applyPreference(); initialised = true; }
  const storageChanged = (event: StorageEvent) => {
    if (event.key === "afya-theme" || event.key === null) { applyPreference(); callback(); }
  };
  window.addEventListener(themeEvent, callback);
  window.addEventListener("storage", storageChanged);
  return () => {
    window.removeEventListener(themeEvent, callback);
    window.removeEventListener("storage", storageChanged);
  };
}
const snapshot = (): Theme => document.documentElement.classList.contains("dark") ? "dark" : "light";
const serverSnapshot = () => null;
export default function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, snapshot, serverSnapshot);
  if (!theme) return <span className="icon-button" aria-hidden="true" />;
  const next: Theme = theme === "dark" ? "light" : "dark";
  return <button className="icon-button" aria-label={"Switch to " + next + " mode"} onClick={() => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("afya-theme", next); } catch {}
    window.dispatchEvent(new Event(themeEvent));
  }}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>;
}
