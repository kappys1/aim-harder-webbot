import { useCallback, useEffect, useRef } from "react";

const REFRESH_INTERVAL = 10 * 60 * 1000; // 5 minutes in milliseconds

export interface UseTokenRefreshOptions {
  email: string | null;
  onLogout: () => void;
}

export function useTokenRefresh({ email, onLogout }: UseTokenRefreshOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  const updateToken = useCallback(async () => {
    // Prevent concurrent updates
    if (isRefreshingRef.current) {
      console.log("Token refresh already in progress, skipping");
      return;
    }

    try {
      isRefreshingRef.current = true;

      // Get current token and fingerprint from localStorage
      const token = localStorage.getItem("refreshToken");
      const fingerprint = localStorage.getItem("fingerprint");

      if (!token || !fingerprint || !email) {
        console.log("Missing token, fingerprint, or email - stopping refresh");
        stopRefresh();
        return;
      }

      console.log("Updating token for:", email);

      // Call backend API
      const response = await fetch("/api/auth/token-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          token,
          fingerprint,
        }),
      });

      const data = await response.json();

      // Handle logout response
      if (data.logout) {
        console.log("Logout required, clearing session");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("fingerprint");
        stopRefresh();
        onLogout();
        return;
      }

      // Handle error
      if (!response.ok || !data.success) {
        console.error("Token refresh failed:", data.error);
        // Don't logout on error, will retry on next interval
        return;
      }

      // Update localStorage with new token
      if (data.newToken) {
        localStorage.setItem("refreshToken", data.newToken);
        console.log("Token updated successfully");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      // Don't logout on network error, will retry on next interval
    } finally {
      isRefreshingRef.current = false;
    }
  }, [email, onLogout]);

  const startRefresh = useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Check if we have the required data
    const hasToken = localStorage.getItem("refreshToken");
    const hasFingerprint = localStorage.getItem("fingerprint");

    if (!hasToken || !hasFingerprint || !email) {
      console.log("Cannot start refresh: missing token, fingerprint, or email");
      return;
    }

    console.log("Starting token refresh timer (25 min interval)");

    // Start new timer
    timerRef.current = setInterval(() => {
      updateToken();
    }, REFRESH_INTERVAL);

    // Also do an immediate update to sync with DB
    updateToken();
  }, [email, updateToken]);

  const stopRefresh = useCallback(() => {
    console.log("Stopping token refresh timer");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRefresh();
    };
  }, [stopRefresh]);

  return {
    startRefresh,
    stopRefresh,
    updateToken,
  };
}
