import { NextRequest, NextResponse } from 'next/server';
import { preBookingScheduler } from '@/modules/prebooking/business/prebooking-scheduler.business';

/**
 * PreBooking Scheduler Cron Endpoint
 *
 * Called by external cron service (e.g., cron-job.org) every 1 minute
 * Responds immediately (202 Accepted) and processes prebookings in background
 *
 * Flow:
 * 1. External cron triggers this endpoint every minute
 * 2. Endpoint responds immediately (within 30s timeout)
 * 3. Background process queries pending prebookings for next 45-75 seconds
 * 4. Load them into memory with user sessions
 * 5. Use setInterval to check every second
 * 6. Execute bookings in FIFO order when time arrives
 * 7. Results logged to console and DB for monitoring
 *
 * Note: Monitor execution via logs and database records
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization from external cron service
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!expectedAuth || authHeader !== expectedAuth) {
      console.error('[PreBooking Cron] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[PreBooking Cron] Starting scheduler in background...');

    // Execute in background without waiting
    executeSchedulerInBackground().catch(error => {
      console.error('[PreBooking Cron] Background execution error:', error);
    });

    // Respond immediately
    return NextResponse.json(
      {
        success: true,
        message: 'PreBooking scheduler started in background',
        timestamp: new Date().toISOString()
      },
      { status: 202 } // 202 Accepted
    );

  } catch (error) {
    console.error('[PreBooking Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function executeSchedulerInBackground() {
  const startTime = Date.now();

  try {
    console.log('[Background] Starting prebooking scheduler execution...');

    // Execute scheduler (can take several minutes)
    const result = await preBookingScheduler.execute();

    const totalTime = Date.now() - startTime;
    console.log(`[Background] PreBooking scheduler completed in ${totalTime}ms:`, {
      success: result.success,
      message: result.message,
      details: {
        ...result.details,
        totalExecutionTimeMs: totalTime,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Background] PreBooking scheduler failed after ${totalTime}ms:`, error);
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