import { preBookingService } from "@/modules/prebooking/api/services/prebooking.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/prebooking
 * List prebookings for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail =
      searchParams.get("user_email") || request.headers.get("x-user-email");

    if (!userEmail) {
      return NextResponse.json(
        { error: "Missing user_email parameter" },
        { status: 400 }
      );
    }

    const prebookings = await preBookingService.findByUser(userEmail);

    return NextResponse.json({
      success: true,
      prebookings: prebookings.map((pb) => ({
        id: pb.id,
        bookingData: pb.bookingData,
        availableAt: pb.availableAt.toISOString(),
        status: pb.status,
        result: pb.result,
        errorMessage: pb.errorMessage,
        createdAt: pb.createdAt.toISOString(),
        executedAt: pb.executedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.log(error);
    console.error("[PreBooking API] Error fetching prebookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prebooking?id=xxx
 * Cancel a prebooking
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    // Verify prebooking exists and belongs to user
    const prebooking = await preBookingService.findById(id);

    if (!prebooking) {
      return NextResponse.json(
        { error: "Prebooking not found" },
        { status: 404 }
      );
    }

    // Only allow canceling pending or loaded prebookings
    if (prebooking.status !== "pending" && prebooking.status !== "loaded") {
      return NextResponse.json(
        { error: `Cannot cancel prebooking with status: ${prebooking.status}` },
        { status: 400 }
      );
    }

    await preBookingService.delete(id);

    return NextResponse.json({
      success: true,
      message: "Prebooking canceled successfully",
    });
  } catch (error) {
    console.error("[PreBooking API] Error deleting prebooking:", error);
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
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
