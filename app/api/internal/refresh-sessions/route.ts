import { NextRequest, NextResponse } from 'next/server'
import { AimharderRefreshService } from '@/modules/auth/api/services/aimharder-refresh.service'
import { SupabaseSessionService } from '@/modules/auth/api/services/supabase-session.service'

export async function POST(request: NextRequest) {
  try {
    // Simple API key check for internal endpoints
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.INTERNAL_API_KEY

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get batch size from request body (default 10)
    const body = await request.json().catch(() => ({}))
    const batchSize = body.batchSize || 10
    const hoursThreshold = body.hoursThreshold || 6

    console.log(`Starting batch refresh - batchSize: ${batchSize}, threshold: ${hoursThreshold}h`)

    // Get sessions that need refresh
    const sessionsToRefresh = await SupabaseSessionService.getSessionsNeedingRefresh(hoursThreshold)

    if (sessionsToRefresh.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions need refresh',
        processed: 0,
        total: 0
      })
    }

    // Process in batches
    const batch = sessionsToRefresh.slice(0, batchSize)
    const results = []

    for (const session of batch) {
      try {
        console.log(`Refreshing session for: ${session.email}`)

        const refreshResult = await AimharderRefreshService.refreshSession({
          token: session.token,
          cookies: session.cookies
        })

        // Update tracking
        await SupabaseSessionService.updateRefreshData(
          session.email,
          refreshResult.success,
          refreshResult.error
        )

        results.push({
          email: session.email,
          success: refreshResult.success,
          error: refreshResult.error
        })

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Refresh error for ${session.email}:`, error)

        await SupabaseSessionService.updateRefreshData(
          session.email,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        )

        results.push({
          email: session.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`Batch refresh completed - Success: ${successful}, Failed: ${failed}`)

    return NextResponse.json({
      success: true,
      processed: results.length,
      total: sessionsToRefresh.length,
      successful,
      failed,
      results
    })

  } catch (error) {
    console.error('Batch refresh API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during batch refresh'
      },
      { status: 500 }
    )
  }
}