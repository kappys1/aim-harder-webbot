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

    // CRITICAL FIX: WAIT for the entire process to complete
    // In serverless, there's no "background" - the process is killed when response is sent
    // We MUST await the full token refresh before responding
    console.log(
      "[CRON ENDPOINT] Starting token refresh process (waiting for completion)..."
    );
    const result = await processTokenRefreshInBackground();
    console.log("[CRON ENDPOINT] Token refresh process completed:", result);

    // Respond with actual results after completion
    return NextResponse.json(
      {
        success: true,
        message: "Token refresh job completed",
        timestamp: new Date().toISOString(),
        result: result, // Include actual results
      },
      { status: 200 } // 200 OK (not 202 Accepted)
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
  const cronId = crypto.randomUUID().substring(0, 8);

  console.log(
    `[CRON_REFRESH ${cronId}] ====== Starting token refresh job ======`
  );

  try {
    // Use default supabaseAdmin client instead of isolated
    // The endpoint /api/auth/token-update uses this and works perfectly
    console.log(
      `[CRON_REFRESH ${cronId}] Fetching all active sessions using default client...`
    );
    const sessions = await SupabaseSessionService.getAllActiveSessions();
    console.log(
      `[CRON_REFRESH ${cronId}] Found ${sessions.length} active sessions`
    );

    // CRITICAL DEBUG: Log all sessions with full details
    console.log(`[CRON_REFRESH ${cronId}] ===== SESSIONS DETAIL =====`);
    sessions.forEach((session, index) => {
      console.log(
        `[CRON_REFRESH ${cronId}] Session ${index + 1}/${sessions.length}:`,
        {
          email: session.email,
          sessionType: session.sessionType,
          fingerprint: session.fingerprint,
          fingerprintLength: session.fingerprint?.length,
          token: session.token?.substring(0, 20) + "...",
          cookieCount: session.cookies?.length,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastTokenUpdateDate: session.lastTokenUpdateDate,
          tokenUpdateCount: session.tokenUpdateCount,
        }
      );
    });
    console.log(`[CRON_REFRESH ${cronId}] ===== END SESSIONS DETAIL =====`);

    const results = {
      total: sessions.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each session
    for (const session of sessions) {
      const sessionId = `${session.email}_${
        session.sessionType
      }_${session.fingerprint.substring(0, 8)}`;

      try {
        // Check if session needs update (updated_at > 30 minutes ago)
        const updatedAt = new Date(session.updatedAt || session.createdAt);
        const now = new Date();
        const minutesSinceUpdate =
          (now.getTime() - updatedAt.getTime()) / (1000 * 60);

        console.log(
          `[CRON_REFRESH ${cronId}] Processing session: ${sessionId}`,
          {
            email: session.email,
            sessionType: session.sessionType,
            fingerprint: session.fingerprint.substring(0, 10) + "...",
            minutesSinceUpdate: minutesSinceUpdate.toFixed(1),
            lastTokenUpdateDate: session.lastTokenUpdateDate,
            tokenUpdateCount: session.tokenUpdateCount,
          }
        );

        // CRITICAL FIX: Reduced threshold from 20 to 18 minutes
        // This ensures tokens are refreshed every cron run (20 min intervals)
        // Prevents edge cases where 19.5 min tokens get skipped
        if (minutesSinceUpdate < 18) {
          console.log(
            `[CRON_REFRESH ${cronId}] ⏭️  Skipping ${sessionId} - token is fresh (${minutesSinceUpdate.toFixed(
              1
            )} minutes old)`
          );
          results.skipped++;
          continue;
        }

        console.log(
          `[CRON_REFRESH ${cronId}] 🔄 Refreshing ${sessionId} - token is ${minutesSinceUpdate.toFixed(
            1
          )} minutes old`
        );

        // Call Aimharder tokenUpdate
        // CRITICAL: session.fingerprint is NOT NULL in DB (required field)
        // No fallback needed - if fingerprint is missing, session is invalid
        if (!session.fingerprint) {
          console.error(
            `[CRON_REFRESH ${cronId}] ❌ Session for ${sessionId} has no fingerprint - skipping (invalid session)`
          );
          results.failed++;
          results.errors.push(
            `${session.email} (${session.sessionType}): Missing fingerprint`
          );
          continue;
        }

        console.log(
          `[CRON_REFRESH ${cronId}] Calling AimharderRefreshService.updateToken for ${sessionId}`
        );
        const updateResult = await AimharderRefreshService.updateToken({
          token: session.token,
          fingerprint: session.fingerprint, // Use EXACT fingerprint from session
          cookies: session.cookies,
        });
        console.log(
          `[CRON_REFRESH ${cronId}] AimharderRefreshService.updateToken response for ${sessionId}:`,
          {
            success: updateResult.success,
            logout: updateResult.logout,
            error: updateResult.error,
            hasNewToken: !!updateResult.newToken,
            newCookieCount: updateResult.cookies?.length,
          }
        );

        // Handle logout response from AimHarder
        // CRITICAL: When AimHarder returns {logout: 1}, it means THIS specific session is expired
        // We should delete ONLY the specific session that failed, not all sessions
        // NEVER delete background sessions - they should persist for pre-bookings
        if (updateResult.logout) {
          console.error(
            `[CRON_REFRESH ${cronId}] ❌ Session expired (logout: 1) for ${sessionId}`
          );

          if (session.sessionType === "device") {
            // Delete only this specific device session
            console.log(
              `[CRON_REFRESH ${cronId}] Deleting expired device session for ${sessionId}`
            );
            await SupabaseSessionService.deleteSession(session.email, {
              fingerprint: session.fingerprint,
              sessionType: "device",
            });
            console.log(
              `[CRON_REFRESH ${cronId}] ✅ Device session deleted for ${
                session.email
              } (fingerprint: ${session.fingerprint?.substring(0, 10)}...)`
            );
          } else {
            // CRITICAL: Background session expired - this is unusual and needs investigation
            // DO NOT delete background session - log warning instead
            console.warn(
              `[CRON_REFRESH ${cronId}] ⚠️  Background session received logout response for ${session.email}. ` +
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
            `[CRON_REFRESH ${cronId}] ❌ Failed to update token for ${sessionId}:`,
            updateResult.error
          );
          // CRITICAL: Pass fingerprint to update the correct session's error state
          console.log(
            `[CRON_REFRESH ${cronId}] Updating error state in database for ${sessionId}`
          );
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

        console.log(
          `[CRON_REFRESH ${cronId}] ✅ Token refresh successful for ${sessionId}, updating database...`
        );

        // CRITICAL DEBUG: Log what we're about to update
        console.log(`[CRON_REFRESH ${cronId}] ===== PREPARING DB UPDATE =====`);
        console.log(`[CRON_REFRESH ${cronId}] Update parameters:`, {
          email: session.email,
          newToken: updateResult.newToken?.substring(0, 20) + "...",
          targetFingerprint: session.fingerprint,
          targetFingerprintLength: session.fingerprint?.length,
          newCookieCount: updateResult.cookies?.length,
        });
        console.log(
          `[CRON_REFRESH ${cronId}] ===== END PREPARING DB UPDATE =====`
        );

        // Update DB with new token and cookies for THIS specific session
        // CRITICAL: Pass fingerprint to target the correct session (device or background)
        console.log(
          `[CRON_REFRESH ${cronId}] Updating token in database for ${sessionId}`
        );
        try {
          await SupabaseSessionService.updateRefreshToken(
            session.email,
            updateResult.newToken,
            session.fingerprint // Target specific session
          );
          console.log(
            `[CRON_REFRESH ${cronId}] ✅ Token update in DB completed for ${sessionId}`
          );
        } catch (tokenUpdateError) {
          console.error(
            `[CRON_REFRESH ${cronId}] ❌ FAILED to update token in DB for ${sessionId}:`,
            tokenUpdateError
          );
          throw tokenUpdateError; // Re-throw to be caught by outer catch
        }

        if (updateResult.cookies && updateResult.cookies.length > 0) {
          console.log(
            `[CRON_REFRESH ${cronId}] Updating ${updateResult.cookies.length} cookies in database for ${sessionId}`
          );
          try {
            await SupabaseSessionService.updateCookies(
              session.email,
              updateResult.cookies,
              session.fingerprint // Target specific session
            );
            console.log(
              `[CRON_REFRESH ${cronId}] ✅ Cookies update in DB completed for ${sessionId}`
            );
          } catch (cookieUpdateError) {
            console.error(
              `[CRON_REFRESH ${cronId}] ❌ FAILED to update cookies in DB for ${sessionId}:`,
              cookieUpdateError
            );
            throw cookieUpdateError; // Re-throw to be caught by outer catch
          }
        }

        // Track successful token update
        // CRITICAL: Pass fingerprint to update the correct session's success state
        console.log(
          `[CRON_REFRESH ${cronId}] Updating token update metadata for ${sessionId}`
        );
        try {
          await SupabaseSessionService.updateTokenUpdateData(
            session.email,
            true,
            undefined,
            session.fingerprint // Target specific session
          );
          console.log(
            `[CRON_REFRESH ${cronId}] ✅ Token update metadata completed for ${sessionId}`
          );
        } catch (metadataUpdateError) {
          console.error(
            `[CRON_REFRESH ${cronId}] ❌ FAILED to update token metadata in DB for ${sessionId}:`,
            metadataUpdateError
          );
          throw metadataUpdateError; // Re-throw to be caught by outer catch
        }

        console.log(
          `[CRON_REFRESH ${cronId}] ✅ Token updated successfully for ${
            session.email
          } (${
            session.sessionType
          }, fingerprint: ${session.fingerprint?.substring(0, 10)}...)`
        );

        results.updated++;
      } catch (error) {
        console.error(
          `[CRON_REFRESH ${cronId}] ❌ Error processing session ${sessionId}:`,
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : error
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
      `[CRON_REFRESH ${cronId}] ====== Token refresh completed in ${totalTime}ms ======`,
      {
        total: results.total,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors,
      }
    );

    // Return results to the endpoint
    return {
      success: true,
      cronId,
      duration: totalTime,
      ...results,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `[CRON_REFRESH ${cronId}] ====== Token refresh FAILED after ${totalTime}ms ======`,
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : error
    );

    // Return error to the endpoint
    return {
      success: false,
      cronId,
      duration: totalTime,
      error: error instanceof Error ? error.message : "Unknown error",
      total: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }
}
