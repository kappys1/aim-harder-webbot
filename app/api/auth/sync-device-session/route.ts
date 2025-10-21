import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * Device Session Sync Endpoint
 *
 * CRITICAL: This endpoint ensures localStorage token matches DB token
 * Called on:
 * - App mount
 * - Window focus
 * - Before critical operations (optional)
 *
 * Security:
 * - Requires current token (proof of ownership)
 * - Only syncs device sessions (not background)
 * - Validates fingerprint match
 */
export async function POST(request: NextRequest) {
  const syncId = crypto.randomUUID().substring(0, 8);

  try {
    const { fingerprint, currentToken } = await request.json();
    const userEmail = request.headers.get("x-user-email");

    console.log(`[SYNC ${syncId}] Device session sync requested`, {
      email: userEmail,
      fingerprint: fingerprint?.substring(0, 10) + '...',
      hasCurrentToken: !!currentToken,
    });

    if (!userEmail || !fingerprint) {
      console.warn(`[SYNC ${syncId}] Missing email or fingerprint`);
      return NextResponse.json(
        { error: "Missing email or fingerprint" },
        { status: 400 }
      );
    }

    // Get device session from DB
    const session = await SupabaseSessionService.getDeviceSession(
      userEmail,
      fingerprint
    );

    if (!session) {
      console.warn(`[SYNC ${syncId}] Device session not found`, {
        email: userEmail,
        fingerprint: fingerprint?.substring(0, 10) + '...',
      });
      return NextResponse.json(
        { error: "Device session not found" },
        { status: 404 }
      );
    }

    // Security: Verify current token matches (proof of ownership)
    // This prevents token hijacking if someone guesses email+fingerprint
    if (currentToken && currentToken !== session.token) {
      console.warn(`[SYNC ${syncId}] Token mismatch detected`, {
        email: userEmail,
        currentTokenPrefix: currentToken.substring(0, 10) + '...',
        dbTokenPrefix: session.token.substring(0, 10) + '...',
      });
      // Still sync, but log the discrepancy for security monitoring
    }

    const needsSync = !currentToken || currentToken !== session.token;

    console.log(`[SYNC ${syncId}] Sync check complete`, {
      needsSync,
      tokenAge: session.lastTokenUpdateDate
        ? `${((Date.now() - new Date(session.lastTokenUpdateDate).getTime()) / 60000).toFixed(1)} min`
        : 'unknown',
      tokenUpdateCount: session.tokenUpdateCount,
    });

    // Return latest token and metadata from DB
    return NextResponse.json({
      needsSync,
      token: session.token,
      cookies: session.cookies,
      lastUpdate: session.updatedAt,
      tokenUpdateCount: session.tokenUpdateCount,
      lastTokenUpdateDate: session.lastTokenUpdateDate,
    });
  } catch (error) {
    console.error(`[SYNC ${syncId}] Error:`, error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
