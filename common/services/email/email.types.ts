/**
 * Email service types for Resend integration
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Base data for prebooking emails
 */
export interface PrebookingEmailData {
  userEmail: string;
  classType: string;
  formattedDateTime: string;
  boxName?: string;
}

/**
 * Success email data
 */
export interface PrebookingSuccessData extends PrebookingEmailData {
  bookingId?: string;
  alreadyBookedManually?: boolean;
  /** Timestamp when booking was confirmed (ISO string) */
  confirmedAt: string;
}

/**
 * Failure email data with timing information for traceability
 */
export interface PrebookingFailureData extends PrebookingEmailData {
  /** Error message to display to user */
  errorMessage: string;
  /** Error code from AimHarder or system */
  errorCode?: string;
  /** Execution ID for tracing */
  executionId?: string;
  /** Timestamp when preparation started (ISO string) */
  preparedAt: string;
  /** Timestamp when request was fired to AimHarder (ISO string) */
  firedAt: string;
  /** Timestamp when response was received from AimHarder (ISO string) */
  respondedAt?: string;
  /** Fire latency in milliseconds */
  fireLatency?: number;
  /** All technical details for admin monitoring */
  technicalDetails?: {
    bookState?: string;
    errorMssg?: string;
    errorMssgLang?: string;
    setTimeout_variance?: string;
    responseTime?: number;
  };
}

/**
 * Result of sending an email
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
