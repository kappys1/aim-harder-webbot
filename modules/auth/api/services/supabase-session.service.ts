import { supabaseAdmin } from "@/core/database/supabase";
import { AuthCookie } from "./cookie.service";
import { TokenData } from "./html-parser.service";
import { ENV } from "@/core/config/environment";

export interface SessionData {
  email: string;
  token: string;
  cookies: AuthCookie[];
  tokenData?: TokenData;
  createdAt: string;
  updatedAt?: string;
  lastRefreshDate?: string;
  refreshCount?: number;
  lastRefreshError?: string;
}

export interface SessionRow {
  id: string;
  user_email: string;
  aimharder_token: string;
  aimharder_cookies: Array<{ name: string; value: string }>;
  created_at: string;
  updated_at: string;
}

export class SupabaseSessionService {
  static async storeSession(sessionData: SessionData): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from("auth_sessions").upsert(
        {
          user_email: sessionData.email,
          aimharder_token: sessionData.token,
          aimharder_cookies: sessionData.cookies.map((c) => ({
            name: c.name,
            value: c.value,
          })),
          created_at: sessionData.createdAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_email",
        }
      );

      if (error) {
        console.error("Session storage error:", error);
        throw new Error(`Failed to store session: ${error.message}`);
      }

      console.log("Session stored successfully for user:", sessionData.email);
    } catch (error) {
      console.error("Session storage error:", error);
      throw error;
    }
  }

  static async getSession(email: string): Promise<SessionData | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .select("*")
        .eq("user_email", email)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        console.error("Session retrieval error:", error);
        throw new Error(`Failed to retrieve session: ${error.message}`);
      }

      if (!data) return null;

      const sessionRow = data as SessionRow;

      return {
        email: sessionRow.user_email,
        token: sessionRow.aimharder_token,
        cookies: sessionRow.aimharder_cookies.map((c) => ({
          name: c.name,
          value: c.value,
        })),
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
        lastRefreshDate: (sessionRow as any).last_refresh_date,
        refreshCount: (sessionRow as any).refresh_count,
        lastRefreshError: (sessionRow as any).last_refresh_error,
      };
    } catch (error) {
      console.error("Session retrieval error:", error);
      return null;
    }
  }

  static async deleteSession(email: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from("auth_sessions")
        .delete()
        .eq("user_email", email);

      if (error) {
        console.error("Session deletion error:", error);
        throw new Error(`Failed to delete session: ${error.message}`);
      }

      console.log("Session deleted successfully for user:", email);
    } catch (error) {
      console.error("Session deletion error:", error);
      throw error;
    }
  }

  static async updateSession(
    email: string,
    updates: Partial<Omit<SessionData, "email" | "createdAt">>
  ): Promise<void> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.token) {
        updateData.aimharder_token = updates.token;
      }

      if (updates.cookies) {
        updateData.aimharder_cookies = updates.cookies.map((c) => ({
          name: c.name,
          value: c.value,
        }));
      }

      const { error } = await supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      if (error) {
        console.error("Session update error:", error);
        throw new Error(`Failed to update session: ${error.message}`);
      }

      console.log("Session updated successfully for user:", email);
    } catch (error) {
      console.error("Session update error:", error);
      throw error;
    }
  }

  static async updateRefreshToken(
    email: string,
    refreshToken: string
  ): Promise<void> {
    try {
      const updateData = {
        aimharder_token: refreshToken,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      if (error) {
        console.error("Refresh token update error:", error);
        throw new Error(`Failed to update refresh token: ${error.message}`);
      }

      console.log("Refresh token updated successfully for user:", email);
    } catch (error) {
      console.error("Refresh token update error:", error);
      throw error;
    }
  }

  static async updateCookies(
    email: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<void> {
    try {
      const updateData = {
        aimharder_cookies: cookies.map((c) => ({
          name: c.name,
          value: c.value,
        })),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      if (error) {
        console.error("Cookie update error:", error);
        throw new Error(`Failed to update cookies: ${error.message}`);
      }

      console.log("Cookies updated successfully for user:", email, {
        cookieCount: cookies.length,
        cookieNames: cookies.map((c) => c.name),
      });
    } catch (error) {
      console.error("Cookie update error:", error);
      throw error;
    }
  }

  static async isSessionValid(email: string): Promise<boolean> {
    try {
      const session = await this.getSession(email);

      if (!session) return false;

      // Check if session is expired (older than 7 days)
      const createdAt = new Date(session.createdAt);
      const now = new Date();
      const daysDiff =
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      return daysDiff <= 7;
    } catch (error) {
      console.error("Session validation error:", error);
      return false;
    }
  }

  static async needsRefresh(email: string): Promise<boolean> {
    try {
      const session = await this.getSession(email);

      if (!session) return false;

      // Check if session needs refresh based on last refresh date
      if (!session.lastRefreshDate) {
        // No refresh date recorded, needs refresh
        return true;
      }

      const lastRefresh = new Date(session.lastRefreshDate);
      const now = new Date();
      const minutesDiff = (now.getTime() - lastRefresh.getTime()) / (1000 * 60);

      // Use configurable threshold from environment
      const thresholdMinutes = ENV.getBackendRefreshThresholdMinutes();

      // Needs refresh if last refresh was more than threshold minutes ago
      return minutesDiff >= thresholdMinutes;
    } catch (error) {
      console.error("Refresh check error:", error);
      return true; // Default to needing refresh on error
    }
  }

  static async getAllActiveSessions(): Promise<SessionData[]> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .select("*")
        .gte("created_at", oneWeekAgo.toISOString());

      if (error) {
        console.error("Active sessions retrieval error:", error);
        throw new Error(`Failed to retrieve active sessions: ${error.message}`);
      }

      return (data as SessionRow[]).map((row) => ({
        email: row.user_email,
        token: row.aimharder_token,
        cookies: row.aimharder_cookies.map((c) => ({
          name: c.name,
          value: c.value,
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastRefreshDate: (row as any).last_refresh_date,
        refreshCount: (row as any).refresh_count,
        lastRefreshError: (row as any).last_refresh_error,
      }));
    } catch (error) {
      console.error("Active sessions retrieval error:", error);
      return [];
    }
  }

  static async getSessionsNeedingTokenUpdate(): Promise<SessionData[]> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const thresholdMinutesAgo = new Date();
      const intervalMinutes = ENV.getBulkUpdateIntervalMinutes();
      thresholdMinutesAgo.setMinutes(thresholdMinutesAgo.getMinutes() - intervalMinutes);

      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .select("*")
        .gte("created_at", oneWeekAgo.toISOString())
        .or(`last_token_update_date.is.null,last_token_update_date.lt.${thresholdMinutesAgo.toISOString()}`);

      if (error) {
        console.error("Sessions needing update retrieval error:", error);
        throw new Error(`Failed to retrieve sessions needing update: ${error.message}`);
      }

      console.log(`Found ${data?.length || 0} sessions needing token update (not updated in last ${intervalMinutes} minutes)`);

      return (data as SessionRow[]).map((row) => ({
        email: row.user_email,
        token: row.aimharder_token,
        cookies: row.aimharder_cookies.map((c) => ({
          name: c.name,
          value: c.value,
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastRefreshDate: (row as any).last_refresh_date,
        refreshCount: (row as any).refresh_count,
        lastRefreshError: (row as any).last_refresh_error,
      }));
    } catch (error) {
      console.error("Sessions needing update retrieval error:", error);
      return [];
    }
  }

  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .delete()
        .lt("created_at", oneWeekAgo.toISOString())
        .select("id");

      if (error) {
        console.error("Session cleanup error:", error);
        throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
      }

      const cleanedCount = data?.length || 0;
      console.log(`Cleaned up ${cleanedCount} expired sessions`);

      return cleanedCount;
    } catch (error) {
      console.error("Session cleanup error:", error);
      return 0;
    }
  }

  static async getSessionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
  }> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: totalCount, error: totalError } = await supabaseAdmin
        .from("auth_sessions")
        .select("*", { count: "exact", head: true });

      const { count: activeCount, error: activeError } = await supabaseAdmin
        .from("auth_sessions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneWeekAgo.toISOString());

      if (totalError || activeError) {
        console.error("Session stats error:", totalError || activeError);
        throw new Error("Failed to retrieve session stats");
      }

      const total = totalCount || 0;
      const active = activeCount || 0;
      const expired = total - active;

      return { total, active, expired };
    } catch (error) {
      console.error("Session stats error:", error);
      return { total: 0, active: 0, expired: 0 };
    }
  }

  // Refresh tracking methods
  static async updateRefreshData(
    email: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Get current session to increment refresh count
      const session = await this.getSession(email);
      if (!session) return;

      const updateData: any = {
        last_refresh_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (success) {
        updateData.refresh_count = (session.refreshCount || 0) + 1;
        updateData.last_refresh_error = null;
      } else {
        updateData.last_refresh_error = error;
      }

      const { error: updateError } = await supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      if (updateError) {
        console.error("Refresh data update error:", updateError);
        throw new Error(
          `Failed to update refresh data: ${updateError.message}`
        );
      }
    } catch (error) {
      console.error("Refresh data update error:", error);
      throw error;
    }
  }

  // Token update methods for new tokenUpdate functionality
  static async updateTokenAndCookies(
    email: string,
    newToken: string,
    updatedCookies: Array<{ name: string; value: string }>
  ): Promise<void> {
    try {
      // Get current session to merge cookies
      const session = await this.getSession(email);
      if (!session) {
        throw new Error(`No session found for email: ${email}`);
      }

      // Merge existing cookies with updated ones (AWSALB and AWSALBCORS)
      const mergedCookies = [...session.cookies];

      // Update or add AWSALB and AWSALBCORS cookies
      updatedCookies.forEach(updatedCookie => {
        if (updatedCookie.name === 'AWSALB' || updatedCookie.name === 'AWSALBCORS') {
          const existingIndex = mergedCookies.findIndex(c => c.name === updatedCookie.name);
          if (existingIndex >= 0) {
            mergedCookies[existingIndex] = updatedCookie;
          } else {
            mergedCookies.push(updatedCookie);
          }
        }
      });

      const updateData = {
        aimharder_token: newToken,
        aimharder_cookies: mergedCookies.map((c) => ({
          name: c.name,
          value: c.value,
        })),
        updated_at: new Date().toISOString(),
        last_token_update_date: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      if (error) {
        console.error("Token update error:", error);
        throw new Error(`Failed to update token and cookies: ${error.message}`);
      }

      console.log("Token and cookies updated successfully for user:", email, {
        newTokenPrefix: newToken.substring(0, 10) + '...',
        updatedCookieCount: updatedCookies.length,
        updatedCookieNames: updatedCookies.map(c => c.name),
        totalCookieCount: mergedCookies.length
      });
    } catch (error) {
      console.error("Token and cookies update error:", error);
      throw error;
    }
  }

  static async updateTokenUpdateData(
    email: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Get current session to increment token update count
      const session = await this.getSession(email);
      if (!session) return;

      const updateData: any = {
        last_token_update_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (success) {
        updateData.token_update_count = ((session as any).tokenUpdateCount || 0) + 1;
        updateData.last_token_update_error = null;
      } else {
        updateData.last_token_update_error = error;
      }

      const { error: updateError } = await supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      if (updateError) {
        console.error("Token update data error:", updateError);
        throw new Error(
          `Failed to update token update data: ${updateError.message}`
        );
      }

      console.log("Token update tracking data updated for user:", email);
    } catch (error) {
      console.error("Token update data error:", error);
      throw error;
    }
  }

  static async getTokenUpdateStats(): Promise<{
    totalSessions: number;
    recentlyUpdated: number;
    failedUpdates: number;
  }> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { count: totalCount, error: totalError } = await supabaseAdmin
        .from("auth_sessions")
        .select("*", { count: "exact", head: true });

      const { count: recentCount, error: recentError } = await supabaseAdmin
        .from("auth_sessions")
        .select("*", { count: "exact", head: true })
        .gte("last_token_update_date", oneHourAgo.toISOString());

      const { count: failedCount, error: failedError } = await supabaseAdmin
        .from("auth_sessions")
        .select("*", { count: "exact", head: true })
        .not("last_token_update_error", "is", null);

      if (totalError || recentError || failedError) {
        console.error("Token update stats error:", totalError || recentError || failedError);
        throw new Error("Failed to retrieve token update stats");
      }

      return {
        totalSessions: totalCount || 0,
        recentlyUpdated: recentCount || 0,
        failedUpdates: failedCount || 0,
      };
    } catch (error) {
      console.error("Token update stats error:", error);
      return { totalSessions: 0, recentlyUpdated: 0, failedUpdates: 0 };
    }
  }
}
