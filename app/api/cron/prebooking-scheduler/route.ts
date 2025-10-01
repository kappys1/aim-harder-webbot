import { NextRequest, NextResponse } from 'next/server';
import { PreBookingScheduler } from '@/modules/prebooking/business/prebooking-scheduler.business';

/**
 * PreBooking Scheduler Cron Endpoint
 *
 * Architecture: Stateless execution (no pre-loading, no setInterval)
 *
 * Called by external cron service (cron-job.org) every 60 seconds
 * Executes prebookings that are ready NOW (available_at <= NOW())
 *
 * Flow:
 * 1. External cron triggers this endpoint
 * 2. Query prebookings ready NOW (not future)
 * 3. Execute FIFO async with 50ms stagger
 * 4. Return results within 10s timeout
 *
 * Key Features:
 * - Per-instance isolation (no shared state)
 * - Timeout guard (8s max execution + 2s buffer)
 * - FIFO ordering with 50ms stagger for speed
 * - Handles concurrent cron calls safely
 */

// Vercel Hobby max duration
export const maxDuration = 10; // seconds

// Prevent caching (always execute fresh)
export const dynamic = 'force-dynamic';

// Timeout configuration
const TIMEOUT_BUFFER = 2000; // 2 seconds safety margin
const MAX_EXECUTION_TIME = (maxDuration * 1000) - TIMEOUT_BUFFER; // 8 seconds

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const instanceId = crypto.randomUUID();

  console.log(`[Cron ${instanceId}] Starting execution at ${new Date().toISOString()}`);

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!expectedAuth || authHeader !== expectedAuth) {
      console.error(`[Cron ${instanceId}] Unauthorized access attempt`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Create new scheduler instance (stateless, no singleton)
    const scheduler = new PreBookingScheduler(instanceId);

    // 3. Execute with timeout guard
    const result = await executeWithTimeoutGuard(
      () => scheduler.execute(),
      MAX_EXECUTION_TIME,
      instanceId
    );

    const executionTime = Date.now() - startTime;

    console.log(`[Cron ${instanceId}] Completed in ${executionTime}ms:`, {
      success: result.success,
      message: result.message,
      details: result.details,
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: {
        ...result.details,
        instanceId,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
      },
    }, { status: result.success ? 200 : 500 });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[Cron ${instanceId}] Error after ${executionTime}ms:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      instanceId,
      executionTimeMs: executionTime,
    }, { status: 500 });
  }
}

/**
 * Execute function with timeout guard
 * If approaching timeout, return partial results
 */
async function executeWithTimeoutGuard<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  instanceId: string
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      const error = new Error(`Execution timeout after ${timeoutMs}ms`);
      console.error(`[Cron ${instanceId}] ${error.message}`);
      reject(error);
    }, timeoutMs);

    try {
      const result = await fn();
      clearTimeout(timeoutHandle);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutHandle);
      reject(error);
    }
  });
}

/**
 * GET endpoint for manual testing and health checks
 * Returns current timestamp and system info
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

    return NextResponse.json({
      message: 'PreBooking Scheduler is healthy',
      config: {
        maxDuration,
        maxExecutionTime: MAX_EXECUTION_TIME,
        timeoutBuffer: TIMEOUT_BUFFER,
      },
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
