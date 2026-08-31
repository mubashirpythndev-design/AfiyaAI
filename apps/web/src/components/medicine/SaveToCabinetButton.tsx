"use client";

import { useEffect, useState } from "react";
import { addToCabinet, removeFromCabinet, checkCabinetStatus } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface SaveToCabinetButtonProps {
  medicineId: string;
  onRequireAuth?: () => void;
  className?: string;
  variant?: "default" | "compact";
}

export default function SaveToCabinetButton({
  medicineId,
  onRequireAuth,
  className = "",
  variant = "default",
}: SaveToCabinetButtonProps) {
  const [inCabinet, setInCabinet] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (isLoggedIn() && medicineId) {
      checkCabinetStatus(medicineId)
        .then((res) => {
          if (isMounted) setInCabinet(res.in_cabinet);
        })
        .catch(() => {
          if (isMounted) setInCabinet(false);
        });
    } else {
      setInCabinet(false);
    }
    return () => {
      isMounted = false;
    };
  }, [medicineId]);

  const toggleCabinet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn()) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    setLoading(true);
    try {
      if (inCabinet) {
        await removeFromCabinet(medicineId);
        setInCabinet(false);
      } else {
        await addToCabinet(medicineId);
        setInCabinet(true);
      }
    } catch (err) {
      console.error("Failed to toggle medicine in cabinet:", err);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "compact") {
    return (
      <button
        onClick={toggleCabinet}
        disabled={loading}
        title={inCabinet ? "Remove from Cabinet" : "Save to Cabinet"}
        className={`text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
          inCabinet
            ? "bg-success/15 border-success/30 text-success"
            : "bg-surface border-border text-muted hover:text-foreground hover:border-primary/30"
        } ${className}`}
      >
        <span>{inCabinet ? "✓" : "⭐"}</span>
        <span>{loading ? "..." : inCabinet ? "Saved" : "Save"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleCabinet}
      disabled={loading}
      className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-200 flex items-center justify-center gap-2 shrink-0 ${
        inCabinet
          ? "bg-success/10 border-success/30 text-success hover:bg-success/20"
          : "bg-surface hover:bg-surface-hover text-foreground border-border hover:border-primary/30 shadow-sm"
      } ${className}`}
    >
      <span className="text-base leading-none">{inCabinet ? "✓" : "⭐"}</span>
      <span>
        {loading
          ? "Updating..."
          : inCabinet
          ? "Saved in Cabinet"
          : "Save to Cabinet"}
      </span>
    </button>
  );
}
