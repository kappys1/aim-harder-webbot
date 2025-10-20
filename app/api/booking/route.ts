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
import { BoxService } from "@/modules/boxes/api/services/box.service";
import { BoxAccessService } from "@/modules/boxes/api/services/box-access.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    const day = searchParams.get("day");
    const boxId = searchParams.get("boxId"); // UUID from URL
    const cacheParam = searchParams.get("_");

    if (!day || !boxId) {
      return NextResponse.json(
        { error: "Missing required parameters: day, boxId" },
        { status: 400 }
      );
    }

    // Get user email from the request headers or URL params
    const userEmail =
      request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now

    // Fetch box data directly from Supabase (server-side)
    const box = await BoxService.getBoxById(boxId);

    if (!box) {
      return NextResponse.json(
        { error: "Box not found" },
        { status: 404 }
      );
    }

    // Validate user has access to this box
    const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this box" },
        { status: 403 }
      );
    }

    // Build dynamic URL using box subdomain
    const baseUrl = box.base_url; // e.g., https://crossfitcerdanyola300.aimharder.com
    const targetUrl = new URL("/api/bookings", baseUrl);
    targetUrl.searchParams.set("day", day);
    targetUrl.searchParams.set("box", box.box_id); // Use Aimharder box_id
    if (cacheParam) {
      targetUrl.searchParams.set("_", cacheParam);
    }

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

    // Make the request to the external API with dynamic headers
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        Cookie: cookieString,
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
        host: box.subdomain + ".aimharder.com",
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
    const classTime = body.classTime; // Extract classTime before validation (not part of original external API schema)
    const boxId = body.boxId; // Extract boxId (for prebooking reference)
    const boxSubdomain = body.boxSubdomain; // Extract box subdomain (for dynamic URL)
    const boxAimharderId = body.boxAimharderId; // Extract box aimharder ID (for QStash payload)

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

    // Validate box data for prebookings
    if (!boxId || !boxSubdomain || !boxAimharderId) {
      return NextResponse.json(
        {
          error:
            "Missing required box data (boxId, boxSubdomain, boxAimharderId)",
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
    // Extract activityName and boxName before sending to external API (they're not part of external API schema)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activityName, boxName, ...bookingData } = validatedRequest.data;
    const bookingResponse = await bookingService.createBooking(
      bookingData,
      session.cookies,
      boxSubdomain
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
          // Check if user has reached the prebooking limit (15 for non-admins)
          const isAdmin = session.isAdmin || false;

          if (!isAdmin) {
            const pendingCount = await preBookingService.countPendingByUser(
              userEmail
            );
            const MAX_PREBOOKINGS = 15;

            if (pendingCount >= MAX_PREBOOKINGS) {
              return NextResponse.json(
                {
                  success: false,
                  error: "max_prebookings_reached",
                  message: `Has alcanzado el límite máximo de ${MAX_PREBOOKINGS} pre-reservas pendientes. Cancela o espera a que se te reserven para pre-reservar más.`,
                  bookState: bookingResponse.bookState,
                  currentPrebookings: pendingCount,
                  maxPrebookings: MAX_PREBOOKINGS,
                },
                {
                  status: 400,
                  headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods":
                      "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers":
                      "Content-Type, Authorization",
                  },
                }
              );
            }
          }

          const prebooking = await preBookingService.create({
            userEmail,
            bookingData: validatedRequest.data,
            availableAt: parsed.availableAt,
            boxId,
          });

          // Schedule execution in QStash at exact timestamp
          try {
            const { schedulePrebookingExecution } = await import(
              "@/core/qstash/client"
            );
            const qstashScheduleId = await schedulePrebookingExecution(
              prebooking.id,
              parsed.availableAt,
              {
                subdomain: boxSubdomain,
                aimharderId: boxAimharderId,
              }
            );

            // Save QStash message ID for cancellation
            await preBookingService.updateQStashScheduleId(
              prebooking.id,
              qstashScheduleId
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
    const boxSubdomain = body.boxSubdomain; // Extract box subdomain for dynamic URL

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

    // Validate box subdomain
    if (!boxSubdomain) {
      return NextResponse.json(
        {
          error: "Missing required box data (boxSubdomain)",
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

    // Make cancellation request using the service with box subdomain
    const cancelResponse = await bookingService.cancelBooking(
      validatedRequest.data,
      session.cookies,
      boxSubdomain
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
