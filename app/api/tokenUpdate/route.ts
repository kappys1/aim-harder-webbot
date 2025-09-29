import { NextRequest, NextResponse } from 'next/server'
import { AimharderTokenUpdateService } from '@/modules/auth/api/services/aimharder-token-update.service'
import { SupabaseSessionService } from '@/modules/auth/api/services/supabase-session.service'

export async function POST(request: NextRequest) {
  try {
    const { fingerprint, token } = await request.json()

    // Validate input parameters
    if (!fingerprint || !token) {
      console.error('Token update request missing required parameters:', {
        hasFingerprint: !!fingerprint,
        hasToken: !!token
      })
      return NextResponse.json(
        {
          success: false,
          error: 'fingerprint and token parameters are required'
        },
        { status: 400 }
      )
    }

    console.log('Token update request received:', {
      fingerprint,
      tokenPrefix: token.substring(0, 10) + '...'
    })

    // Find session by token to get the user email
    const activeSessions = await SupabaseSessionService.getAllActiveSessions()
    const session = activeSessions.find(s => s.token === token)

    if (!session) {
      console.error('No active session found for provided token')
      return NextResponse.json(
        {
          success: false,
          error: 'No active session found for provided token'
        },
        { status: 404 }
      )
    }

    console.log(`Processing token update for user: ${session.email}`)

    // Attempt token update
    const updateResult = await AimharderTokenUpdateService.updateToken({
      fingerprint,
      token
    })

    // Update tracking data regardless of success/failure
    await SupabaseSessionService.updateTokenUpdateData(
      session.email,
      updateResult.success,
      updateResult.error
    )

    if (updateResult.success && updateResult.newToken) {
      // Update the session with new token and cookies
      await SupabaseSessionService.updateTokenAndCookies(
        session.email,
        updateResult.newToken,
        updateResult.updatedCookies || []
      )

      console.log(`Token update successful for user: ${session.email}`)
      return NextResponse.json({
        success: true,
        newToken: updateResult.newToken,
        updatedAt: new Date().toISOString()
      })

    } else if (updateResult.logout) {
      // Delete session if logout is required
      await SupabaseSessionService.deleteSession(session.email)

      console.log(`Session logout required for user: ${session.email}`)
      return NextResponse.json({
        logout: 1
      })

    } else {
      console.error(`Token update failed for user ${session.email}:`, updateResult.error)
      return NextResponse.json(
        {
          success: false,
          error: updateResult.error || 'Token update failed'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Token update API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during token update'
      },
      { status: 500 }
    )
  }
}

// GET endpoint for monitoring and statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      // Return token update statistics
      const stats = await SupabaseSessionService.getTokenUpdateStats()
      const sessionStats = await SupabaseSessionService.getSessionStats()

      return NextResponse.json({
        success: true,
        tokenUpdateStats: stats,
        sessionStats,
        timestamp: new Date().toISOString()
      })

    } else if (action === 'bulk-update') {
      // Trigger bulk update for all active sessions (for manual testing)
      console.log('Manual bulk token update triggered')

      const results = await AimharderTokenUpdateService.updateTokenForAllActiveSessions()

      return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString()
      })

    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action parameter. Use ?action=stats or ?action=bulk-update'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Token update GET API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}