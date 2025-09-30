import { NextRequest, NextResponse } from 'next/server'
import { SupabaseSessionService } from '@/modules/auth/api/services/supabase-session.service'
import { AimharderRefreshService } from '@/modules/auth/api/services/aimharder-refresh.service'

export async function POST(request: NextRequest) {
  try {
    // Verify authorization (using same CRON_SECRET as other cron jobs)
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedToken) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting token refresh cron job...')

    // Get all active sessions
    const sessions = await SupabaseSessionService.getAllActiveSessions()
    console.log(`Found ${sessions.length} active sessions`)

    const results = {
      total: sessions.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each session
    for (const session of sessions) {
      try {
        // Check if session needs update (updated_at > 30 minutes ago)
        const updatedAt = new Date(session.updatedAt || session.createdAt)
        const now = new Date()
        const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60)

        if (minutesSinceUpdate <= 30) {
          console.log(`Skipping ${session.email} - updated ${Math.round(minutesSinceUpdate)} min ago`)
          results.skipped++
          continue
        }

        console.log(`Updating token for ${session.email} - last updated ${Math.round(minutesSinceUpdate)} min ago`)

        // Call Aimharder tokenUpdate
        const updateResult = await AimharderRefreshService.updateToken({
          token: session.token,
          fingerprint: session.fingerprint || process.env.AIMHARDER_FINGERPRINT || 'default-fingerprint',
          cookies: session.cookies
        })

        // Handle logout
        if (updateResult.logout) {
          console.log(`Logout required for ${session.email}, deleting session`)
          await SupabaseSessionService.deleteSession(session.email)
          results.failed++
          results.errors.push(`${session.email}: Session expired`)
          continue
        }

        // Handle error
        if (!updateResult.success || !updateResult.newToken) {
          console.error(`Failed to update token for ${session.email}:`, updateResult.error)
          await SupabaseSessionService.updateRefreshData(session.email, false, updateResult.error)
          results.failed++
          results.errors.push(`${session.email}: ${updateResult.error}`)
          continue
        }

        // Update DB with new token and cookies
        await SupabaseSessionService.updateRefreshToken(session.email, updateResult.newToken)

        if (updateResult.cookies && updateResult.cookies.length > 0) {
          await SupabaseSessionService.updateCookies(session.email, updateResult.cookies)
        }

        // Track successful refresh
        await SupabaseSessionService.updateRefreshData(session.email, true)

        console.log(`Successfully updated token for ${session.email}`)
        results.updated++

      } catch (error) {
        console.error(`Error processing session ${session.email}:`, error)
        results.failed++
        results.errors.push(`${session.email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log('Token refresh cron completed:', results)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}