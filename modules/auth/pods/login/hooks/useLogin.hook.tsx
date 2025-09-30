import { authService } from "@/modules/auth/api/services/auth.service";
import { LoginRequest } from "@/modules/auth/pods/login/models/login.model";
import { generateFingerprint } from "@/common/utils/fingerprint.utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const router = useRouter();

  const handleLogin = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate or retrieve the browser fingerprint
      const fingerprint = generateFingerprint();

      // Add fingerprint to login request
      const loginData = {
        ...data,
        fingerprint
      };

      const response = await authService.login(loginData);

      if (response.success && response.user) {
        // Store user data and navigate to dashboard
        setUser(response.user);

        // Store user email in localStorage for session management
        if (typeof window !== 'undefined') {
          localStorage.setItem('user-email', response.user.email);
        }

        // Log successful login
        console.log('Login successful for user:', response.user.email);

        console.log('Login successful, navigating to dashboard');
        router.push("/dashboard");
      } else {
        setError(response.error || "Login failed");
      }
    } catch (err) {
      console.error('Login hook error:', err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userEmail = user?.email || (typeof window !== 'undefined' ? localStorage.getItem('user-email') : null);

      if (userEmail) {
        await authService.logout(userEmail);
      }

      // Clear user data
      setUser(null);

      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user-email');
      }

      console.log('Logout successful, navigating to login');
      router.push("/login");
    } catch (err) {
      console.error('Logout hook error:', err);
      setError("Logout failed");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const isAuth = await authService.isAuthenticated();

      if (isAuth && typeof window !== 'undefined') {
        const userEmail = localStorage.getItem('user-email');
        if (userEmail) {
          const sessionCheck = await authService.checkSession(userEmail);
          if (sessionCheck.isValid && sessionCheck.user) {
            setUser(sessionCheck.user);
            return true;
          }
        }
      }

      // Clear user data if not authenticated
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user-email');
      }

      return false;
    } catch (error) {
      console.error('Auth status check error:', error);
      return false;
    }
  };

  const getAimharderCookies = () => {
    return authService.getAimharderCookies();
  };

  return {
    isLoading,
    error,
    user,
    handleLogin,
    handleLogout,
    checkAuthStatus,
    getAimharderCookies,
  };
}
