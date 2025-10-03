import { AuthCookie, CookieService } from "./cookie.service";

export interface RefreshRequest {
  token: string;
  cookies: AuthCookie[];
  fingerprint?: string; // Optional browser fingerprint
}

export interface RefreshResponse {
  success: boolean;
  refreshToken?: string;
  fingerprint?: string;
  error?: string;
}

export interface TokenUpdateRequest {
  token: string;
  fingerprint: string;
  cookies: AuthCookie[];
}

export interface TokenUpdateResponse {
  success: boolean;
  newToken?: string;
  logout?: boolean;
  cookies?: AuthCookie[];
  error?: string;
}

export class AimharderRefreshService {
  /**
   * Updates token by calling Aimharder's /api/tokenUpdate endpoint
   * This is called every 25 minutes by frontend or 29 minutes by backend cron
   */
  static async updateToken(
    request: TokenUpdateRequest
  ): Promise<TokenUpdateResponse> {
    try {
      const updateUrl = "https://aimharder.com/api/tokenUpdate";
      const cookieHeaders = CookieService.formatForRequest(request.cookies);

      // Prepare form data as Aimharder expects
      const formData = new URLSearchParams({
        token: request.token,
        ciclo: "1",
        fingerprint: request.fingerprint,
      });

      const response = await fetch(updateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieHeaders,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server error: ${response.status}`,
        };
      }

      // Extract new cookies from response
      const newCookies = CookieService.extractFromResponse(response);

      // Parse JSON response
      const data = await response.json();

      // Check if logout is required
      if (data.logout !== undefined && data.logout !== null) {
        return {
          success: false,
          logout: true,
          error: "Session expired - logout required",
        };
      }

      // Extract new token
      if (!data.newToken) {
        return {
          success: false,
          error: "No newToken in response",
        };
      }

      return {
        success: true,
        newToken: data.newToken,
        cookies: newCookies.length > 0 ? newCookies : request.cookies, // Use new cookies or keep old ones
      };
    } catch (error) {
      console.error("Token update error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token update failed",
      };
    }
  }

  static async refreshSession(
    request: RefreshRequest
  ): Promise<RefreshResponse> {
    try {
      const refreshUrl = this.buildRefreshUrl(
        request.token,
        request.fingerprint
      );
      const cookieHeaders = CookieService.formatForRequest(request.cookies);

      const response = await fetch(refreshUrl, {
        method: "GET",
        headers: {
          Cookie: cookieHeaders,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server error: ${response.status}`,
        };
      }

      const html = await response.text();
      const hasRefreshScript = html.includes(
        'localStorage.setItem("refreshToken"'
      );

      if (!hasRefreshScript) {
        return {
          success: false,
          error: "Invalid refresh response",
        };
      }

      // Extract refreshToken and fingerprint from JavaScript
      const refreshData = this.extractRefreshData(html);

      if (!refreshData.refreshToken) {
        return {
          success: false,
          error: "Failed to extract refresh token from response",
        };
      }

      return {
        success: true,
        refreshToken: refreshData.refreshToken,
        fingerprint: refreshData.fingerprint,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Refresh failed",
      };
    }
  }

  private static buildRefreshUrl(token: string, fingerprint?: string): string {
    const baseUrl = "https://aimharder.com/setrefresh";
    // Use provided fingerprint or fallback to environment variable
    const usedFingerprint =
      fingerprint ||
      process.env.AIMHARDER_FINGERPRINT ||
      "my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb";

    return `${baseUrl}?token=${encodeURIComponent(
      token
    )}&fingerprint=${encodeURIComponent(usedFingerprint)}`;
  }

  private static extractRefreshData(html: string): {
    refreshToken?: string;
    fingerprint?: string;
  } {
    try {
      // Extract refreshToken using regex
      const refreshTokenMatch = html.match(
        /localStorage\.setItem\("refreshToken",\s*"([^"]+)"\)/
      );
      const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : undefined;

      // Extract fingerprint using regex
      const fingerprintMatch = html.match(
        /localStorage\.setItem\("fingerprint",\s*"([^"]+)"\)/
      );
      const fingerprint = fingerprintMatch ? fingerprintMatch[1] : undefined;

      return {
        refreshToken,
        fingerprint,
      };
    } catch (error) {
      console.error("Error extracting refresh data:", error);
      return {};
    }
  }
}
