import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { NextResponse } from "next/server";

/**
 * Debug endpoint to check cron job status and session data
 * GET /api/debug/cron-logs
 */
export async function GET() {
  try {
    // Get all active sessions
    const sessions = await SupabaseSessionService.getAllActiveSessions();

    const sessionSummary = sessions.map(session => ({
      email: session.email,
      fingerprint: session.fingerprint.substring(0, 15) + '...',
      sessionType: session.sessionType,
      hasToken: !!session.token,
      tokenLength: session.token?.length || 0,
      cookieCount: session.cookies?.length || 0,

      // Timestamps
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,

      // Token refresh tracking
      lastTokenUpdateDate: session.lastTokenUpdateDate || 'NEVER',
      tokenUpdateCount: session.tokenUpdateCount || 0,
      lastTokenUpdateError: session.lastTokenUpdateError || null,

      // Calculate minutes since last update
      minutesSinceUpdate: session.updatedAt
        ? Math.round((Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60))
        : null,

      // Old refresh tracking (legacy)
      lastRefreshDate: session.lastRefreshDate || null,
      refreshCount: session.refreshCount || 0,
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalSessions: sessions.length,
      sessions: sessionSummary,

      // Summary stats
      stats: {
        totalSessions: sessions.length,
        deviceSessions: sessions.filter(s => s.sessionType === 'device').length,
        backgroundSessions: sessions.filter(s => s.sessionType === 'background').length,
        sessionsWithTokenUpdates: sessions.filter(s => (s.tokenUpdateCount || 0) > 0).length,
        sessionsWithErrors: sessions.filter(s => s.lastTokenUpdateError).length,
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
