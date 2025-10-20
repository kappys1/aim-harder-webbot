import { verifyPrebookingToken } from "@/core/qstash/security-token";
import { AimharderRefreshService } from "@/modules/auth/api/services/aimharder-refresh.service";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { BookingMapper } from "@/modules/booking/api/mappers/booking.mapper";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { preBookingService } from "@/modules/prebooking/api/services/prebooking.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * QStash Webhook Endpoint - Execute Single Prebooking (HYBRID OPTIMIZATION)
 *
 * HYBRID OPTIMIZATION FLOW:
 * 1. QStash triggers 5 SECONDS BEFORE available_at
 * 2. Verify security token (fast: ~1-2ms vs ~50-100ms QStash signature)
 * 3. Fetch session & prebooking in parallel (~250ms)
 * 4. Validate prebooking state (~5ms)
 * 5. Wait until EXACT executeAt timestamp (~4750ms)
 * 6. Fire to AimHarder API immediately
 * 7. Update prebooking status (background)
 *
 * Benefits:
 * - Session fetched fresh (5s before, not expired)
 * - Token kept fresh by cron job (runs every 20 minutes)
 * - All queries done during wait time (zero latency at execute time)
 * - Fires at EXACT millisecond specified
 * - Fast token validation instead of QStash signature
 *
 * Timeline Example:
 * 19:29:55.000 - QStash triggers
 * 19:29:55.250 - Queries completed
 * 19:30:00.000 - Fire to AimHarder (EXACT)
 * 19:30:01.500 - AimHarder responds
 *
 * Note: Token refresh is handled by /api/cron/refresh-tokens (every 20 min)
 */

export const maxDuration = 10; // Vercel Hobby limit (enough for 5s wait + execution)
export const dynamic = "force-dynamic";

interface WebhookBody {
  prebookingId: string;
  boxSubdomain: string;
  boxAimharderId: string;
  executeAt: string; // Unix timestamp in milliseconds (sent as string to prevent QStash processing)
  securityToken: string; // HMAC-SHA256 token
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();
  let parsedBody: WebhookBody | undefined;

  console.log(
    `[HYBRID ${executionId}] Triggered at ${new Date(startTime).toISOString()}`
  );

  try {
    // PHASE 1: FAST TOKEN VALIDATION (~1-2ms vs ~50-100ms QStash signature)
    const body = await request.json();
    parsedBody = body as WebhookBody;

    const {
      prebookingId,
      boxSubdomain,
      boxAimharderId,
      executeAt,
      securityToken,
    } = parsedBody;

    if (
      !prebookingId ||
      !boxSubdomain ||
      !boxAimharderId ||
      !executeAt ||
      !securityToken
    ) {
      console.error(`[HYBRID ${executionId}] Missing required fields`);
      return NextResponse.json(
        {
          error:
            "Missing required fields (prebookingId, boxSubdomain, boxAimharderId, executeAt, securityToken)",
        },
        { status: 400 }
      );
    }

    // Parse executeAt from string to number (milliseconds)
    const executeAtMs = parseInt(executeAt, 10);

    if (isNaN(executeAtMs)) {
      console.error(
        `[HYBRID ${executionId}] Invalid executeAt timestamp: ${executeAt}`
      );
      return NextResponse.json(
        { error: "Invalid executeAt timestamp" },
        { status: 400 }
      );
    }

    // Verify security token (FAST: ~1-2ms)
    const tokenValid = verifyPrebookingToken(
      securityToken,
      prebookingId,
      executeAtMs
    );

    if (!tokenValid) {
      console.error(`[HYBRID ${executionId}] Invalid security token`);
      return NextResponse.json(
        { error: "Invalid security token" },
        { status: 401 }
      );
    }

    const tokenValidationTime = Date.now() - startTime;
    console.log(
      `[HYBRID ${executionId}] Token validated in ${tokenValidationTime}ms`
    );

    // PHASE 2: PREPARATORY QUERIES IN PARALLEL (~200-300ms)
    const queriesStart = Date.now();
    const prebooking = await preBookingService.findById(prebookingId);

    if (!prebooking) {
      console.error(
        `[HYBRID ${executionId}] Prebooking not found: ${prebookingId}`
      );
      return NextResponse.json(
        { error: "Prebooking not found" },
        { status: 404 }
      );
    }

    if (prebooking.status !== "pending") {
      console.log(
        `[HYBRID ${executionId}] Prebooking ${prebookingId} already processed (status: ${prebooking.status})`
      );
      return NextResponse.json({
        success: true,
        message: `Prebooking already processed (status: ${prebooking.status})`,
        prebookingId,
        status: prebooking.status,
      });
    }

    // Fetch BACKGROUND session (FRESH: obtained 5s before execution)
    // CRITICAL: Use background session to ensure pre-bookings work even if user logged out
    const session = await SupabaseSessionService.getBackgroundSession(
      prebooking.userEmail
    );

    if (!session) {
      console.error(
        `[HYBRID ${executionId}] Session not found for ${prebooking.userEmail}`
      );
      // Background update
      preBookingService
        .markFailed(prebookingId, "Session not found")
        .catch((err) =>
          setImmediate(() =>
            console.error(
              `[HYBRID ${executionId}] Background update failed:`,
              err
            )
          )
        );
      return NextResponse.json(
        {
          success: false,
          error: "Session not found",
          prebookingId,
        },
        { status: 500 }
      );
    }

    const queriesTime = Date.now() - queriesStart + 1;
    console.log(
      `[HYBRID ${executionId}] Queries completed in ${queriesTime}ms`
    );

    // PHASE 2.5: CHECK AND REFRESH TOKEN IF NEEDED
    // ENABLED: Backup token refresh mechanism
    // Primary refresh is via external cron job, but this acts as safety net
    // Ensures token is always fresh before booking to prevent { logout: 1 } errors

    // Refresh token if it's older than 25 minutes to prevent { logout: 1 } errors
    const shouldRefreshToken = () => {
      console.log(`[HYBRID ${executionId}] Checking if token refresh is needed...`, {
        hasLastTokenUpdateDate: !!session.lastTokenUpdateDate,
        lastTokenUpdateDate: session.lastTokenUpdateDate,
        tokenUpdateCount: session.tokenUpdateCount,
        fingerprint: session.fingerprint?.substring(0, 10) + '...',
      });

      if (!session.lastTokenUpdateDate) {
        console.log(
          `[HYBRID ${executionId}] ⚠️  Token never updated, needs refresh`
        );
        return true;
      }

      const lastUpdate = new Date(session.lastTokenUpdateDate);
      const now = new Date();
      const minutesSinceUpdate =
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

      if (minutesSinceUpdate > 25) {
        console.log(
          `[HYBRID ${executionId}] ⚠️  Token is ${minutesSinceUpdate.toFixed(
            1
          )} minutes old (threshold: 25 min), needs refresh`
        );
        return true;
      }

      console.log(
        `[HYBRID ${executionId}] ✅ Token is ${minutesSinceUpdate.toFixed(
          1
        )} minutes old, still fresh (threshold: 25 min)`
      );
      return false;
    };

    if (shouldRefreshToken()) {
      const refreshStart = Date.now();
      console.log(`[HYBRID ${executionId}] 🔄 Starting token refresh...`, {
        currentTokenPrefix: session.token.substring(0, 10) + '...',
        fingerprint: session.fingerprint?.substring(0, 10) + '...',
        cookieCount: session.cookies.length,
      });

      try {
        // CRITICAL: Use EXACT fingerprint from background session
        // Background sessions ALWAYS have a deterministic fingerprint
        if (!session.fingerprint) {
          console.error(`[HYBRID ${executionId}] ❌ Background session missing fingerprint - invalid session`);
          throw new Error('Background session missing fingerprint - invalid session');
        }

        console.log(`[HYBRID ${executionId}] Calling AimharderRefreshService.updateToken...`);
        const refreshResult = await AimharderRefreshService.updateToken({
          token: session.token,
          fingerprint: session.fingerprint, // Use EXACT fingerprint from background session
          cookies: session.cookies,
        });

        const refreshTime = Date.now() - refreshStart;
        console.log(`[HYBRID ${executionId}] Token refresh completed in ${refreshTime}ms`, {
          success: refreshResult.success,
          logout: refreshResult.logout,
          error: refreshResult.error,
          hasNewToken: !!refreshResult.newToken,
        });

        if (refreshResult.logout) {
          console.error(
            `[HYBRID ${executionId}] ❌ Token refresh failed - session expired (${refreshTime}ms)`
          );
          preBookingService
            .markFailed(prebookingId, "Session expired - please login again")
            .catch((err) =>
              setImmediate(() =>
                console.error(
                  `[HYBRID ${executionId}] Background update failed:`,
                  err
                )
              )
            );
          return NextResponse.json(
            {
              success: false,
              error: "Session expired - please login again",
              prebookingId,
            },
            { status: 401 }
          );
        }

        if (!refreshResult.success || !refreshResult.newToken) {
          console.error(
            `[HYBRID ${executionId}] ❌ Token refresh failed: ${refreshResult.error} (${refreshTime}ms)`
          );
          preBookingService
            .markFailed(
              prebookingId,
              `Token refresh failed: ${refreshResult.error}`
            )
            .catch((err) =>
              setImmediate(() =>
                console.error(
                  `[HYBRID ${executionId}] Background update failed:`,
                  err
                )
              )
            );
          return NextResponse.json(
            {
              success: false,
              error: "Failed to refresh authentication",
              prebookingId,
            },
            { status: 500 }
          );
        }

        // Update session in database with new token
        // CRITICAL: Pass session fingerprint to update the correct background session
        console.log(`[HYBRID ${executionId}] Updating token in database...`);
        await SupabaseSessionService.updateRefreshToken(
          prebooking.userEmail,
          refreshResult.newToken,
          session.fingerprint // Target background session
        );

        if (refreshResult.cookies && refreshResult.cookies.length > 0) {
          console.log(`[HYBRID ${executionId}] Updating ${refreshResult.cookies.length} cookies in database...`);
          await SupabaseSessionService.updateCookies(
            prebooking.userEmail,
            refreshResult.cookies,
            session.fingerprint // Target background session
          );
        }

        // Track successful token update for background session
        console.log(`[HYBRID ${executionId}] Updating token update metadata...`);
        await SupabaseSessionService.updateTokenUpdateData(
          prebooking.userEmail,
          true,
          undefined,
          session.fingerprint // Target background session
        );

        console.log(
          `[HYBRID ${executionId}] ✅ Token refreshed successfully (${refreshTime}ms)`,
          {
            newTokenPrefix: refreshResult.newToken.substring(0, 10) + '...',
            updatedCookies: refreshResult.cookies?.length || 0,
          }
        );

        // Update session object with fresh token for booking
        session.token = refreshResult.newToken;
        if (refreshResult.cookies && refreshResult.cookies.length > 0) {
          session.cookies = refreshResult.cookies;
        }
      } catch (error) {
        const refreshTime = Date.now() - refreshStart;
        console.error(
          `[HYBRID ${executionId}] ❌ Token refresh error (${refreshTime}ms):`,
          error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : error
        );
        // Continue with existing token (cron might have refreshed it)
      }
    } else {
      console.log(`[HYBRID ${executionId}] Token refresh not needed, proceeding with existing token`);
    }

    // Log token age for monitoring
    if (session.lastTokenUpdateDate) {
      const lastUpdate = new Date(session.lastTokenUpdateDate);
      const now = new Date();
      const minutesSinceUpdate =
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      console.log(
        `[HYBRID ${executionId}] Using token updated ${minutesSinceUpdate.toFixed(1)} minutes ago (by cron job)`
      );
    } else {
      console.log(
        `[HYBRID ${executionId}] Using token (no update history available)`
      );
    }

    // PHASE 3: WAIT UNTIL EXACT EXECUTION TIME
    const now = Date.now();
    const targetTime = executeAtMs;
    const waitTime = targetTime - now;

    if (waitTime > 0) {
      console.log(
        `[HYBRID ${executionId}] Waiting ${waitTime}ms until ${new Date(
          targetTime
        ).toISOString()}`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } else {
      console.warn(
        `[HYBRID ${executionId}] Already past target time by ${-waitTime}ms`
      );
    }

    // PHASE 4: FIRE TO AIMHARDER IMMEDIATELY
    const fireTime = Date.now();
    const latency = fireTime - targetTime;
    console.log(
      `[HYBRID ${executionId}] 🔥 FIRING at ${new Date(
        fireTime
      ).toISOString()} (latency: ${latency}ms from target)`
    );

    const bookingExecutionStart = Date.now();
    const bookingResponse = await bookingService.createBooking(
      prebooking.bookingData,
      session.cookies,
      boxSubdomain
    );
    const bookingExecutionTime = Date.now() - bookingExecutionStart;

    console.log(
      `[HYBRID ${executionId}] AimHarder responded in ${bookingExecutionTime}ms - bookState: ${
        bookingResponse.bookState
      }, bookingId: ${bookingResponse.id || "N/A"}`
    );

    // PHASE 5: UPDATE STATUS (BACKGROUND)
    // Use mapper to determine success (handles "already booked manually" case)
    const mappedResult = BookingMapper.mapBookingCreateResult(bookingResponse);
    const success = mappedResult.success;
    const totalTime = Date.now() - startTime;

    if (success) {
      // Determine appropriate message
      const message = mappedResult.alreadyBookedManually
        ? "Booking already created manually by user"
        : bookingResponse.errorMssg || "Booking created successfully";

      preBookingService
        .markCompleted(prebookingId, {
          bookingId: bookingResponse.id,
          bookState: bookingResponse.bookState,
          message,
          alreadyBookedManually: mappedResult.alreadyBookedManually,
        })
        .catch((err) =>
          setImmediate(() =>
            console.error(
              `[HYBRID ${executionId}] Background update failed:`,
              err
            )
          )
        );

      const logMessage = mappedResult.alreadyBookedManually
        ? `✅ SUCCESS (user booked manually) in ${totalTime}ms (fire latency: ${latency}ms)`
        : `✅ SUCCESS in ${totalTime}ms (fire latency: ${latency}ms)`;

      setImmediate(() => console.log(`[HYBRID ${executionId}] ${logMessage}`));

      return NextResponse.json({
        success: true,
        message: mappedResult.alreadyBookedManually
          ? "User already booked manually"
          : "Prebooking executed successfully",
        prebookingId,
        bookingId: bookingResponse.id,
        alreadyBookedManually: mappedResult.alreadyBookedManually,
        executionTime: totalTime,
        fireLatency: latency,
      });
    } else {
      preBookingService
        .markFailed(
          prebookingId,
          bookingResponse.errorMssg || "Booking failed",
          { bookState: bookingResponse.bookState }
        )
        .catch((err) =>
          setImmediate(() =>
            console.error(
              `[HYBRID ${executionId}] Background update failed:`,
              err
            )
          )
        );

      setImmediate(() =>
        console.log(
          `[HYBRID ${executionId}] ❌ FAILED in ${totalTime}ms (fire latency: ${latency}ms): ${
            bookingResponse.errorMssg || "Booking failed"
          }`
        )
      );

      return NextResponse.json(
        {
          success: false,
          message: bookingResponse.errorMssg || "Booking failed",
          prebookingId,
          bookState: bookingResponse.bookState,
          executionTime: totalTime,
          fireLatency: latency,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;

    // LOG: Detailed structured error logging
    const errorDetails = {
      executionId,
      prebookingId: parsedBody?.prebookingId,
      boxSubdomain: parsedBody?.boxSubdomain,
      boxAimharderId: parsedBody?.boxAimharderId,
      executeAt: parsedBody?.executeAt,
      totalTime,
      timestamp: new Date().toISOString(),
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    // Add BookingApiError specific details if available
    if (error instanceof Error && error.name === "BookingApiError") {
      const bookingError = error as Error & {
        type?: string;
        statusCode?: number;
        details?: unknown;
      };
      Object.assign(errorDetails, {
        errorType: bookingError.type,
        errorStatusCode: bookingError.statusCode,
        errorDetails: bookingError.details,
      });
    }

    console.error(
      `[HYBRID ${executionId}] DETAILED ERROR after ${totalTime}ms:`,
      JSON.stringify(errorDetails, null, 2)
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: totalTime,
        executionId, // Include for tracking
      },
      { status: 500 }
    );
  }
}
