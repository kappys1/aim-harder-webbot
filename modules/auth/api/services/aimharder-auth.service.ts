import { AimharderRefreshService } from "./aimharder-refresh.service";
import { AuthCookie, CookieService } from "./cookie.service";
import { HtmlParserService, TokenData } from "./html-parser.service";
import {
  SessionData,
  SupabaseSessionService,
} from "./supabase-session.service";
import { generateBackgroundFingerprint } from "@/common/utils/background-fingerprint.utils";

export interface AimharderLoginRequest {
  email: string;
  password: string;
}

export interface AimharderLoginResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
    token: string;
    tokenData?: TokenData;
  };
  cookies?: AuthCookie[];
  error?: string;
}

export interface AimharderLoginAttempt {
  email: string;
  timestamp: number;
  success: boolean;
}

export class AimharderAuthService {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private static attempts: Map<string, AimharderLoginAttempt[]> = new Map();

  /**
   * Dual Login - Creates both device and background sessions
   *
   * CRITICAL: Performs TWO separate logins to AimHarder:
   * 1. Device login: Uses client-provided fingerprint (for UI interactions)
   * 2. Background login: Uses deterministic server fingerprint (for pre-bookings)
   *
   * This ensures pre-bookings continue working even if user logs out on their device
   */
  static async login(
    email: string,
    password: string,
    fingerprint?: string
  ): Promise<AimharderLoginResponse> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(email)) {
        return {
          success: false,
          error:
            "Too many login attempts. Please wait 15 minutes before trying again.",
        };
      }

      // PHASE 1: Device Session Login
      console.log(`[DUAL LOGIN] Starting device login for: ${email}`);

      // Use provided fingerprint or fallback to environment variable
      const deviceFingerprint =
        fingerprint ||
        process.env.AIMHARDER_FINGERPRINT ||
        "my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb";

      const deviceLoginResult = await this.performSingleLogin(
        email,
        password,
        deviceFingerprint,
        "device"
      );

      if (!deviceLoginResult.success) {
        this.recordAttempt(email, false);
        return deviceLoginResult;
      }

      console.log(`[DUAL LOGIN] Device login successful for: ${email}`);

      // PHASE 2: Background Session Login
      console.log(`[DUAL LOGIN] Starting background login for: ${email}`);

      const backgroundFingerprint = generateBackgroundFingerprint(email);

      const backgroundLoginResult = await this.performSingleLogin(
        email,
        password,
        backgroundFingerprint,
        "background"
      );

      if (!backgroundLoginResult.success) {
        // Device login succeeded but background failed
        console.warn(
          `[DUAL LOGIN] Background login failed for ${email}, but device login succeeded. ` +
          `Pre-bookings may not work. Error: ${backgroundLoginResult.error}`
        );
        // Continue - device session is still valid
      } else {
        console.log(`[DUAL LOGIN] Background login successful for: ${email}`);
      }

      // Record successful attempt (device login worked)
      this.recordAttempt(email, true);

      // Return device session data to client
      return deviceLoginResult;
    } catch (error) {
      console.error("Aimharder dual login error:", error);
      this.recordAttempt(email, false);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Perform a single login to AimHarder and store session
   * @private
   */
  private static async performSingleLogin(
    email: string,
    password: string,
    fingerprint: string,
    sessionType: "device" | "background"
  ): Promise<AimharderLoginResponse> {
    try {
      // Prepare form data for aimharder login
      const formData = new URLSearchParams({
        login: "Iniciar sesión",
        loginfingerprint: fingerprint,
        loginiframe: "0",
        mail: email,
        pw: password,
      });

      console.log(
        `[${sessionType.toUpperCase()} LOGIN] Calling AimHarder for ${email} with fingerprint ${fingerprint.substring(0, 10)}...`
      );

      // Make request to aimharder
      const response = await fetch(process.env.AIMHARDER_LOGIN_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Aimharder server error: ${response.status} ${response.statusText}`,
        };
      }

      // Extract cookies from response
      const cookies = CookieService.extractFromResponse(response);

      // Parse HTML response
      const html = await response.text();

      // Validate the response
      const validation = HtmlParserService.validateHtmlResponse(html);
      if (!validation.isValid) {
        return {
          success: false,
          error:
            validation.errorMessage || "Invalid credentials or login failed",
        };
      }

      // Extract token from HTML
      const tokenData = HtmlParserService.extractTokenFromIframe(html);
      if (!tokenData || !tokenData.token) {
        return {
          success: false,
          error: "Failed to extract authentication token",
        };
      }

      // Validate required cookies
      const cookieValidation = CookieService.validateRequiredCookies(cookies);
      if (!cookieValidation.isValid) {
        console.warn(
          `[${sessionType.toUpperCase()} LOGIN] Missing required cookies:`,
          cookieValidation.missing
        );
        // Continue but log warning
      }

      // Store session in Supabase with session type
      const sessionData: SessionData = {
        email,
        token: tokenData.token,
        cookies,
        fingerprint,
        sessionType,
        tokenData,
        createdAt: new Date().toISOString(),
      };

      await SupabaseSessionService.storeSession(sessionData);

      console.log(
        `[${sessionType.toUpperCase()} LOGIN] Session stored in database for ${email}`
      );

      // Call setrefresh to get the refresh token and update the database
      try {
        const refreshResult = await AimharderRefreshService.refreshSession({
          token: tokenData.token,
          cookies,
          fingerprint,
        });

        if (refreshResult.success && refreshResult.refreshToken) {
          // Update the aimharder_token field with the refresh token
          await SupabaseSessionService.updateRefreshToken(
            email,
            refreshResult.refreshToken,
            fingerprint // Use fingerprint to target specific session
          );

          console.log(
            `[${sessionType.toUpperCase()} LOGIN] Refresh token updated for ${email}`
          );
        } else {
          console.warn(
            `[${sessionType.toUpperCase()} LOGIN] Failed to get refresh token for:`,
            email,
            refreshResult.error
          );
        }
      } catch (error) {
        console.error(
          `[${sessionType.toUpperCase()} LOGIN] Error calling setrefresh for:`,
          email,
          error
        );
        // Don't fail the login if refresh token call fails
      }

      return {
        success: true,
        data: {
          user: { id: email, email, name: email },
          token: tokenData.token,
          tokenData,
        },
        cookies,
      };
    } catch (error) {
      console.error(
        `[${sessionType.toUpperCase()} LOGIN] Error:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  }

  /**
   * Logout - Deletes ONLY device session(s), preserves background session
   *
   * CRITICAL: Does NOT call AimHarder's logout API to avoid expiring all sessions
   * Background session remains active for pre-bookings to continue working
   *
   * @param email - User email
   * @param fingerprint - Optional device fingerprint to delete specific session
   */
  static async logout(email: string, fingerprint?: string): Promise<void> {
    try {
      // Delete only device session(s)
      // If fingerprint provided: delete that specific device session
      // If no fingerprint: delete ALL device sessions for this user
      await SupabaseSessionService.deleteSession(email, {
        fingerprint,
        sessionType: "device", // CRITICAL: Only delete device sessions
      });

      this.clearAttempts(email);

      console.log(
        `[LOGOUT] Device session deleted for ${email}`,
        fingerprint ? `(fingerprint: ${fingerprint.substring(0, 10)}...)` : "(all devices)"
      );
      console.log(
        `[LOGOUT] Background session preserved - pre-bookings will continue`
      );
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  static async refreshSession(email: string): Promise<AimharderLoginResponse> {
    try {
      const session = await SupabaseSessionService.getSession(email);
      if (!session) {
        return {
          success: false,
          error: "No session found",
        };
      }

      // Check if session is still valid
      if (await SupabaseSessionService.isSessionValid(email)) {
        return {
          success: true,
          data: {
            user: { id: email, email, name: email },
            token: session.token,
          },
          cookies: session.cookies,
        };
      }

      // Session expired, remove it
      await SupabaseSessionService.deleteSession(email);
      return {
        success: false,
        error: "Session expired",
      };
    } catch (error) {
      console.error("Session refresh error:", error);
      return {
        success: false,
        error: "Failed to refresh session",
      };
    }
  }

  static async getStoredSession(email: string): Promise<SessionData | null> {
    try {
      return await SupabaseSessionService.getSession(email);
    } catch (error) {
      console.error("Get stored session error:", error);
      return null;
    }
  }

  private static checkRateLimit(email: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(email) || [];

    // Clean old attempts
    const recentAttempts = attempts.filter(
      (attempt) => now - attempt.timestamp < this.RATE_LIMIT_WINDOW
    );

    // Count failed attempts in the window
    const failedAttempts = recentAttempts.filter((attempt) => !attempt.success);

    // Update attempts array
    this.attempts.set(email, recentAttempts);

    return failedAttempts.length < this.MAX_ATTEMPTS;
  }

  private static recordAttempt(email: string, success: boolean): void {
    const attempts = this.attempts.get(email) || [];
    attempts.push({
      email,
      timestamp: Date.now(),
      success,
    });

    this.attempts.set(email, attempts);
  }

  private static clearAttempts(email: string): void {
    this.attempts.delete(email);
  }

  static getRemainingAttempts(email: string): number {
    const attempts = this.attempts.get(email) || [];
    const now = Date.now();

    const recentFailedAttempts = attempts.filter(
      (attempt) =>
        !attempt.success && now - attempt.timestamp < this.RATE_LIMIT_WINDOW
    );

    return Math.max(0, this.MAX_ATTEMPTS - recentFailedAttempts.length);
  }

  static getTimeUntilNextAttempt(email: string): number {
    const attempts = this.attempts.get(email) || [];
    const now = Date.now();

    const recentFailedAttempts = attempts.filter(
      (attempt) =>
        !attempt.success && now - attempt.timestamp < this.RATE_LIMIT_WINDOW
    );

    if (recentFailedAttempts.length < this.MAX_ATTEMPTS) {
      return 0;
    }

    const oldestAttempt = Math.min(
      ...recentFailedAttempts.map((a) => a.timestamp)
    );
    return Math.max(0, this.RATE_LIMIT_WINDOW - (now - oldestAttempt));
  }
}
