import { Client } from "@upstash/qstash";
import { generatePrebookingToken } from "./security-token";

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
 * - PREBOOKING_SECRET: Secret for generating security tokens
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
 * HYBRID OPTIMIZATION: Executes 4 SECONDS BEFORE the actual available_at
 * to allow time for preparatory queries, token refresh if needed, then waits until the exact millisecond
 *
 * Flow:
 * 1. QStash triggers webhook 4s before available_at
 * 2. Webhook fetches session & validates prebooking (~250ms)
 * 3. Webhook refreshes token if older than 25 minutes (~500ms if needed)
 * 4. Webhook waits until EXACT executeAt timestamp (~3250ms or ~2750ms if no refresh)
 * 5. Webhook fires to AimHarder API immediately (<100ms latency)
 *
 * @param prebookingId - ID of the prebooking to execute
 * @param executeAt - EXACT Date when the booking should be fired to AimHarder
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

  // HYBRID OPTIMIZATION: Schedule execution 4 SECONDS BEFORE available_at
  // This allows time for:
  // - Fetching session from Supabase (~100-200ms)
  // - Fetching prebooking from Supabase (~100-200ms)
  // - Token refresh if needed (~500ms, only if token > 25min old)
  // - Validations (~5ms)
  // - Waiting until EXACT executeAt timestamp (~3250ms or ~2750ms)
  const earlyExecutionTime = new Date(executeAt.getTime() - 4000);

  // Generate security token (faster than QStash signature verification)
  const securityToken = generatePrebookingToken(prebookingId, executeAt);

  try {
    const executeAtMs = executeAt.getTime();

    const response = await qstashClient.publishJSON({
      url: callbackUrl,
      body: {
        prebookingId,
        boxSubdomain: boxData.subdomain,
        boxAimharderId: boxData.aimharderId,
        executeAt: executeAtMs.toString(), // Send as string to prevent QStash processing
        securityToken, // HMAC token for fast validation
      },
      notBefore: Math.floor(earlyExecutionTime.getTime() / 1000), // Unix timestamp in seconds
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
  try {
    await qstashClient.messages.delete(messageId);
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
