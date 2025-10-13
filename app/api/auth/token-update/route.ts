import { AimharderRefreshService } from "@/modules/auth/api/services/aimharder-refresh.service";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, fingerprint } = body;

    // Validate required fields
    if (!email || !token || !fingerprint) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: email, token, fingerprint",
        },
        { status: 400 }
      );
    }

    // Get current session from DB to get cookies
    const session = await SupabaseSessionService.getSession(email);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No session found for user" },
        { status: 404 }
      );
    }

    // Call Aimharder tokenUpdate API
    const updateResult = await AimharderRefreshService.updateToken({
      token,
      fingerprint,
      cookies: session.cookies,
    });

    // Handle logout response
    if (updateResult.logout) {
      // Delete session from DB
      await SupabaseSessionService.deleteSession(email);

      return NextResponse.json({
        success: false,
        logout: true,
        error: "Session expired",
      });
    }

    // Handle error
    if (!updateResult.success || !updateResult.newToken) {
      console.error("Token update failed for:", email, updateResult.error);

      // Track failed token update
      await SupabaseSessionService.updateTokenUpdateData(
        email,
        false,
        updateResult.error
      );

      return NextResponse.json(
        { success: false, error: updateResult.error || "Token update failed" },
        { status: 500 }
      );
    }

    // Update DB with new token and cookies
    await SupabaseSessionService.updateRefreshToken(
      email,
      updateResult.newToken
    );

    if (updateResult.cookies && updateResult.cookies.length > 0) {
      await SupabaseSessionService.updateCookies(email, updateResult.cookies);
    }

    // Track successful token update
    await SupabaseSessionService.updateTokenUpdateData(email, true);

    return NextResponse.json({
      success: true,
      newToken: updateResult.newToken,
    });
  } catch (error) {
    console.error("Token update endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
