import { generateFingerprint } from "@/common/utils/fingerprint.utils";
import { authService } from "@/modules/auth/api/services/auth.service";
import { useTokenRefresh } from "@/modules/auth/hooks/useTokenRefresh.hook";
import { LoginRequest } from "@/modules/auth/pods/login/models/login.model";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{
    email: string;
  } | null>(null);
  const router = useRouter();

  // Initialize token refresh hook
  const { startRefresh, stopRefresh } = useTokenRefresh({
    email: user?.email || null,
    onLogout: () => {
      // Handle forced logout from token refresh
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("user-email");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("fingerprint");
      }
      router.push("/login");
    },
  });

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate or retrieve the browser fingerprint
      const fingerprint = generateFingerprint();

      // Add fingerprint to login request
      const loginData = {
        ...data,
        fingerprint,
      };

      const response = await authService.login(loginData);

      if (response.success && response.user) {
        // Store user data and navigate to dashboard
        setUser(response.user);

        // Store user email and fingerprint in localStorage for session management
        if (typeof window !== "undefined") {
          localStorage.setItem("user-email", response.user.email);
          localStorage.setItem("fingerprint", fingerprint); // Store fingerprint for logout

          // Store refreshToken from backend if provided
          if (response.token) {
            localStorage.setItem("refreshToken", response.token);
          }
        }

        router.push("/dashboard");
      } else {
        setError(response.error || "Login failed");
      }
    } catch (err) {
      console.error("Login hook error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Multi-session logout - delete ONLY device session, preserve background session
      // Get email and fingerprint before clearing localStorage
      const email = typeof window !== "undefined" ? localStorage.getItem("user-email") : null;
      const fingerprint = typeof window !== "undefined" ? localStorage.getItem("fingerprint") : null;

      // Stop token refresh timer
      stopRefresh();

      // Clear user data from state
      setUser(null);

      // Clear localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("user-email");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("fingerprint");
      }

      // Delete device session from database (if we have email)
      if (email) {
        const response = await fetch("/api/auth/aimharder", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            fingerprint, // May be null if not stored
          }),
        });

        if (!response.ok) {
          console.warn("Failed to delete device session during logout");
        } else {
          console.log("[LOGOUT] Device session deleted successfully");
        }
      }

      toast.success("Sesión cerrada exitosamente");
      router.push("/login");
    } catch (err) {
      console.error("Logout hook error:", err);
      setError("Logout failed");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const isAuth = await authService.isAuthenticated();

      if (isAuth && typeof window !== "undefined") {
        const userEmail = localStorage.getItem("user-email");
        if (userEmail) {
          const sessionCheck = await authService.checkSession(userEmail);
          if (sessionCheck.isValid && sessionCheck.user) {
            setUser(sessionCheck.user);

            // Start token refresh if not already running and we have refreshToken
            const hasRefreshToken = localStorage.getItem("refreshToken");
            if (hasRefreshToken) {
              startRefresh();
            }

            return true;
          }
        }
      }

      // Clear user data if not authenticated
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("user-email");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("fingerprint");
      }

      return false;
    } catch (error) {
      console.error("Auth status check error:", error);
      return false;
    }
  };

  const getAimharderCookies = () => {
    return authService.getAimharderCookies();
  };

  useEffect(() => {
    // Get user email from localStorage
    if (typeof window !== "undefined") {
      const email = localStorage.getItem("user-email") || "";
      setUser({ email });
    }
  }, []);
  return {
    isLoading,
    error,
    user,
    login,
    logout,
    checkAuthStatus,
    getAimharderCookies,
    startRefresh,
    stopRefresh,
  };
}
