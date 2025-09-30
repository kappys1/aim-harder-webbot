import { AuthCookie } from "@/modules/auth/api/services/cookie.service";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { preBookingService } from "../api/services/prebooking.service";
import { PreBooking } from "../models/prebooking.model";

interface LoadedPreBooking {
  prebooking: PreBooking;
  cookies: AuthCookie[];
}

/**
 * PreBooking Scheduler - Singleton
 *
 * Manages in-memory loaded prebookings and executes them at precise timestamps.
 * Designed to work with GitHub Actions calling every 1 minute.
 */
export class PreBookingScheduler {
  private static instance: PreBookingScheduler;

  // Map of timestamp -> array of loaded prebookings (sorted by created_at for FIFO)
  private loadedBookings: Map<number, LoadedPreBooking[]> = new Map();

  // Map of timestamp -> interval ID
  private activeIntervals: Map<number, NodeJS.Timeout> = new Map();

  // Safety timeout: 4 minutes max execution time
  private readonly MAX_EXECUTION_TIME = 4 * 60 * 1000;

  private constructor() {
    console.log("[PreBookingScheduler] Initialized");
  }

  static getInstance(): PreBookingScheduler {
    if (!PreBookingScheduler.instance) {
      PreBookingScheduler.instance = new PreBookingScheduler();
    }
    return PreBookingScheduler.instance;
  }

  /**
   * Main execution method called by GitHub Actions cron every minute
   *
   * 1. Queries pending prebookings for next minute
   * 2. Loads them into memory with user sessions
   * 3. Creates setInterval to check every second
   * 4. Executes prebookings in FIFO order when time comes
   * 5. Cleans up intervals when done
   */
  async execute(): Promise<{
    success: boolean;
    message: string;
    details: any;
  }> {
    const startTime = Date.now();
    console.log("[PreBookingScheduler] Starting execution...");

    try {
      // 1. Query prebookings that will become available in next 45-75 seconds
      const now = new Date();
      const startRange = new Date(now.getTime() + 45 * 1000); // Now + 45s
      const endRange = new Date(now.getTime() + 75 * 1000); // Now + 75s

      console.log(
        `[PreBookingScheduler] Querying prebookings between ${startRange.toISOString()} and ${endRange.toISOString()}`
      );

      const pendingPrebookings = await preBookingService.findPendingInTimeRange(
        startRange,
        endRange
      );

      if (pendingPrebookings.length === 0) {
        console.log("[PreBookingScheduler] No pending prebookings found");
        return {
          success: true,
          message: "No pending prebookings",
          details: { count: 0 },
        };
      }

      console.log(
        `[PreBookingScheduler] Found ${pendingPrebookings.length} pending prebooking(s)`
      );

      // 2. Load prebookings into memory
      await this.loadPrebookingsIntoMemory(pendingPrebookings);

      // 3. Wait for execution time using setInterval
      await this.waitAndExecute(startTime);

      return {
        success: true,
        message: `Processed ${pendingPrebookings.length} prebooking(s)`,
        details: {
          count: pendingPrebookings.length,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error("[PreBookingScheduler] Error during execution:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        details: { error },
      };
    }
  }

  /**
   * Loads prebookings into memory with user sessions
   * Groups by timestamp and marks as 'loaded'
   */
  private async loadPrebookingsIntoMemory(
    prebookings: PreBooking[]
  ): Promise<void> {
    console.log(
      `[PreBookingScheduler] Loading ${prebookings.length} prebooking(s) into memory...`
    );

    for (const prebooking of prebookings) {
      try {
        // Atomically claim the prebooking (prevents race conditions)
        const claimed = await preBookingService.claimPrebooking(prebooking.id);

        if (!claimed) {
          console.log(
            `[PreBookingScheduler] Prebooking ${prebooking.id} already claimed by another process, skipping`
          );
          continue;
        }

        // Get user session with cookies
        const session = await SupabaseSessionService.getSession(
          prebooking.userEmail
        );

        if (!session) {
          console.error(
            `[PreBookingScheduler] No session found for user ${prebooking.userEmail}`
          );
          await preBookingService.updateStatus({
            id: prebooking.id,
            status: "failed",
            errorMessage: "User session not found",
            executedAt: new Date(),
          });
          continue;
        }

        // Group by timestamp
        const timestamp = prebooking.availableAt.getTime();
        if (!this.loadedBookings.has(timestamp)) {
          this.loadedBookings.set(timestamp, []);
        }

        this.loadedBookings.get(timestamp)!.push({
          prebooking,
          cookies: session.cookies,
        });

        console.log(
          `[PreBookingScheduler] Loaded prebooking ${prebooking.id} for ${prebooking.userEmail}`
        );
      } catch (error) {
        console.error(
          `[PreBookingScheduler] Error loading prebooking ${prebooking.id}:`,
          error
        );
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Loading error",
          executedAt: new Date(),
        });
      }
    }

    console.log(
      `[PreBookingScheduler] Loaded bookings grouped by timestamp: ${this.loadedBookings.size} group(s)`
    );
  }

  /**
   * Wait until execution time and execute prebookings
   * Uses setInterval to check every second
   */
  private async waitAndExecute(startTime: number): Promise<void> {
    if (this.loadedBookings.size === 0) {
      console.log("[PreBookingScheduler] No bookings to execute");
      return;
    }

    console.log(
      "[PreBookingScheduler] Starting interval to wait for execution time..."
    );

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const now = Date.now();
        const elapsed = now - startTime;

        // Safety timeout check
        if (elapsed > this.MAX_EXECUTION_TIME) {
          console.error(
            "[PreBookingScheduler] Max execution time exceeded, stopping"
          );
          clearInterval(checkInterval);
          reject(new Error("Max execution time exceeded"));
          return;
        }

        // Check each timestamp
        const timestampsToExecute: number[] = [];
        for (const timestamp of this.loadedBookings.keys()) {
          if (now >= timestamp) {
            timestampsToExecute.push(timestamp);
          } else {
            const secondsUntil = Math.floor((timestamp - now) / 1000);
            console.log(
              `[PreBookingScheduler] Waiting ${secondsUntil}s until next execution...`
            );
          }
        }

        // Execute bookings for timestamps that have arrived
        for (const timestamp of timestampsToExecute) {
          const bookings = this.loadedBookings.get(timestamp)!;
          console.log(
            `[PreBookingScheduler] Executing ${
              bookings.length
            } booking(s) at timestamp ${new Date(timestamp).toISOString()}`
          );

          await this.executePrebookingsFIFO(bookings);
          this.loadedBookings.delete(timestamp);
        }

        // If all done, clean up and resolve
        if (this.loadedBookings.size === 0) {
          console.log(
            "[PreBookingScheduler] All prebookings executed, stopping interval"
          );
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000); // Check every 1 second

      // Store interval for cleanup
      this.activeIntervals.set(startTime, checkInterval);
    });
  }

  /**
   * Execute prebookings in FIFO order (by created_at)
   */
  private async executePrebookingsFIFO(
    loadedBookings: LoadedPreBooking[]
  ): Promise<void> {
    // Already sorted by created_at ASC from DB query
    for (const { prebooking, cookies } of loadedBookings) {
      await this.executeOne(prebooking, cookies);
    }
  }

  /**
   * Execute a single prebooking
   */
  private async executeOne(
    prebooking: PreBooking,
    cookies: AuthCookie[]
  ): Promise<void> {
    console.log(
      `[PreBookingScheduler] Executing prebooking ${prebooking.id} for ${prebooking.userEmail}...`
    );

    try {
      // Update status to executing
      preBookingService.updateStatus({
        id: prebooking.id,
        status: "executing",
      });

      // Execute the booking
      const executionStart = Date.now();
      const bookingResponse = await bookingService.createBooking(
        prebooking.bookingData,
        cookies
      );
      const executionTime = Date.now() - executionStart;

      console.log(
        `[PreBookingScheduler] Booking execution took ${executionTime}ms - bookState: ${bookingResponse.bookState}, bookingId: ${bookingResponse.id || 'N/A'}`
      );

      // Update with result
      // Success if bookState is 1 OR if booking ID exists (booking was created despite error)
      const bookingCreated = bookingResponse.bookState === 1 || (bookingResponse.id && bookingResponse.id > 0);

      if (bookingCreated) {
        // Success - booking was created
        const isWarning = bookingResponse.bookState !== 1;
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: "completed",
          executedAt: new Date(),
          result: {
            success: true,
            bookingId: bookingResponse.id,
            bookState: bookingResponse.bookState,
            message: isWarning
              ? `Booking created with warning (bookState ${bookingResponse.bookState}): ${bookingResponse.errorMssg || 'Unknown warning'}`
              : "Booking created successfully",
            executedAt: new Date(),
          },
        });
        console.log(
          `[PreBookingScheduler] ✅ Prebooking ${prebooking.id} completed successfully${isWarning ? ` (bookState ${bookingResponse.bookState} but booking ID ${bookingResponse.id} exists)` : ''}`
        );
      } else {
        // Failed - no booking ID returned
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: "failed",
          executedAt: new Date(),
          result: {
            success: false,
            bookState: bookingResponse.bookState,
            message: bookingResponse.errorMssg || "Booking failed",
            executedAt: new Date(),
          },
          errorMessage: bookingResponse.errorMssg,
        });
        console.log(
          `[PreBookingScheduler] ❌ Prebooking ${prebooking.id} failed - bookState: ${bookingResponse.bookState}, no booking ID returned`
        );
      }
    } catch (error) {
      console.error(
        `[PreBookingScheduler] Error executing prebooking ${prebooking.id}:`,
        error
      );
      await preBookingService.updateStatus({
        id: prebooking.id,
        status: "failed",
        executedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Execution error",
      });
    }
  }

  /**
   * Get scheduler stats for monitoring
   */
  getStats() {
    return {
      loadedBookingsCount: Array.from(this.loadedBookings.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      activeIntervalsCount: this.activeIntervals.size,
      timestamps: Array.from(this.loadedBookings.keys()).map((ts) =>
        new Date(ts).toISOString()
      ),
    };
  }
}

// Export singleton instance
export const preBookingScheduler = PreBookingScheduler.getInstance();
