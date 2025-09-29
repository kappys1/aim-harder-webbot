import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
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
