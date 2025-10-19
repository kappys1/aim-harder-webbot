import { AimharderRefreshService } from "@/modules/auth/api/services/aimharder-refresh.service";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Verify authorization (using same CRON_SECRET as other cron jobs)
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!authHeader || authHeader !== expectedToken) {
      console.error("Unauthorized cron request");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Execute in background without waiting
    processTokenRefreshInBackground().catch((error) => {
      console.error("Background token refresh error:", error);
    });

    // Respond immediately
    return NextResponse.json(
      {
        success: true,
        message: "Token refresh job started in background",
        timestamp: new Date().toISOString(),
      },
      { status: 202 } // 202 Accepted
    );
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

async function processTokenRefreshInBackground() {
  const startTime = Date.now();

  try {
    // Get all active sessions
    const sessions = await SupabaseSessionService.getAllActiveSessions();

    const results = {
      total: sessions.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each session
    for (const session of sessions) {
      try {
        // Check if session needs update (updated_at > 30 minutes ago)
        const updatedAt = new Date(session.updatedAt || session.createdAt);
        const now = new Date();
        const minutesSinceUpdate =
          (now.getTime() - updatedAt.getTime()) / (1000 * 60);

        if (minutesSinceUpdate <= 20) {
          results.skipped++;
          continue;
        }

        // Call Aimharder tokenUpdate
        const updateResult = await AimharderRefreshService.updateToken({
          token: session.token,
          fingerprint:
            session.fingerprint ||
            process.env.AIMHARDER_FINGERPRINT ||
            "default-fingerprint",
          cookies: session.cookies,
        });

        // Handle logout response from AimHarder
        // CRITICAL: When AimHarder returns {logout: 1}, it means THIS specific session is expired
        // We should delete ONLY the specific session that failed, not all sessions
        // NEVER delete background sessions - they should persist for pre-bookings
        if (updateResult.logout) {
          if (session.sessionType === "device") {
            // Delete only this specific device session
            await SupabaseSessionService.deleteSession(session.email, {
              fingerprint: session.fingerprint,
              sessionType: "device",
            });
            console.log(
              `[CRON REFRESH] Device session expired and deleted for ${
                session.email
              } (fingerprint: ${session.fingerprint?.substring(0, 10)}...)`
            );
          } else {
            // CRITICAL: Background session expired - this is unusual and needs investigation
            // DO NOT delete background session - log warning instead
            console.warn(
              `[CRON REFRESH] Background session received logout response for ${session.email}. ` +
                `This is unusual. Background session preserved.`
            );
          }
          results.failed++;
          results.errors.push(
            `${session.email} (${session.sessionType}): Session expired`
          );
          continue;
        }

        // Handle error
        if (!updateResult.success || !updateResult.newToken) {
          console.error(
            `[Background] Failed to update token for ${session.email} (${
              session.sessionType
            }, fingerprint: ${session.fingerprint?.substring(0, 10)}...):`,
            updateResult.error
          );
          // CRITICAL: Pass fingerprint to update the correct session's error state
          await SupabaseSessionService.updateTokenUpdateData(
            session.email,
            false,
            updateResult.error,
            session.fingerprint // Target specific session
          );
          results.failed++;
          results.errors.push(
            `${session.email} (${session.sessionType}): ${updateResult.error}`
          );
          continue;
        }

        // Update DB with new token and cookies for THIS specific session
        // CRITICAL: Pass fingerprint to target the correct session (device or background)
        await SupabaseSessionService.updateRefreshToken(
          session.email,
          updateResult.newToken,
          session.fingerprint // Target specific session
        );

        if (updateResult.cookies && updateResult.cookies.length > 0) {
          await SupabaseSessionService.updateCookies(
            session.email,
            updateResult.cookies,
            session.fingerprint // Target specific session
          );
        }

        // Track successful token update
        // CRITICAL: Pass fingerprint to update the correct session's success state
        await SupabaseSessionService.updateTokenUpdateData(
          session.email,
          true,
          undefined,
          session.fingerprint // Target specific session
        );

        console.log(
          `[CRON REFRESH] Token updated successfully for ${session.email} (${
            session.sessionType
          }, fingerprint: ${session.fingerprint?.substring(0, 10)}...)`
        );

        results.updated++;
      } catch (error) {
        console.error(
          `[Background] Error processing session ${session.email}:`,
          error
        );
        results.failed++;
        results.errors.push(
          `${session.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[Background] Token refresh completed in ${totalTime}ms:`,
      results
    );
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `[Background] Token refresh failed after ${totalTime}ms:`,
      error
    );
  }
}
