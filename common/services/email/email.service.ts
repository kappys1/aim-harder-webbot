import { Resend } from "resend";
import {
  PrebookingFailureData,
  PrebookingSuccessData,
  EmailResult,
} from "./email.types";
import { PrebookingSuccessEmail } from "./templates/prebooking-success";
import { PrebookingFailureEmail } from "./templates/prebooking-failure";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "aimwodbot@alexmarcos.dev";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alexsbd1@gmail.com";

// Lazy instantiation to avoid errors during build
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not set. Please set it in your environment variables."
      );
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Email service for sending prebooking notifications via Resend
 * Non-blocking: errors are logged but don't throw or delay booking
 */
export class EmailService {
  /**
   * Send success notification to user
   * Admin is NOT notified on success
   */
  static async sendPrebookingSuccess(
    data: PrebookingSuccessData
  ): Promise<EmailResult> {
    try {
      const subject = `✅ Reserva confirmada: ${data.classType}`;
      const resend = getResendClient();

      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.userEmail,
        subject,
        react: PrebookingSuccessEmail(data),
      });

      if (result.error) {
        console.error("[EMAIL] Resend API error on success email:", result.error);
        return {
          success: false,
          error: result.error.message || "Unknown Resend error",
        };
      }

      console.log(`[EMAIL] Success notification sent to ${data.userEmail}`, {
        messageId: result.data?.id,
      });

      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error("[EMAIL] Failed to send success notification:", {
        error: error instanceof Error ? error.message : String(error),
        userEmail: data.userEmail,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send failure notification to user and admin
   * Admin email includes detailed technical information for tracing
   */
  static async sendPrebookingFailure(
    data: PrebookingFailureData
  ): Promise<EmailResult> {
    try {
      const subject = `❌ Error en reserva: ${data.classType} - ${data.formattedDateTime}`;
      const resend = getResendClient();

      // Send to both user and admin
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: [data.userEmail, ADMIN_EMAIL],
        subject,
        react: PrebookingFailureEmail(data),
      });

      if (result.error) {
        console.error("[EMAIL] Resend API error on failure email:", result.error);
        return {
          success: false,
          error: result.error.message || "Unknown Resend error",
        };
      }

      console.log(`[EMAIL] Failure notification sent to ${data.userEmail}`, {
        messageId: result.data?.id,
        admin: ADMIN_EMAIL,
      });

      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error("[EMAIL] Failed to send failure notification:", {
        error: error instanceof Error ? error.message : String(error),
        userEmail: data.userEmail,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
