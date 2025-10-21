import { supabaseAdmin } from "@/core/database/supabase";
import { AuthCookie } from "./cookie.service";
import { TokenData } from "./html-parser.service";

/**
 * Session Types for Multi-Session Architecture
 * - background: Used for cron jobs and pre-bookings (never expires)
 * - device: Used for user devices (expires after 7 days)
 */
export type SessionType = "background" | "device";

export interface SessionData {
  email: string;
  token: string;
  cookies: AuthCookie[];
  fingerprint: string; // NOW REQUIRED (not optional)
  sessionType: SessionType; // NEW: Identifies session purpose
  protected?: boolean; // NEW: Safety flag for background sessions
  tokenData?: TokenData;
  createdAt: string;
  updatedAt?: string;
  lastRefreshDate?: string;
  refreshCount?: number;
  lastRefreshError?: string;
  autoRefreshEnabled?: boolean;
  lastTokenUpdateDate?: string;
  tokenUpdateCount?: number;
  lastTokenUpdateError?: string;
  isAdmin?: boolean; // Admin flag for bypassing limits
}

export interface SessionRow {
  id: string;
  user_email: string;
  aimharder_token: string;
  aimharder_cookies: Array<{ name: string; value: string }>;
  fingerprint: string; // NOW REQUIRED
  session_type: SessionType; // NEW: Session type field
  protected: boolean; // NEW: Protected flag
  created_at: string;
  updated_at: string;
  last_refresh_date?: string;
  refresh_count?: number;
  last_refresh_error?: string;
  auto_refresh_enabled?: boolean;
  last_token_update_date?: string;
  token_update_count?: number;
  last_token_update_error?: string;
  is_admin?: boolean;
}

/**
 * Options for querying sessions
 */
export interface SessionQueryOptions {
  fingerprint?: string;
  sessionType?: SessionType;
}

/**
 * Options for deleting sessions (with safety checks)
 */
export interface SessionDeleteOptions {
  fingerprint?: string;
  sessionType?: SessionType;
  confirmProtectedDeletion?: boolean; // Required for background session deletion
}

export class SupabaseSessionService {
  /**
   * Helper method to map SessionRow to SessionData
   * @private
   */
  private static mapSessionRow(row: SessionRow): SessionData {
    return {
      email: row.user_email,
      token: row.aimharder_token,
      cookies: row.aimharder_cookies.map((c) => ({
        name: c.name,
        value: c.value,
      })),
      fingerprint: row.fingerprint,
      sessionType: row.session_type,
      protected: row.protected,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastRefreshDate: row.last_refresh_date,
      refreshCount: row.refresh_count,
      lastRefreshError: row.last_refresh_error,
      autoRefreshEnabled: row.auto_refresh_enabled,
      lastTokenUpdateDate: row.last_token_update_date,
      tokenUpdateCount: row.token_update_count,
      lastTokenUpdateError: row.last_token_update_error,
      isAdmin: row.is_admin || false,
    };
  }

  /**
   * Store a session (device or background)
   * Uses UPSERT to handle updates on re-login
   *
   * CRITICAL: onConflict is now based on (user_email, fingerprint)
   * This allows multiple sessions per user with different fingerprints
   */
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
          fingerprint: sessionData.fingerprint,
          session_type: sessionData.sessionType,
          protected: sessionData.sessionType === "background", // Auto-protect background
          created_at: sessionData.createdAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_email,fingerprint", // UPDATED: Composite key
        }
      );

      if (error) {
        console.error("Session storage error:", error);
        throw new Error(`Failed to store session: ${error.message}`);
      }
    } catch (error) {
      console.error("Session storage error:", error);
      throw error;
    }
  }

  /**
   * Get a session by email with optional filtering
   *
   * DEFAULT BEHAVIOR: Returns background session if no options provided
   * This ensures pre-bookings and background processes get the stable session
   *
   * @param email - User email
   * @param options - Optional filters (fingerprint, sessionType)
   * @returns Session data or null if not found
   */
  static async getSession(
    email: string,
    options: SessionQueryOptions = {}
  ): Promise<SessionData | null> {
    try {
      let query = supabaseAdmin
        .from("auth_sessions")
        .select("*")
        .eq("user_email", email);

      // Default behavior: return background session if no options provided
      if (!options.fingerprint && !options.sessionType) {
        query = query.eq("session_type", "background");
      }

      // Filter by fingerprint if provided
      if (options.fingerprint) {
        query = query.eq("fingerprint", options.fingerprint);
      }

      // Filter by session type if provided
      if (options.sessionType) {
        query = query.eq("session_type", options.sessionType);
      }

      // If filtering by sessionType without fingerprint, get the most recent one
      // (user might have multiple device sessions from different devices/tabs)
      if (options.sessionType && !options.fingerprint) {
        query = query.order("updated_at", { ascending: false }).limit(1);
        const { data, error } = await query;

        if (error) {
          console.error("Session retrieval error:", error);
          throw new Error(`Failed to retrieve session: ${error.message}`);
        }

        if (!data || data.length === 0) return null;

        return this.mapSessionRow(data[0] as SessionRow);
      }

      // For specific fingerprint or background session, expect single result
      const { data, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        console.error("Session retrieval error:", error);
        throw new Error(`Failed to retrieve session: ${error.message}`);
      }

      if (!data) return null;

      return this.mapSessionRow(data as SessionRow);
    } catch (error) {
      console.error("Session retrieval error:", error);
      return null;
    }
  }

  /**
   * Get the background session for a user
   * Convenience wrapper for getSession with background type filter
   *
   * @param email - User email
   * @returns Background session or null
   */
  static async getBackgroundSession(
    email: string
  ): Promise<SessionData | null> {
    return this.getSession(email, { sessionType: "background" });
  }

  /**
   * Get device session for a user
   *
   * IMPORTANT: Device sessions are user-specific login sessions from browsers/apps
   * They should be used for:
   * - Manual bookings initiated by the user
   * - User-facing API endpoints
   * - Frontend token refresh
   *
   * @param email - User email
   * @param fingerprint - Optional device fingerprint. If not provided, returns first device session
   * @returns Device session or null
   */
  static async getDeviceSession(
    email: string,
    fingerprint?: string
  ): Promise<SessionData | null> {
    const options: SessionQueryOptions = { sessionType: "device" };
    if (fingerprint) {
      options.fingerprint = fingerprint;
    }
    return this.getSession(email, options);
  }

  /**
   * Get all device sessions for a user
   * Returns array of all device sessions (could be multiple devices)
   *
   * @param email - User email
   * @returns Array of device sessions
   */
  static async getDeviceSessions(email: string): Promise<SessionData[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .select("*")
        .eq("user_email", email)
        .eq("session_type", "device");

      if (error) {
        console.error("Device sessions retrieval error:", error);
        throw new Error(`Failed to retrieve device sessions: ${error.message}`);
      }

      if (!data || data.length === 0) return [];

      return (data as SessionRow[]).map((row) => this.mapSessionRow(row));
    } catch (error) {
      console.error("Device sessions retrieval error:", error);
      return [];
    }
  }

  /**
   * Get ALL sessions for a user (background + all devices)
   *
   * @param email - User email
   * @returns Array of all sessions
   */
  static async getAllUserSessions(email: string): Promise<SessionData[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .select("*")
        .eq("user_email", email);

      if (error) {
        console.error("All user sessions retrieval error:", error);
        throw new Error(
          `Failed to retrieve all user sessions: ${error.message}`
        );
      }

      if (!data || data.length === 0) return [];

      return (data as SessionRow[]).map((row) => this.mapSessionRow(row));
    } catch (error) {
      console.error("All user sessions retrieval error:", error);
      return [];
    }
  }

  /**
   * Delete session(s) with protection logic
   *
   * CRITICAL SAFETY FEATURES:
   * - Default behavior: Deletes ONLY device sessions (not background)
   * - Background deletion requires explicit confirmation flag
   * - Can delete specific session by fingerprint
   *
   * @param email - User email
   * @param options - Deletion options (fingerprint, sessionType, confirmProtectedDeletion)
   * @throws Error if trying to delete background session without confirmation
   */
  static async deleteSession(
    email: string,
    options: SessionDeleteOptions = {}
  ): Promise<void> {
    try {
      // CRITICAL: Protect background sessions from accidental deletion
      if (
        options.sessionType === "background" &&
        !options.confirmProtectedDeletion
      ) {
        throw new Error(
          "Background session deletion requires explicit confirmation. " +
            "Set confirmProtectedDeletion: true to proceed."
        );
      }

      let query = supabaseAdmin
        .from("auth_sessions")
        .delete()
        .eq("user_email", email);

      // Priority 1: Delete specific session by fingerprint (ignores sessionType)
      if (options.fingerprint) {
        query = query.eq("fingerprint", options.fingerprint);
        console.log(
          `[DELETE SESSION] Deleting session with fingerprint: ${options.fingerprint.substring(
            0,
            10
          )}... for ${email}`
        );
      }
      // Priority 2: Delete by session type
      else if (options.sessionType) {
        query = query.eq("session_type", options.sessionType);
        console.log(
          `[DELETE SESSION] Deleting all ${options.sessionType} sessions for ${email}`
        );
      }
      // Priority 3: Default behavior - only delete device sessions
      else {
        query = query.eq("session_type", "device");
        console.log(
          `[DELETE SESSION] Deleting all device sessions for ${email} (default behavior)`
        );
      }

      const { error, count } = await query;

      if (error) {
        console.error("Session deletion error:", error);
        throw new Error(`Failed to delete session: ${error.message}`);
      }

      console.log(
        `[DELETE SESSION] Deleted ${count || 0} session(s) for ${email}`
      );
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
    } catch (error) {
      console.error("Session update error:", error);
      throw error;
    }
  }

  /**
   * Update refresh token for a specific session
   *
   * @param email - User email
   * @param refreshToken - New refresh token
   * @param fingerprint - Optional fingerprint to update specific session
   *                      If not provided, updates background session by default
   */
  static async updateRefreshToken(
    email: string,
    refreshToken: string,
    fingerprint?: string
  ): Promise<void> {
    try {
      // CRITICAL: First, let's see ALL sessions for this user before attempting update
      const { data: allSessions } = await supabaseAdmin
        .from("auth_sessions")
        .select("id, fingerprint, session_type, user_email, created_at")
        .eq("user_email", email);

      console.log(
        `[UPDATE TOKEN DEBUG] ALL sessions for ${email} BEFORE update:`,
        allSessions?.map((s) => ({
          id: s.id,
          fingerprint: s.fingerprint,
          fingerprintLength: s.fingerprint?.length,
          sessionType: s.session_type,
          createdAt: s.created_at,
        }))
      );

      if (fingerprint) {
        console.log(`[UPDATE TOKEN DEBUG] Looking for fingerprint:`, {
          provided: fingerprint,
          providedLength: fingerprint.length,
          matches: allSessions?.filter((s) => s.fingerprint === fingerprint)
            .length,
        });
      }

      const updateData: any = {
        aimharder_token: refreshToken,
        updated_at: new Date().toISOString(),
      };

      // CRITICAL FIX: Build query with proper chaining to ensure all filters apply
      let query = supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      // If fingerprint provided, update that specific session
      if (fingerprint) {
        // CRITICAL: Ensure fingerprint is trimmed and exact match
        const cleanFingerprint = fingerprint.trim();
        query = query.eq("fingerprint", cleanFingerprint);
        console.log(
          `[UPDATE TOKEN] Updating session with fingerprint: ${cleanFingerprint.substring(
            0,
            10
          )}... (length: ${cleanFingerprint.length}) for ${email}`
        );
      } else {
        // Default: update background session
        query = query.eq("session_type", "background");
        console.log(`[UPDATE TOKEN] Updating background session for ${email}`);
      }

      // CRITICAL: Get the data back to verify update worked
      const { error, data } = await query.select();
      const count = data?.length || 0;

      if (error) {
        console.error("Refresh token update error:", error);
        throw new Error(`Failed to update refresh token: ${error.message}`);
      }

      // CRITICAL FIX: Detect when no sessions were updated (addresses "updated=0" issue)
      if (count === 0) {
        const cleanFingerprint = fingerprint?.trim();
        console.error(`[UPDATE TOKEN] ⚠️  NO SESSIONS UPDATED for ${email}!`, {
          fingerprint: cleanFingerprint?.substring(0, 20) + "...",
          fingerprintFull: cleanFingerprint,
          fingerprintLength: cleanFingerprint?.length,
          sessionType: cleanFingerprint ? "specific fingerprint" : "background",
        });

        // Try to find the session to debug why it wasn't updated
        let debugQuery = supabaseAdmin
          .from("auth_sessions")
          .select(
            "id, fingerprint, session_type, user_email, created_at, updated_at"
          )
          .eq("user_email", email);

        if (cleanFingerprint) {
          debugQuery = debugQuery.eq("fingerprint", cleanFingerprint);
        } else {
          debugQuery = debugQuery.eq("session_type", "background");
        }

        const { data: debugData } = await debugQuery;
        console.error(
          `[UPDATE TOKEN] Debug: Found sessions with SAME query:`,
          debugData?.map((s) => ({
            id: s.id,
            fingerprint: s.fingerprint,
            fingerprintLength: s.fingerprint?.length,
            sessionType: s.session_type,
            fingerprintMatches: s.fingerprint === cleanFingerprint,
          }))
        );

        // Also check ALL sessions to see what's there
        const { data: allSessionsData } = await supabaseAdmin
          .from("auth_sessions")
          .select("id, fingerprint, session_type, user_email")
          .eq("user_email", email);

        console.error(
          `[UPDATE TOKEN] Debug: ALL sessions for user:`,
          allSessionsData?.map((s) => ({
            id: s.id,
            fingerprint: s.fingerprint,
            fingerprintLength: s.fingerprint?.length,
            sessionType: s.session_type,
            fingerprintMatches: s.fingerprint === cleanFingerprint,
          }))
        );

        throw new Error(
          `Session not found for update: ${email} ${
            cleanFingerprint
              ? `with fingerprint ${cleanFingerprint}`
              : "background session"
          }`
        );
      }

      console.log(
        `[UPDATE TOKEN] Updated ${count || 0} session(s) for ${email}`
      );
    } catch (error) {
      console.error("Refresh token update error:", error);
      throw error;
    }
  }

  /**
   * Update cookies for a specific session
   *
   * @param email - User email
   * @param cookies - Updated cookies
   * @param fingerprint - Optional fingerprint to update specific session
   *                      If not provided, updates background session by default
   */
  static async updateCookies(
    email: string,
    cookies: Array<{ name: string; value: string }>,
    fingerprint?: string
  ): Promise<void> {
    try {
      // CRITICAL: First, let's see ALL sessions for this user before attempting update
      const { data: allSessions } = await supabaseAdmin
        .from("auth_sessions")
        .select("id, fingerprint, session_type, user_email")
        .eq("user_email", email);

      console.log(
        `[UPDATE COOKIES DEBUG] ALL sessions for ${email}:`,
        allSessions?.map((s) => ({
          id: s.id,
          fingerprint: s.fingerprint,
          sessionType: s.session_type,
        }))
      );

      const updateData = {
        aimharder_cookies: cookies.map((c) => ({
          name: c.name,
          value: c.value,
        })),
        updated_at: new Date().toISOString(),
      };

      let query = supabaseAdmin
        .from("auth_sessions")
        .update(updateData)
        .eq("user_email", email);

      // If fingerprint provided, update that specific session
      if (fingerprint) {
        query = query.eq("fingerprint", fingerprint);
        console.log(
          `[UPDATE COOKIES] Updating session with fingerprint: ${fingerprint.substring(
            0,
            10
          )}... for ${email}`
        );
      } else {
        // Default: update background session
        query = query.eq("session_type", "background");
        console.log(
          `[UPDATE COOKIES] Updating background session for ${email}`
        );
      }

      // CRITICAL: Get the data back to verify update worked
      const { error, data } = await query.select();
      const count = data?.length || 0;

      if (error) {
        console.error("Cookie update error:", error);
        throw new Error(`Failed to update cookies: ${error.message}`);
      }

      // CRITICAL FIX: Detect when no sessions were updated
      if (count === 0) {
        console.error(
          `[UPDATE COOKIES] ⚠️  NO SESSIONS UPDATED for ${email}!`,
          {
            fingerprint: fingerprint?.substring(0, 20) + "...",
            fingerprintFull: fingerprint,
            sessionType: fingerprint ? "specific fingerprint" : "background",
            cookieCount: cookies.length,
          }
        );

        // Try to find the session to debug
        let debugQuery = supabaseAdmin
          .from("auth_sessions")
          .select("id, fingerprint, session_type, user_email")
          .eq("user_email", email);

        if (fingerprint) {
          debugQuery = debugQuery.eq("fingerprint", fingerprint);
        } else {
          debugQuery = debugQuery.eq("session_type", "background");
        }

        const { data: debugData } = await debugQuery;
        console.error(`[UPDATE COOKIES] Debug: Found sessions:`, debugData);

        throw new Error(
          `Session not found for cookie update: ${email} ${
            fingerprint
              ? `with fingerprint ${fingerprint}`
              : "background session"
          }`
        );
      }

      console.log(
        `[UPDATE COOKIES] Updated ${count || 0} session(s) for ${email}`
      );
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

  /**
   * Get all active sessions across all users
   *
   * Active = Background sessions (never expire) + Device sessions < 7 days old
   *
   * @returns Array of all active sessions
   */
  static async getAllActiveSessions(): Promise<SessionData[]> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      console.log(
        "[GET ACTIVE SESSIONS] Starting fetch of background sessions..."
      );
      console.log("[GET ACTIVE SESSIONS] Creating query builder...");

      // Use default supabaseAdmin client (same as /api/auth/token-update endpoint)
      const client = supabaseAdmin;

      const queryBuilder = client
        .from("auth_sessions")
        .select("*", { count: "exact" })
        .eq("session_type", "background");

      console.log(
        "[GET ACTIVE SESSIONS] Query builder created, executing query..."
      );
      const startTime = Date.now();

      // CRITICAL FIX: Add timeout to prevent hanging
      const queryPromise = queryBuilder;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          console.error(
            "[GET ACTIVE SESSIONS] Query timeout reached - aborting after 15 seconds"
          );
          reject(new Error("Query timeout after 15 seconds"));
        }, 15000)
      );

      console.log("[GET ACTIVE SESSIONS] Racing query vs timeout...");
      const result = (await Promise.race([
        queryPromise,
        timeoutPromise,
      ])) as Awaited<typeof queryBuilder>;
      console.log("[GET ACTIVE SESSIONS] Query/timeout race completed");

      const elapsedTime = Date.now() - startTime;
      console.log(`[GET ACTIVE SESSIONS] Query executed in ${elapsedTime}ms`, {
        hasData: !!result.data,
        hasError: !!result.error,
        errorMessage: result.error?.message,
        errorCode: result.error?.code,
        dataLength: result.data?.length,
        dbCount: result.count,
      });

      const { data, error } = result;

      if (error) {
        console.error("[GET ACTIVE SESSIONS] Error from Supabase:", {
          message: error.message,
          code: error.code,
        });
        throw new Error(`Failed to retrieve active sessions: ${error.message}`);
      }

      if (!data) {
        console.warn(
          "[GET ACTIVE SESSIONS] Data is null, returning empty array"
        );
        return [];
      }

      console.log(
        `[GET ACTIVE SESSIONS] Found ${data.length} background session(s)`
      );

      if (data.length === 0) {
        console.warn(
          "[GET ACTIVE SESSIONS] No background sessions found in database"
        );
        return [];
      }

      console.log("[GET ACTIVE SESSIONS] Session details:", {
        sessionCount: data.length,
        sessions: (data as SessionRow[]).map((row) => ({
          email: row.user_email,
          sessionType: row.session_type,
          fingerprint: row.fingerprint?.substring(0, 20) + "...",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });

      const mappedSessions = (data as SessionRow[]).map((row) =>
        this.mapSessionRow(row)
      );
      console.log(
        `[GET ACTIVE SESSIONS] Successfully mapped ${mappedSessions.length} sessions`
      );
      return mappedSessions;
    } catch (error) {
      console.error("[GET ACTIVE SESSIONS] Exception caught:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Cleanup expired sessions
   *
   * CRITICAL: Only deletes device sessions older than 7 days
   * Background sessions are NEVER deleted by this method
   *
   * @returns Number of sessions cleaned up
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabaseAdmin
        .from("auth_sessions")
        .delete()
        .eq("session_type", "device") // CRITICAL: Only delete device sessions
        .lt("created_at", oneWeekAgo.toISOString())
        .select("id");

      if (error) {
        console.error("Session cleanup error:", error);
        throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
      }

      const cleanedCount = data?.length || 0;

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired device sessions`);
      }

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

  /**
   * Token update tracking methods
   *
   * @param email - User email
   * @param success - Whether the token update was successful
   * @param error - Error message if update failed
   * @param fingerprint - Optional fingerprint to update specific session
   *                      If not provided, updates background session by default
   */
  static async updateTokenUpdateData(
    email: string,
    success: boolean,
    error?: string,
    fingerprint?: string
  ): Promise<void> {
    try {
      // OPTIMIZED: Use direct query builder instead of read-then-write
      // This avoids race conditions and works even if session was just updated

      const now = new Date().toISOString();

      // CRITICAL: First, let's see ALL sessions for this user before attempting update
      const { data: allSessions } = await supabaseAdmin
        .from("auth_sessions")
        .select("id, fingerprint, session_type, user_email")
        .eq("user_email", email);

      console.log(
        `[UPDATE TOKEN DATA DEBUG] ALL sessions for ${email}:`,
        allSessions?.map((s) => ({
          id: s.id,
          fingerprint: s.fingerprint,
          sessionType: s.session_type,
        }))
      );

      // For success case: increment counter atomically
      // For error case: just set the error field
      if (success) {
        // First, get current value to increment
        let selectQuery = supabaseAdmin
          .from("auth_sessions")
          .select("token_update_count, fingerprint, session_type, user_email")
          .eq("user_email", email);

        console.log(`[UPDATE TOKEN DATA DEBUG] Query filters:`, {
          email,
          fingerprint: fingerprint
            ? fingerprint.substring(0, 20) + "..."
            : "NOT PROVIDED",
          fingerprintLength: fingerprint?.length,
        });

        if (fingerprint) {
          selectQuery = selectQuery.eq("fingerprint", fingerprint);
          console.log(
            `[UPDATE TOKEN DATA DEBUG] Added fingerprint filter for: ${fingerprint.substring(
              0,
              20
            )}...`
          );
        } else {
          selectQuery = selectQuery.eq("session_type", "background");
          console.log(
            `[UPDATE TOKEN DATA DEBUG] Added session_type=background filter`
          );
        }

        // CRITICAL: Use maybeSingle instead of single to handle 0 results gracefully
        const {
          data: sessionData,
          error: selectError,
          count: dbCount,
        } = await selectQuery.maybeSingle();

        console.log(`[UPDATE TOKEN DATA DEBUG] Select query result:`, {
          found: !!sessionData,
          error: selectError?.message,
          errorCode: selectError?.code,
          dbCount,
          sessionData: sessionData
            ? {
                token_update_count: sessionData.token_update_count,
                fingerprint: sessionData.fingerprint?.substring(0, 20) + "...",
                session_type: sessionData.session_type,
                user_email: sessionData.user_email,
              }
            : null,
        });

        if (selectError) {
          console.error(
            `[UPDATE TOKEN DATA] ERROR finding session for ${email}${
              fingerprint
                ? ` with fingerprint ${fingerprint.substring(0, 20)}...`
                : ""
            }: ${selectError.message} (Code: ${selectError.code})`
          );
          throw new Error(
            `Failed to find session for token update: ${selectError.message}`
          );
        }

        if (!sessionData) {
          console.error(
            `[UPDATE TOKEN DATA] NO SESSION FOUND for ${email}${
              fingerprint
                ? ` with fingerprint ${fingerprint.substring(0, 20)}...`
                : ""
            }`
          );
          console.error(`[UPDATE TOKEN DATA] This means either:`, {
            reason1: "The fingerprint doesn't match",
            reason2: "The session was deleted",
            reason3: "session_type is not 'background'",
            fingerprintUsed: fingerprint?.substring(0, 20) + "...",
          });
          throw new Error(
            `Session not found for token update. Fingerprint: ${fingerprint?.substring(
              0,
              30
            )}...`
          );
        }

        const currentCount = sessionData?.token_update_count || 0;

        const updateData = {
          token_update_count: currentCount + 1,
          last_token_update_date: now,
          last_token_update_error: null,
          updated_at: now,
        };

        let updateQuery = supabaseAdmin
          .from("auth_sessions")
          .update(updateData)
          .eq("user_email", email);

        // Apply fingerprint or session_type filter
        if (fingerprint) {
          updateQuery = updateQuery.eq("fingerprint", fingerprint);
          console.log(
            `[UPDATE TOKEN DATA] Updating session with fingerprint: ${fingerprint.substring(
              0,
              10
            )}... for ${email}`
          );
        } else {
          updateQuery = updateQuery.eq("session_type", "background");
          console.log(
            `[UPDATE TOKEN DATA] Updating background session for ${email}`
          );
        }

        // CRITICAL: Get the data back to verify update worked
        const { error: updateError, data } = await updateQuery.select();
        const count = data?.length || 0;

        if (updateError) {
          console.error("Token update data update error:", updateError);
          throw new Error(
            `Failed to update token update data: ${updateError.message}`
          );
        }

        console.log(
          `[UPDATE TOKEN DATA] Updated ${count} session(s) for ${email} (success: true)`
        );
      } else {
        // CRITICAL FIX: Increment counter even on error for tracking purposes
        // This helps us see that cron IS running, even if token refresh fails
        let selectQuery = supabaseAdmin
          .from("auth_sessions")
          .select("token_update_count, fingerprint, session_type, user_email")
          .eq("user_email", email);

        console.log(`[UPDATE TOKEN DATA DEBUG - ERROR CASE] Query filters:`, {
          email,
          fingerprint: fingerprint
            ? fingerprint.substring(0, 20) + "..."
            : "NOT PROVIDED",
          fingerprintLength: fingerprint?.length,
          errorMessage: error,
        });

        if (fingerprint) {
          selectQuery = selectQuery.eq("fingerprint", fingerprint);
          console.log(
            `[UPDATE TOKEN DATA DEBUG - ERROR CASE] Added fingerprint filter for: ${fingerprint.substring(
              0,
              20
            )}...`
          );
        } else {
          selectQuery = selectQuery.eq("session_type", "background");
          console.log(
            `[UPDATE TOKEN DATA DEBUG - ERROR CASE] Added session_type=background filter`
          );
        }

        // CRITICAL: Use maybeSingle instead of single to handle 0 results gracefully
        const {
          data: sessionData,
          error: selectError,
          count: dbCount,
        } = await selectQuery.maybeSingle();

        console.log(
          `[UPDATE TOKEN DATA DEBUG - ERROR CASE] Select query result:`,
          {
            found: !!sessionData,
            error: selectError?.message,
            errorCode: selectError?.code,
            dbCount,
            sessionData: sessionData
              ? {
                  token_update_count: sessionData.token_update_count,
                  fingerprint:
                    sessionData.fingerprint?.substring(0, 20) + "...",
                  session_type: sessionData.session_type,
                  user_email: sessionData.user_email,
                }
              : null,
          }
        );

        if (selectError) {
          console.error(
            `[UPDATE TOKEN DATA - ERROR CASE] ERROR finding session for ${email}${
              fingerprint
                ? ` with fingerprint ${fingerprint.substring(0, 20)}...`
                : ""
            }: ${selectError.message} (Code: ${selectError.code})`
          );
          throw new Error(
            `Failed to find session for error token update: ${selectError.message}`
          );
        }

        if (!sessionData) {
          console.error(
            `[UPDATE TOKEN DATA - ERROR CASE] NO SESSION FOUND for ${email}${
              fingerprint
                ? ` with fingerprint ${fingerprint.substring(0, 20)}...`
                : ""
            }`
          );
          console.error(`[UPDATE TOKEN DATA - ERROR CASE] This means either:`, {
            reason1: "The fingerprint doesn't match",
            reason2: "The session was deleted",
            reason3: "session_type is not 'background'",
            fingerprintUsed: fingerprint?.substring(0, 20) + "...",
          });
          throw new Error(
            `Session not found for error token update. Fingerprint: ${fingerprint?.substring(
              0,
              30
            )}...`
          );
        }

        const currentCount = sessionData?.token_update_count || 0;

        const updateData = {
          token_update_count: currentCount + 1, // ← INCREMENT EVEN ON ERROR
          last_token_update_date: now,
          last_token_update_error: error,
          updated_at: now,
        };

        let updateQuery = supabaseAdmin
          .from("auth_sessions")
          .update(updateData)
          .eq("user_email", email);

        // Apply fingerprint or session_type filter
        if (fingerprint) {
          updateQuery = updateQuery.eq("fingerprint", fingerprint);
          console.log(
            `[UPDATE TOKEN DATA] Updating session with fingerprint: ${fingerprint.substring(
              0,
              10
            )}... for ${email} (success: false, error tracking)`
          );
        } else {
          updateQuery = updateQuery.eq("session_type", "background");
          console.log(
            `[UPDATE TOKEN DATA] Updating background session for ${email} (success: false, error tracking)`
          );
        }

        // CRITICAL: Get the data back to verify update worked
        const { error: updateError, data } = await updateQuery.select();
        const count = data?.length || 0;

        if (updateError) {
          console.error("Token update data update error:", updateError);
          throw new Error(
            `Failed to update token update data: ${updateError.message}`
          );
        }

        console.log(
          `[UPDATE TOKEN DATA] Updated ${count} session(s) for ${email} (success: false)`
        );
      }
    } catch (error) {
      console.error("Token update data update error:", error);
      throw error;
    }
  }
}
