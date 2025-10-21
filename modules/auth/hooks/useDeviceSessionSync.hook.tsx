"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Device Session Sync Hook
 *
 * CRITICAL: Ensures localStorage token matches DB token
 * Syncs on:
 * - Component mount
 * - Window focus (user returns to tab)
 *
 * This prevents token desync issues where:
 * - Cron updates DB token
 * - localStorage still has old token
 * - Bookings fail due to stale token
 */
export function useDeviceSessionSync(email: string | null) {
  const syncInProgress = useRef(false);
  const lastSyncTime = useRef<number>(0);

  const syncSession = useCallback(async () => {
    // Don't sync if no email or sync already in progress
    if (!email || syncInProgress.current) {
      return;
    }

    // Debounce: Don't sync more than once per 30 seconds
    const now = Date.now();
    if (now - lastSyncTime.current < 30000) {
      console.log("[SYNC] Skipping sync (debounced)");
      return;
    }

    const fingerprint = localStorage.getItem("fingerprint");
    const currentToken = localStorage.getItem("refreshToken");

    if (!fingerprint || !currentToken) {
      console.warn("[SYNC] Missing fingerprint or token in localStorage");
      return;
    }

    syncInProgress.current = true;
    lastSyncTime.current = now;

    try {
      console.log("[SYNC] Starting device session sync...");

      const response = await fetch("/api/auth/sync-device-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": email,
        },
        body: JSON.stringify({ fingerprint, currentToken }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.needsSync) {
          console.log("[SYNC] ✅ Token updated from DB", {
            oldTokenPrefix: currentToken.substring(0, 10) + '...',
            newTokenPrefix: data.token.substring(0, 10) + '...',
            tokenUpdateCount: data.tokenUpdateCount,
          });

          // Update localStorage with fresh token from DB
          localStorage.setItem("refreshToken", data.token);

          // Note: Cookies are managed server-side, not in localStorage
          // They're automatically included in API requests
        } else {
          console.log("[SYNC] ✅ Token already up-to-date", {
            tokenUpdateCount: data.tokenUpdateCount,
          });
        }
      } else {
        const error = await response.json();
        console.error("[SYNC] ❌ Sync failed:", error);
      }
    } catch (error) {
      console.error("[SYNC] ❌ Error syncing session:", error);
    } finally {
      syncInProgress.current = false;
    }
  }, [email]);

  // Sync on mount
  useEffect(() => {
    if (email) {
      console.log("[SYNC] Syncing on mount for", email);
      syncSession();
    }
  }, [email, syncSession]);

  // Sync on window focus
  useEffect(() => {
    const handleFocus = () => {
      console.log("[SYNC] Window focused, syncing session...");
      syncSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[SYNC] Tab became visible, syncing session...");
        syncSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncSession]);

  return { syncSession };
}
