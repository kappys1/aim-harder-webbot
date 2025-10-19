import { useCallback, useEffect, useRef } from "react";

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

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

        localStorage.removeItem("refreshToken");
        localStorage.removeItem("fingerprint");
        stopRefresh();
        onLogout();
        return;
      }

      // Update localStorage with new token
      if (data.newToken) {
        localStorage.setItem("refreshToken", data.newToken);
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      // Don't logout on network error, will retry on next interval
    } finally {
      isRefreshingRef.current = false;
    }
  }, [email, onLogout]);

  const startRefresh = useCallback(async () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Check if we have the required data
    const hasToken = localStorage.getItem("refreshToken");
    const hasFingerprint = localStorage.getItem("fingerprint");

    if (!hasToken || !hasFingerprint || !email) {
      console.log("Cannot start refresh: missing token, fingerprint, or email");

      // Clear localStorage
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("fingerprint");

      // Clear cookies by calling logout endpoint
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
        });
      } catch (error) {
        console.error("Error clearing cookies:", error);
      }

      // Redirect to login
      window.location.href = "/login";
      return;
    }

    // Start new timer
    timerRef.current = setInterval(() => {
      updateToken();
    }, REFRESH_INTERVAL);

    // Also do an immediate update to sync with DB
    updateToken();
  }, [email, updateToken]);

  const stopRefresh = useCallback(() => {
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
