import { NextRequest, NextResponse } from 'next/server';
import { preBookingScheduler } from '@/modules/prebooking/business/prebooking-scheduler.business';

/**
 * PreBooking Scheduler Cron Endpoint
 *
 * Called by GitHub Actions every 1 minute
 * Loads pending prebookings and executes them at precise timestamps
 *
 * Flow:
 * 1. GitHub Actions triggers this endpoint every minute
 * 2. Query pending prebookings for next 45-75 seconds
 * 3. Load them into memory with user sessions
 * 4. Use setInterval to check every second
 * 5. Execute bookings in FIFO order when time arrives
 * 6. Respond when all executions complete
 *
 * Note: This endpoint can take up to 4 minutes to respond
 * GitHub Actions will wait for the response
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization from GitHub Actions
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!expectedAuth || authHeader !== expectedAuth) {
      console.error('[PreBooking Cron] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[PreBooking Cron] Starting scheduler execution...');

    // Execute scheduler (can take several minutes)
    const result = await preBookingScheduler.execute();

    const totalTime = Date.now() - startTime;
    console.log(`[PreBooking Cron] Completed in ${totalTime}ms`);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: {
        ...result.details,
        totalExecutionTimeMs: totalTime,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[PreBooking Cron] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          totalExecutionTimeMs: totalTime,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual testing and monitoring
 * Returns scheduler stats without executing
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!expectedAuth || authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = preBookingScheduler.getStats();

    return NextResponse.json({
      message: 'PreBooking Scheduler Stats',
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}