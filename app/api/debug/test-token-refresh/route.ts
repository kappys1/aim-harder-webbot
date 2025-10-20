import { AimharderRefreshService } from "@/modules/auth/api/services/aimharder-refresh.service";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint to test token refresh for a specific user
 * POST /api/debug/test-token-refresh
 * Body: { email: string }
 *
 * This endpoint runs SYNCHRONOUSLY (not in background) so we can see all logs
 */
export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const log = (message: string) => {
    console.log(message);
    logs.push(`${new Date().toISOString()} - ${message}`);
  };

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "Email is required",
        },
        { status: 400 }
      );
    }

    log(`[TEST] Starting token refresh test for ${email}`);

    // STEP 1: Get all sessions for this user
    log(`[TEST] Step 1: Fetching sessions for ${email}`);
    const allSessions = await SupabaseSessionService.getAllActiveSessions();
    const userSessions = allSessions.filter((s) => s.email === email);

    log(`[TEST] Found ${userSessions.length} sessions for ${email}`);

    if (userSessions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No sessions found for ${email}`,
          logs,
        },
        { status: 404 }
      );
    }

    interface SessionResult {
      sessionId: string;
      sessionType: string;
      fingerprint: string;
      skipped?: boolean;
      reason?: string;
      status?: string;
      aimharderResponse?: {
        success: boolean;
        logout: boolean;
        hasNewToken: boolean;
        newTokenLength: number;
        cookieCount: number;
        error?: string;
      };
      error?: string;
      newTokenLength?: number;
    }

    const results: SessionResult[] = [];

    // STEP 2: Process each session
    for (const session of userSessions) {
      const sessionId = `${session.email}_${
        session.sessionType
      }_${session.fingerprint.substring(0, 8)}`;
      log(`[TEST] Processing session: ${sessionId}`);

      try {
        // Check session data
        log(`[TEST] Session details:`);
        log(`  - Type: ${session.sessionType}`);
        log(`  - Fingerprint: ${session.fingerprint.substring(0, 15)}...`);
        log(`  - Has token: ${!!session.token}`);
        log(`  - Token length: ${session.token?.length || 0}`);
        log(`  - Cookie count: ${session.cookies?.length || 0}`);
        log(`  - Last update: ${session.updatedAt}`);
        log(`  - Token update count: ${session.tokenUpdateCount || 0}`);
        log(`  - Last token update: ${session.lastTokenUpdateDate || "NEVER"}`);

        const sessionResult: SessionResult = {
          sessionId,
          sessionType: session.sessionType,
          fingerprint: session.fingerprint.substring(0, 15) + "...",
        };

        // Check if token refresh is needed
        const updatedAt = new Date(session.updatedAt || session.createdAt);
        const now = new Date();
        const minutesSinceUpdate =
          (now.getTime() - updatedAt.getTime()) / (1000 * 60);

        log(
          `[TEST] Minutes since last update: ${minutesSinceUpdate.toFixed(1)}`
        );

        if (minutesSinceUpdate <= 20) {
          log(`[TEST] ⏭️  Skipping - token is fresh`);
          sessionResult.skipped = true;
          sessionResult.reason = `Token is fresh (${minutesSinceUpdate.toFixed(
            1
          )} minutes old)`;
          results.push(sessionResult);
          continue;
        }

        log(`[TEST] 🔄 Attempting token refresh...`);

        // STEP 3: Call AimHarder refresh
        log(`[TEST] Calling AimharderRefreshService.updateToken()`);
        const updateResult = await AimharderRefreshService.updateToken({
          token: session.token,
          fingerprint: session.fingerprint,
          cookies: session.cookies,
        });

        log(`[TEST] AimHarder response:`);
        log(`  - Success: ${updateResult.success}`);
        log(`  - Logout: ${updateResult.logout}`);
        log(`  - Has new token: ${!!updateResult.newToken}`);
        log(`  - New cookie count: ${updateResult.cookies?.length || 0}`);
        log(`  - Error: ${updateResult.error || "none"}`);

        sessionResult.aimharderResponse = {
          success: updateResult.success ?? false,
          logout: updateResult.logout ?? false,
          hasNewToken: !!updateResult.newToken,
          newTokenLength: updateResult.newToken?.length || 0,
          cookieCount: updateResult.cookies?.length || 0,
          error: updateResult.error,
        };

        // Handle logout
        if (updateResult.logout) {
          log(`[TEST] ❌ Session expired (logout: 1)`);
          sessionResult.status = "expired";
          results.push(sessionResult);
          continue;
        }

        // Handle error
        if (!updateResult.success || !updateResult.newToken) {
          log(`[TEST] ❌ Token refresh failed: ${updateResult.error}`);

          // Update error state
          log(`[TEST] Updating error state in database...`);
          await SupabaseSessionService.updateTokenUpdateData(
            session.email,
            false,
            updateResult.error,
            session.fingerprint
          );
          log(`[TEST] ✅ Error state updated`);

          sessionResult.status = "failed";
          sessionResult.error = updateResult.error;
          results.push(sessionResult);
          continue;
        }

        // STEP 4: Update database
        log(`[TEST] ✅ Token refresh successful, updating database...`);

        // Update token
        log(`[TEST] Updating token in database...`);
        await SupabaseSessionService.updateRefreshToken(
          session.email,
          updateResult.newToken,
          session.fingerprint
        );
        log(`[TEST] ✅ Token updated`);

        // Update cookies
        if (updateResult.cookies && updateResult.cookies.length > 0) {
          log(`[TEST] Updating ${updateResult.cookies.length} cookies...`);
          await SupabaseSessionService.updateCookies(
            session.email,
            updateResult.cookies,
            session.fingerprint
          );
          log(`[TEST] ✅ Cookies updated`);
        }

        // Update tracking metadata
        log(`[TEST] Updating token update metadata...`);
        await SupabaseSessionService.updateTokenUpdateData(
          session.email,
          true,
          undefined,
          session.fingerprint
        );
        log(`[TEST] ✅ Metadata updated`);

        log(`[TEST] ✅ Token refresh completed successfully for ${sessionId}`);

        sessionResult.status = "success";
        sessionResult.newTokenLength = updateResult.newToken.length;
        results.push(sessionResult);
      } catch (error) {
        log(
          `[TEST] ❌ Error processing session ${sessionId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        results.push({
          sessionId,
          sessionType: session.sessionType,
          fingerprint: session.fingerprint.substring(0, 15) + "...",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // STEP 5: Verify updates
    log(`[TEST] Fetching updated sessions to verify...`);
    const updatedSessions = await SupabaseSessionService.getAllActiveSessions();
    const verifiedSessions = updatedSessions.filter((s) => s.email === email);

    const verification = verifiedSessions.map((s) => ({
      sessionType: s.sessionType,
      fingerprint: s.fingerprint.substring(0, 15) + "...",
      tokenUpdateCount: s.tokenUpdateCount || 0,
      lastTokenUpdateDate: s.lastTokenUpdateDate || "NEVER",
      lastTokenUpdateError: s.lastTokenUpdateError || null,
    }));

    log(`[TEST] Verification complete`);

    return NextResponse.json(
      {
        success: true,
        email,
        timestamp: new Date().toISOString(),
        totalSessions: userSessions.length,
        results,
        verification,
        logs,
      },
      { status: 200 }
    );
  } catch (error) {
    log(
      `[TEST] ❌ Critical error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        logs,
      },
      { status: 500 }
    );
  }
}
