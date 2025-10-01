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
 * @param prebookingId - ID of the prebooking to execute
 * @param executeAt - Date when to execute the prebooking
 * @returns Message ID from QStash (use this to cancel later)
 */
export async function schedulePrebookingExecution(
  prebookingId: string,
  executeAt: Date
): Promise<string> {
  const callbackUrl = `${getCallbackUrl()}/api/execute-prebooking`;

  console.log("[QStash] Scheduling prebooking:", {
    prebookingId,
    executeAt: executeAt.toISOString(),
    callbackUrl,
  });

  try {
    const response = await qstashClient.publishJSON({
      url: callbackUrl,
      body: { prebookingId },
      notBefore: Math.floor(executeAt.getTime() / 1000), // Unix timestamp in seconds
    });

    console.log("[QStash] Scheduled successfully:", {
      messageId: response.messageId,
      prebookingId,
      executeAt: executeAt.toISOString(),
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
      console.log(
        "[QStash] Message not found (already executed?):",
        messageId
      );
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
