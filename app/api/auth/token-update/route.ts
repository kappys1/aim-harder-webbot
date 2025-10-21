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
    // CRITICAL: Pass fingerprint to get the correct device session
    // This will automatically select the device session (not background) when fingerprint is provided
    const session = await SupabaseSessionService.getSession(email, {
      fingerprint
    });

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

    // Handle logout response from AimHarder
    // CRITICAL: When AimHarder returns {logout: 1}, it means THIS specific session is expired
    // We should delete ONLY the specific device session that failed, not all sessions
    if (updateResult.logout) {
      // Delete ONLY this specific device session
      await SupabaseSessionService.deleteSession(email, {
        fingerprint,
        sessionType: "device",
      });

      console.log(
        `[TOKEN UPDATE] Device session expired and deleted for ${email} (fingerprint: ${fingerprint.substring(0, 10)}...)`
      );

      return NextResponse.json({
        success: false,
        logout: true,
        error: "Session expired",
      });
    }

    // Handle error
    if (!updateResult.success || !updateResult.newToken) {
      console.error(
        `Token update failed for ${email} (fingerprint: ${fingerprint.substring(0, 10)}...):`,
        updateResult.error
      );

      // Track failed token update
      // CRITICAL: Pass fingerprint to update the correct device session
      await SupabaseSessionService.updateTokenUpdateData(
        email,
        false,
        updateResult.error,
        fingerprint // Target specific device session
      );

      return NextResponse.json(
        { success: false, error: updateResult.error || "Token update failed" },
        { status: 500 }
      );
    }

    // Update DB with new token and cookies for THIS specific device session
    // CRITICAL: Pass fingerprint to target the correct session
    await SupabaseSessionService.updateRefreshToken(
      email,
      updateResult.newToken,
      fingerprint // Target specific device session
    );

    if (updateResult.cookies && updateResult.cookies.length > 0) {
      await SupabaseSessionService.updateCookies(
        email,
        updateResult.cookies,
        fingerprint // Target specific device session
      );
    }

    // Track successful token update
    // CRITICAL: Pass fingerprint to update the correct device session
    await SupabaseSessionService.updateTokenUpdateData(
      email,
      true,
      undefined,
      fingerprint // Target specific device session
    );

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
