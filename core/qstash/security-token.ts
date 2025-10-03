import crypto from "crypto";

/**
 * Security Token Generator for Fast Prebooking Execution
 *
 * Generates HMAC-SHA256 tokens for validating prebooking execution requests.
 * This is faster than QStash signature verification (~1-2ms vs ~50-100ms).
 *
 * Security:
 * - Uses HMAC-SHA256 with secret key
 * - Token tied to specific prebookingId + executeAt timestamp
 * - Cannot be reused for different prebookings or times
 */

if (!process.env.PREBOOKING_SECRET) {
  throw new Error("PREBOOKING_SECRET environment variable is required");
}

const SECRET = process.env.PREBOOKING_SECRET;

/**
 * Generate security token for prebooking execution
 *
 * @param prebookingId - ID of the prebooking
 * @param executeAt - Exact execution timestamp (Date or milliseconds)
 * @returns HMAC-SHA256 hex token
 */
export function generatePrebookingToken(
  prebookingId: string,
  executeAt: Date | number
): string {
  const timestamp = typeof executeAt === "number" ? executeAt : executeAt.getTime();
  const message = `${prebookingId}:${timestamp}`;

  return crypto.createHmac("sha256", SECRET).update(message).digest("hex");
}

/**
 * Verify security token for prebooking execution
 *
 * @param token - Token to verify
 * @param prebookingId - ID of the prebooking
 * @param executeAt - Exact execution timestamp (Date or milliseconds)
 * @returns true if token is valid
 */
export function verifyPrebookingToken(
  token: string,
  prebookingId: string,
  executeAt: Date | number
): boolean {
  const expectedToken = generatePrebookingToken(prebookingId, executeAt);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken, "hex")
    );
  } catch {
    // Tokens of different lengths will throw, just return false
    return false;
  }
}
