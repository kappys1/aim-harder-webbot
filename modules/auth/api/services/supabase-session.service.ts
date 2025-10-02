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
  fingerprint?: string; // Browser fingerprint for this session
  isAdmin?: boolean; // Admin flag for bypassing limits
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
        fingerprint: (sessionRow as any).fingerprint, // Include fingerprint from database
        isAdmin: (sessionRow as any).is_admin || false, // Include admin flag from database
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
    refreshToken: string,
    fingerprint?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        aimharder_token: refreshToken,
        updated_at: new Date().toISOString(),
      };

      // Store fingerprint if provided by setrefresh
      if (fingerprint) {
        updateData.fingerprint = fingerprint;
        console.log("Storing fingerprint from setrefresh for user:", email);
      }

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

}
