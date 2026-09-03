"use client";

import { useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { setSession, clearSession } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export default function ClerkAuthSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      void (async () => {
        const token = await getToken();
        if (token) {
          const email = user.primaryEmailAddress?.emailAddress || "";
          const authUser: AuthUser = {
            id: user.id,
            name: user.fullName || user.firstName || email.split("@")[0] || "User",
            email: email,
            is_admin: user.publicMetadata?.role === "admin" || false,
          };
          setSession(token, authUser);
        }
      })();
    } else {
      clearSession();
    }
  }, [isLoaded, isSignedIn, user, getToken]);

  return null;
}
