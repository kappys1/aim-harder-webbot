import { Client } from "@upstash/qstash";

/**
 * QStash Client for scheduling prebooking executions
 *
 * Features:
 * - Schedule messages at exact timestamps (precision <100ms)
 * - Cancel scheduled messages
 * - Paid plan: $0.60 per 1000 messages (~$1.80/month for typical usage)
 *
 * Environment Variables Required:
 * - QSTASH_TOKEN: Your QStash token from Upstash Console
 * - VERCEL_URL or NEXT_PUBLIC_APP_URL: Your app URL for callbacks
 */

if (!process.env.QSTASH_TOKEN) {
  throw new Error("QSTASH_TOKEN environment variable is required");
}

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
});

/**
 * Get the base URL for QStash callbacks
 * Works in both Vercel and local development
 */
export function getCallbackUrl(): string {
  // Production: Use VERCEL_URL (automatically set by Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Manual override or local development
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Fallback for local development
  return "http://localhost:3000";
}

/**
 * Schedule a prebooking execution at a specific timestamp
 *
 * OPTIMIZATION: Executes 500ms BEFORE the actual available_at to compensate
 * for network latency and API response time
 *
 * @param prebookingId - ID of the prebooking to execute
 * @param executeAt - Date when the booking becomes available (will execute 500ms before)
 * @param boxData - Box information needed for executing the booking (subdomain and aimharder ID)
 * @returns Message ID from QStash (use this to cancel later)
 */
export async function schedulePrebookingExecution(
  prebookingId: string,
  executeAt: Date,
  boxData: {
    subdomain: string;
    aimharderId: string;
  }
): Promise<string> {
  const callbackUrl = `${getCallbackUrl()}/api/execute-prebooking`;

  // OPTIMIZATION: Schedule execution 800ms BEFORE available_at
  // This compensates for:
  // - QStash scheduling precision (~100ms)
  // - Network latency (~50-200ms)
  // - API processing time (~100-300ms)
  const earlyExecutionTime = new Date(executeAt.getTime() - 1000);

  console.log("[QStash] Scheduling prebooking:", {
    prebookingId,
    boxSubdomain: boxData.subdomain,
    boxAimharderId: boxData.aimharderId,
    originalAvailableAt: executeAt.toISOString(),
    scheduledExecutionAt: earlyExecutionTime.toISOString(),
    earlyBy: "500ms",
    callbackUrl,
  });

  try {
    const response = await qstashClient.publishJSON({
      url: callbackUrl,
      body: {
        prebookingId,
        boxSubdomain: boxData.subdomain,
        boxAimharderId: boxData.aimharderId,
      },
      notBefore: Math.floor(earlyExecutionTime.getTime() / 1000), // Unix timestamp in seconds
    });

    console.log("[QStash] Scheduled successfully:", {
      messageId: response.messageId,
      prebookingId,
      boxSubdomain: boxData.subdomain,
      originalAvailableAt: executeAt.toISOString(),
      willExecuteAt: earlyExecutionTime.toISOString(),
    });

    return response.messageId;
  } catch (error) {
    console.error("[QStash] Error scheduling prebooking:", error);
    throw new Error(
      `Failed to schedule prebooking in QStash: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Cancel a scheduled prebooking execution
 *
 * @param messageId - QStash message ID returned from schedulePrebookingExecution
 */
export async function cancelScheduledExecution(
  messageId: string
): Promise<void> {
  console.log("[QStash] Canceling scheduled message:", messageId);

  try {
    await qstashClient.messages.delete(messageId);
    console.log("[QStash] Message canceled successfully:", messageId);
  } catch (error) {
    // If message already executed or doesn't exist, that's ok
    if (error instanceof Error && error.message.includes("not found")) {
      console.log("[QStash] Message not found (already executed?):", messageId);
      return;
    }
    console.error("[QStash] Error canceling message:", error);
    throw new Error(
      `Failed to cancel QStash message: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
