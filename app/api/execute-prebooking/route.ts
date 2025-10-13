import { verifyPrebookingToken } from "@/core/qstash/security-token";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { BookingMapper } from "@/modules/booking/api/mappers/booking.mapper";
import { preBookingService } from "@/modules/prebooking/api/services/prebooking.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * QStash Webhook Endpoint - Execute Single Prebooking (HYBRID OPTIMIZATION)
 *
 * HYBRID OPTIMIZATION FLOW:
 * 1. QStash triggers 3 SECONDS BEFORE available_at
 * 2. Verify security token (fast: ~1-2ms vs ~50-100ms QStash signature)
 * 3. Fetch session & prebooking in parallel (~250ms)
 * 4. Validate prebooking state (~5ms)
 * 5. Wait until EXACT executeAt timestamp (~2750ms)
 * 6. Fire to AimHarder API immediately
 * 7. Update prebooking status (background)
 *
 * Benefits:
 * - Session fetched fresh (3s before, not expired)
 * - All queries done during wait time (zero latency at execute time)
 * - Fires at EXACT millisecond specified
 * - Fast token validation instead of QStash signature
 *
 * Timeline Example:
 * 19:29:57.000 - QStash triggers
 * 19:29:57.250 - Queries completed
 * 19:30:00.000 - Fire to AimHarder (EXACT)
 * 19:30:01.500 - AimHarder responds
 */

export const maxDuration = 10; // Vercel Hobby limit (enough for 3s wait + execution)
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

  console.log(
    `[HYBRID ${executionId}] Triggered at ${new Date(startTime).toISOString()}`
  );

  try {
    // PHASE 1: FAST TOKEN VALIDATION (~1-2ms vs ~50-100ms QStash signature)
    const body = await request.json();
    const parsedBody = body as WebhookBody;

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

    // Fetch session (FRESH: obtained 3s before execution)
    const session = await SupabaseSessionService.getSession(
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
        ? 'Booking already created manually by user'
        : bookingResponse.errorMssg || 'Booking created successfully';

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

      setImmediate(() =>
        console.log(`[HYBRID ${executionId}] ${logMessage}`)
      );

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
    console.error(`[HYBRID ${executionId}] Error after ${totalTime}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: totalTime,
      },
      { status: 500 }
    );
  }
}
