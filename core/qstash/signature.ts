import { Receiver } from "@upstash/qstash";

/**
 * QStash Signature Verification
 *
 * Verifies that incoming webhook requests are actually from QStash
 * and not from malicious actors
 *
 * Environment Variables Required:
 * - QSTASH_CURRENT_SIGNING_KEY: Current signing key from Upstash Console
 * - QSTASH_NEXT_SIGNING_KEY: Next signing key (for key rotation)
 */

if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
  throw new Error(
    "QSTASH_CURRENT_SIGNING_KEY environment variable is required"
  );
}

if (!process.env.QSTASH_NEXT_SIGNING_KEY) {
  throw new Error("QSTASH_NEXT_SIGNING_KEY environment variable is required");
}

export const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

/**
 * Verify QStash signature from webhook request
 *
 * @param signature - Upstash-Signature header value
 * @param body - Raw request body as string
 * @returns true if signature is valid, false otherwise
 */
export async function verifyQStashSignature(
  signature: string,
  body: string
): Promise<boolean> {
  try {
    await qstashReceiver.verify({
      signature,
      body,
    });
    return true;
  } catch (error) {
    console.error("[QStash] Signature verification failed:", error);
    return false;
  }
}
