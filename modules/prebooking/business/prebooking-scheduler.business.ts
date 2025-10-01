import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { preBookingService } from "../api/services/prebooking.service";
import { PreBooking } from "../models/prebooking.model";

interface ExecutionResult {
  success: boolean;
  message: string;
  details: {
    total: number;
    completed: number;
    failed: number;
    errors?: string[];
  };
}

/**
 * PreBooking Scheduler - Stateless Execution
 *
 * NEW Architecture (No Singleton, No setInterval, No pre-loading)
 *
 * Strategy:
 * 1. Query prebookings ready NOW (available_at <= NOW())
 * 2. Execute FIFO async with 50ms stagger
 * 3. Return results within 10s timeout
 *
 * Key Features:
 * - Stateless (no shared memory between cron calls)
 * - Per-instance isolation (unique instanceId)
 * - FIFO ordering with 50ms stagger for speed
 * - No setInterval waiting
 */
export class PreBookingScheduler {
  private readonly instanceId: string;

  constructor(instanceId?: string) {
    this.instanceId = instanceId || crypto.randomUUID();
    console.log(`[PreBookingScheduler ${this.instanceId}] Initialized`);
  }

  /**
   * Main execution method
   *
   * Flow:
   * 1. Query prebookings ready NOW (not future)
   * 2. Execute FIFO async with 50ms stagger
   * 3. Return results
   */
  async execute(): Promise<ExecutionResult> {
    const startTime = Date.now();
    console.log(`[PreBookingScheduler ${this.instanceId}] Starting execution...`);

    try {
      // 1. Query prebookings ready NOW (no future window)
      const now = new Date();
      const readyPrebookings = await preBookingService.findReadyToExecute(now);

      if (readyPrebookings.length === 0) {
        console.log(`[PreBookingScheduler ${this.instanceId}] No prebookings ready`);
        return {
          success: true,
          message: 'No prebookings ready',
          details: { total: 0, completed: 0, failed: 0 },
        };
      }

      console.log(
        `[PreBookingScheduler ${this.instanceId}] Found ${readyPrebookings.length} ready prebooking(s)`
      );

      // 2. Execute FIFO async with 50ms stagger
      const results = await this.executePrebookingsFIFO(readyPrebookings);

      const executionTime = Date.now() - startTime;
      console.log(
        `[PreBookingScheduler ${this.instanceId}] Execution completed in ${executionTime}ms:`,
        results
      );

      return {
        success: true,
        message: `Processed ${results.total} prebooking(s)`,
        details: results,
      };

    } catch (error) {
      console.error(`[PreBookingScheduler ${this.instanceId}] Error during execution:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { total: 0, completed: 0, failed: 0 },
      };
    }
  }

  /**
   * Execute prebookings in FIFO order with 50ms stagger
   *
   * Strategy:
   * - Launch requests in order with 50ms delay between each
   * - Don't wait for responses (async fire-and-forget)
   * - AimHarder API receives requests in order
   * - AimHarder decides final winner
   *
   * Why 50ms stagger?
   * - Preserves FIFO order at network level
   * - Faster than sequential (10 requests = 500ms vs 5-6s)
   * - Network jitter may still reorder, but we do our best
   */
  private async executePrebookingsFIFO(
    prebookings: PreBooking[]
  ): Promise<{
    total: number;
    completed: number;
    failed: number;
    errors: string[];
  }> {
    console.log(
      `[PreBookingScheduler ${this.instanceId}] Executing ${prebookings.length} prebooking(s) with FIFO async...`
    );

    const results = {
      total: prebookings.length,
      completed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Execute with 50ms stagger to preserve FIFO order
    const promises = prebookings.map((prebooking, index) => {
      return this.delay(index * 50).then(async () => {
        try {
          // Get user session
          const session = await SupabaseSessionService.getSession(
            prebooking.userEmail
          );

          if (!session) {
            await preBookingService.markFailed(
              prebooking.id,
              'Session not found'
            );
            results.failed++;
            results.errors.push(`${prebooking.id}: Session not found`);
            return;
          }

          console.log(
            `[PreBookingScheduler ${this.instanceId}] Executing prebooking ${prebooking.id} for ${prebooking.userEmail}...`
          );

          // Execute booking
          const executionStart = Date.now();
          const bookingResponse = await bookingService.createBooking(
            prebooking.bookingData,
            session.cookies
          );
          const executionTime = Date.now() - executionStart;

          console.log(
            `[PreBookingScheduler ${this.instanceId}] Booking execution took ${executionTime}ms - bookState: ${
              bookingResponse.bookState
            }, bookingId: ${bookingResponse.id || "N/A"}`
          );

          // Check success
          const success = bookingResponse.bookState === 1 || bookingResponse.id;

          if (success) {
            await preBookingService.markCompleted(
              prebooking.id,
              bookingResponse.id
            );
            results.completed++;
            console.log(
              `[PreBookingScheduler ${this.instanceId}] ✅ Prebooking ${prebooking.id} completed successfully`
            );
          } else {
            await preBookingService.markFailed(
              prebooking.id,
              bookingResponse.errorMssg || 'Booking failed'
            );
            results.failed++;
            results.errors.push(
              `${prebooking.id}: ${bookingResponse.errorMssg || 'Booking failed'}`
            );
            console.log(
              `[PreBookingScheduler ${this.instanceId}] ❌ Prebooking ${prebooking.id} failed`
            );
          }

        } catch (error) {
          console.error(
            `[PreBookingScheduler ${this.instanceId}] Error executing prebooking ${prebooking.id}:`,
            error
          );
          await preBookingService.markFailed(
            prebooking.id,
            error instanceof Error ? error.message : 'Execution error'
          );
          results.failed++;
          results.errors.push(
            `${prebooking.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      });
    });

    // Wait for all to complete
    await Promise.allSettled(promises);

    return results;
  }

  /**
   * Delay helper for staggered execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
