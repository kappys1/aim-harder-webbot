import {
  LoginRequest,
  LoginResponse,
} from "@/modules/auth/pods/login/models/login.model";
import { AuthMapper } from "../mappers/auth.mapper";
import { LoginApiResponse } from "../models/auth.api";

class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Use the new aimharder API route
      const response = await fetch("/api/auth/aimharder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: request.email,
          password: request.password,
          fingerprint: request.fingerprint, // Include browser fingerprint
        }),
      });

      const data: LoginApiResponse = await response.json();

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429 && data.rateLimited) {
          return {
            success: false,
            error:
              data.error ||
              `Too many attempts. Try again in ${data.minutesRemaining} minutes.`,
          };
        }

        return {
          success: false,
          error: data.error || "Login failed. Please try again.",
        };
      }

      return AuthMapper.fromLoginApiResponse(data);
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "Network error. Please check your connection and try again.",
      };
    }
  }

  async logout(email: string): Promise<void> {
    // Soft logout - no longer deletes session from database
    // Session remains active for background processes like pre-bookings
  }

  async checkSession(email: string): Promise<{
    isValid: boolean;
    user?: { id: string; email: string; name?: string };
    token?: string;
  }> {
    try {
      const response = await fetch(
        `/api/auth/aimharder?email=${encodeURIComponent(email)}`,
        {
          method: "GET",
        }
      );

      const data: LoginApiResponse = await response.json();

      if (response.ok && data.success && data.sessionValid) {
        return {
          isValid: true,
          user: data.data?.user,
          token: data.data?.token,
        };
      }

      return { isValid: false };
    } catch (error) {
      console.error("Session check error:", error);
      return { isValid: false };
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      // Check for auth cookie
      if (typeof document !== "undefined") {
        const cookies = document.cookie.split(";");
        const authCookie = cookies.find((cookie) =>
          cookie.trim().startsWith("aimharder-auth=")
        );
        return authCookie?.includes("true") || false;
      }
      return false;
    } catch (error) {
      console.error("Auth check error:", error);
      return false;
    }
  }

  getCookieValue(name: string): string | null {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split(";");
    const cookie = cookies.find((c) => c.trim().startsWith(`${name}=`));
    return cookie ? cookie.split("=")[1] : null;
  }

  getAimharderCookies(): Record<string, string> {
    if (typeof document === "undefined") return {};

    const requiredCookies = ["AWSALB", "AWSALBCORS", "PHPSESSID", "amhrdrauth"];
    const cookies: Record<string, string> = {};

    requiredCookies.forEach((cookieName) => {
      const value = this.getCookieValue(cookieName);
      if (value) {
        cookies[cookieName] = value;
      }
    });

    return cookies;
  }
}

export const authService = new AuthService();
