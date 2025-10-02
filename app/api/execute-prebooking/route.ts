import { verifyQStashSignature } from "@/core/qstash/signature";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { preBookingService } from "@/modules/prebooking/api/services/prebooking.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * QStash Webhook Endpoint - Execute Single Prebooking
 *
 * This endpoint is called by QStash at the exact timestamp specified
 * when the prebooking was created (precision <100ms)
 *
 * Flow:
 * 1. QStash sends POST request at scheduled time
 * 2. Verify QStash signature (security)
 * 3. Get prebooking from database
 * 4. Get user session
 * 5. Execute booking on AimHarder API
 * 6. Update prebooking status
 *
 * No more:
 * - Polling every minute
 * - FIFO async with 50ms stagger
 * - Timeout guards
 * - Batch processing
 *
 * Much simpler: 1 prebooking = 1 execution
 */

export const maxDuration = 10; // Vercel Hobby limit
export const dynamic = "force-dynamic";

interface WebhookBody {
  prebookingId: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  // console.log(`[QStash Webhook ${executionId}] Starting execution at ${new Date().toISOString()}`);

  try {
    // 1. Verify QStash signature
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      console.error(`[QStash Webhook ${executionId}] Missing signature`);
      return NextResponse.json(
        { error: "Missing QStash signature" },
        { status: 401 }
      );
    }

    const body = await request.text();

    // OPTIMIZATION: Parallelize signature verification and JSON parsing
    const [isValid, parsedBody] = await Promise.all([
      verifyQStashSignature(signature, body),
      Promise.resolve(JSON.parse(body) as WebhookBody),
    ]);

    if (!isValid) {
      console.error(`[QStash Webhook ${executionId}] Invalid signature`);
      return NextResponse.json(
        { error: "Invalid QStash signature" },
        { status: 401 }
      );
    }

    // 2. Extract prebookingId from parsed body
    const { prebookingId } = parsedBody;

    if (!prebookingId) {
      console.error(`[QStash Webhook ${executionId}] Missing prebookingId`);
      return NextResponse.json(
        { error: "Missing prebookingId" },
        { status: 400 }
      );
    }

    // console.log(`[QStash Webhook ${executionId}] Processing prebooking ${prebookingId}`);

    // 3. Get prebooking from database and session in parallel (OPTIMIZATION: ~100ms saved)
    const prebooking = await preBookingService.findById(prebookingId);

    if (!prebooking) {
      console.error(
        `[QStash Webhook ${executionId}] Prebooking not found: ${prebookingId}`
      );
      return NextResponse.json(
        { error: "Prebooking not found" },
        { status: 404 }
      );
    }

    if (prebooking.status !== "pending") {
      console.log(
        `[QStash Webhook ${executionId}] Prebooking ${prebookingId} already processed (status: ${prebooking.status})`
      );
      return NextResponse.json({
        success: true,
        message: `Prebooking already processed (status: ${prebooking.status})`,
        prebookingId,
        status: prebooking.status,
      });
    }

    // 4. Get user session in parallel after prebooking validation
    const session = await SupabaseSessionService.getSession(
      prebooking.userEmail
    );

    if (!session) {
      console.error(
        `[QStash Webhook ${executionId}] Session not found for ${prebooking.userEmail}`
      );
      // OPTIMIZATION: Non-blocking update (background task)
      preBookingService
        .markFailed(prebookingId, "Session not found")
        .catch((err) =>
          setImmediate(() =>
            console.error(
              `[QStash Webhook ${executionId}] Background update failed:`,
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

    // 5. Execute booking on AimHarder API
    // console.log(
    //   `[QStash Webhook ${executionId}] Executing booking for ${prebooking.userEmail}...`
    // );

    const bookingExecutionStart = Date.now();
    const bookingResponse = await bookingService.createBooking(
      prebooking.bookingData,
      session.cookies
    );
    const bookingExecutionTime = Date.now() - bookingExecutionStart;

    console.log(
      `[QStash Webhook ${executionId}] Booking execution took ${bookingExecutionTime}ms - bookState: ${
        bookingResponse.bookState
      }, bookingId: ${bookingResponse.id || "N/A"}`
    );

    // 6. Update prebooking status based on result
    const success = bookingResponse.bookState === 1 || bookingResponse.id;
    const totalTime = Date.now() - startTime;

    if (success) {
      // OPTIMIZATION: Non-blocking update (background task) - Saves ~50-100ms
      preBookingService
        .markCompleted(prebookingId, {
          bookingId: bookingResponse.id,
          bookState: bookingResponse.bookState,
          message: bookingResponse.errorMssg || "Booking created successfully",
        })
        .catch((err) =>
          setImmediate(() =>
            console.error(
              `[QStash Webhook ${executionId}] Background update failed:`,
              err
            )
          )
        );

      // OPTIMIZATION: Async log
      setImmediate(() =>
        console.log(
          `[QStash Webhook ${executionId}] ✅ Prebooking ${prebookingId} completed successfully in ${totalTime}ms`
        )
      );

      return NextResponse.json({
        success: true,
        message: "Prebooking executed successfully",
        prebookingId,
        bookingId: bookingResponse.id,
        executionTime: totalTime,
      });
    } else {
      // OPTIMIZATION: Non-blocking update (background task)
      preBookingService
        .markFailed(
          prebookingId,
          bookingResponse.errorMssg || "Booking failed",
          { bookState: bookingResponse.bookState }
        )
        .catch((err) =>
          setImmediate(() =>
            console.error(
              `[QStash Webhook ${executionId}] Background update failed:`,
              err
            )
          )
        );

      // OPTIMIZATION: Async log
      setImmediate(() =>
        console.log(
          `[QStash Webhook ${executionId}] ❌ Prebooking ${prebookingId} failed in ${totalTime}ms: ${
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
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `[QStash Webhook ${executionId}] Error after ${totalTime}ms:`,
      error
    );

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
