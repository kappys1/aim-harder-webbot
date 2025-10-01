import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import {
  BookingCancelRequestSchema,
  BookingCreateRequestSchema,
} from "@/modules/booking/api/models/booking.api";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { BOOKING_CONSTANTS } from "@/modules/booking/constants/booking.constants";
import { preBookingService } from "@/modules/prebooking/api/services/prebooking.service";
import { parseEarlyBookingError } from "@/modules/prebooking/utils/error-parser.utils";
import { NextRequest, NextResponse } from "next/server";

const BOOKING_API_BASE_URL = "https://crossfitcerdanyola300.aimharder.com";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    const day = searchParams.get("day");
    const box = searchParams.get("box");
    const cacheParam = searchParams.get("_");

    if (!day || !box) {
      return NextResponse.json(
        { error: "Missing required parameters: day, box" },
        { status: 400 }
      );
    }

    // Build the target URL
    const targetUrl = new URL("/api/bookings", BOOKING_API_BASE_URL);
    targetUrl.searchParams.set("day", day);
    targetUrl.searchParams.set("box", box);
    if (cacheParam) {
      targetUrl.searchParams.set("_", cacheParam);
    }

    // Get user email from the request headers or URL params
    const userEmail =
      request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now

    // Get real cookies from Supabase
    const session = await SupabaseSessionService.getSession(userEmail);

    if (!session) {
      return NextResponse.json(
        { error: "User session not found. Please login first." },
        { status: 401 }
      );
    }

    // Format cookies for the external API
    const cookieString = session.cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    // Make the request to the external API
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        Cookie: cookieString,
        Referer: "https://crossfitcerdanyola300.aimharder.com/",
        Origin: "https://crossfitcerdanyola300.aimharder.com",
        host: "crossfitcerdanyola300.aimharder.com",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `API request failed: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the data with proper CORS headers
    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Booking API proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const classTime = body.classTime; // Extract classTime before validation (not part of schema)
    const validatedRequest = BookingCreateRequestSchema.safeParse(body);

    if (!validatedRequest.success) {
      return NextResponse.json(
        {
          error: "Invalid request parameters",
          details: validatedRequest.error.issues,
        },
        { status: 400 }
      );
    }

    // Get user email from headers
    const userEmail =
      request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now

    // Get user session with cookies
    const session = await SupabaseSessionService.getSession(userEmail);

    if (!session) {
      return NextResponse.json(
        { error: "User session not found. Please login first." },
        { status: 401 }
      );
    }

    // Make booking request using the service
    const bookingResponse = await bookingService.createBooking(
      validatedRequest.data,
      session.cookies
    );

    // Check booking state and handle accordingly
    if (bookingResponse.bookState === BOOKING_CONSTANTS.BOOKING_STATES.BOOKED) {
      // Success - booking was created
      return NextResponse.json(
        {
          success: true,
          bookingId: bookingResponse.id,
          message: "Booking created successfully",
          bookState: bookingResponse.bookState,
          clasesContratadas: bookingResponse.clasesContratadas,
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    } else if (
      bookingResponse.bookState ===
      BOOKING_CONSTANTS.BOOKING_STATES.ERROR_EARLY_BOOKING
    ) {
      // Early booking error - user tried to book too early
      // Automatically create a prebooking
      try {
        const parsed = parseEarlyBookingError(
          bookingResponse.errorMssg,
          validatedRequest.data.day,
          classTime // Pass classTime from request body
        );

        if (parsed) {
          const prebooking = await preBookingService.create({
            userEmail,
            bookingData: validatedRequest.data,
            availableAt: parsed.availableAt,
          });

          // Schedule execution in QStash at exact timestamp
          try {
            const { schedulePrebookingExecution } = await import("@/core/qstash/client");
            const qstashScheduleId = await schedulePrebookingExecution(
              prebooking.id,
              parsed.availableAt
            );

            // Save QStash message ID for cancellation
            await preBookingService.updateQStashScheduleId(
              prebooking.id,
              qstashScheduleId
            );

            console.log(
              `[Booking API] Created prebooking ${
                prebooking.id
              } for ${userEmail} - scheduled in QStash (${qstashScheduleId}) at ${parsed.availableAt.toISOString()} (class time: ${
                classTime || "not provided"
              })`
            );
          } catch (qstashError) {
            // If QStash fails, log error but don't fail the whole request
            // The prebooking is created, just not scheduled
            console.error(
              `[Booking API] Failed to schedule in QStash for prebooking ${prebooking.id}:`,
              qstashError
            );
          }

          return NextResponse.json(
            {
              success: false,
              error: "early_booking",
              message:
                bookingResponse.errorMssg || "Cannot book this class yet",
              errorCode: bookingResponse.errorMssgLang,
              bookState: bookingResponse.bookState,
              clasesContratadas: bookingResponse.clasesContratadas,
              prebooking: {
                id: prebooking.id,
                availableAt: prebooking.availableAt.toISOString(),
                status: prebooking.status,
              },
            },
            {
              status: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods":
                  "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            }
          );
        }
      } catch (error) {
        console.error("[Booking API] Error creating prebooking:", error);
        // Continue with normal error response if prebooking creation fails
      }

      // Fallback if prebooking creation failed
      return NextResponse.json(
        {
          success: false,
          error: "early_booking",
          message: bookingResponse.errorMssg || "Cannot book this class yet",
          errorCode: bookingResponse.errorMssgLang,
          bookState: bookingResponse.bookState,
          clasesContratadas: bookingResponse.clasesContratadas,
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    } else if (
      bookingResponse.bookState ===
      BOOKING_CONSTANTS.BOOKING_STATES.ERROR_MAX_BOOKINGS
    ) {
      // Max bookings reached error
      return NextResponse.json(
        {
          success: false,
          error: "max_bookings_reached",
          message: `You have reached the maximum number of bookings allowed (${bookingResponse.max})`,
          bookState: bookingResponse.bookState,
          maxBookings: bookingResponse.max,
          clasesContratadas: bookingResponse.clasesContratadas,
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    } else {
      // Other booking error
      return NextResponse.json(
        {
          success: false,
          error: "booking_failed",
          message: bookingResponse.errorMssg || "Booking failed",
          errorCode: bookingResponse.errorMssgLang,
          bookState: bookingResponse.bookState,
          clasesContratadas: bookingResponse.clasesContratadas,
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }
  } catch (error) {
    console.error("Booking creation error:", error);

    // Handle specific booking service errors
    if (
      error &&
      typeof error === "object" &&
      "isAuthenticationError" in error
    ) {
      const bookingError = error as { isAuthenticationError: boolean };
      if (bookingError.isAuthenticationError) {
        return NextResponse.json(
          { error: "Authentication failed. Please login again." },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = BookingCancelRequestSchema.safeParse(body);

    if (!validatedRequest.success) {
      return NextResponse.json(
        {
          error: "Invalid request parameters",
          details: validatedRequest.error.issues,
        },
        { status: 400 }
      );
    }

    // Get user email from headers
    const userEmail =
      request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now

    // Get user session with cookies
    const session = await SupabaseSessionService.getSession(userEmail);

    if (!session) {
      return NextResponse.json(
        { error: "User session not found. Please login first." },
        { status: 401 }
      );
    }

    // Make cancellation request using the service
    const cancelResponse = await bookingService.cancelBooking(
      validatedRequest.data,
      session.cookies
    );

    // Check cancellation state and handle accordingly
    if (
      cancelResponse.cancelState === BOOKING_CONSTANTS.BOOKING_STATES.CANCELLED
    ) {
      // Success - booking was cancelled
      return NextResponse.json(
        {
          success: true,
          message: "Booking cancelled successfully",
          cancelState: cancelResponse.cancelState,
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    } else {
      // Error - cancellation failed
      return NextResponse.json(
        {
          success: false,
          error: "cancellation_failed",
          message: "Cancellation failed",
          cancelState: cancelResponse.cancelState,
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }
  } catch (error) {
    console.error("Booking cancellation error:", error);

    // Handle specific booking service errors
    if (
      error &&
      typeof error === "object" &&
      "isAuthenticationError" in error
    ) {
      const bookingError = error as { isAuthenticationError: boolean };
      if (bookingError.isAuthenticationError) {
        return NextResponse.json(
          { error: "Authentication failed. Please login again." },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
