import { NextRequest, NextResponse } from 'next/server'
import { AimharderRefreshService } from '@/modules/auth/api/services/aimharder-refresh.service'
import { SupabaseSessionService } from '@/modules/auth/api/services/supabase-session.service'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Validate input
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Get existing session
    const session = await SupabaseSessionService.getSession(email)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No session found' },
        { status: 404 }
      )
    }

    console.log(`Refresh attempt for email: ${email}`)

    // Attempt refresh
    const refreshResult = await AimharderRefreshService.refreshSession({
      token: session.token,
      cookies: session.cookies
    })

    // Update refresh tracking in database
    await SupabaseSessionService.updateRefreshData(
      email,
      refreshResult.success,
      refreshResult.error
    )

    if (refreshResult.success) {
      console.log(`Refresh successful for email: ${email}`)
      return NextResponse.json({
        success: true,
        refreshed: true,
        lastRefreshDate: new Date().toISOString()
      })
    }

    console.log(`Refresh failed for email: ${email}, error: ${refreshResult.error}`)
    return NextResponse.json(
      {
        success: false,
        error: refreshResult.error || 'Refresh failed'
      },
      { status: 400 }
    )

  } catch (error) {
    console.error('Refresh API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during refresh'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Check if session needs refresh
    const needsRefresh = await SupabaseSessionService.needsRefresh(email)
    const session = await SupabaseSessionService.getSession(email)

    return NextResponse.json({
      success: true,
      needsRefresh,
      token: session?.token, // Add current token for frontend auto-refresh
      lastRefreshDate: session?.lastRefreshDate,
      refreshCount: session?.refreshCount || 0
    })

  } catch (error) {
    console.error('Refresh status API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during refresh status check'
      },
      { status: 500 }
    )
  }
}