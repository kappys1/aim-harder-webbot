import { BaseApiService, ApiError } from "@/common/utils/base-api.service";
import {
  AuthCookie,
  CookieService,
} from "../../../auth/api/services/cookie.service";
import { BOOKING_CONSTANTS } from "../../constants/booking.constants";
import {
  BookingCancelRequest,
  BookingCancelResponse,
  BookingCancelResponseSchema,
  BookingCreateRequest,
  BookingCreateResponse,
  BookingCreateResponseSchema,
  BookingRequestParams,
  BookingResponseApi,
  BookingResponseApiSchema,
} from "../models/booking.api";

export interface BookingServiceConfig {
  baseUrl?: string;
  timeout?: number;
}

export class BookingService extends BaseApiService {
  constructor(config: BookingServiceConfig = {}) {
    super({
      baseUrl: config.baseUrl || BOOKING_CONSTANTS.API.BASE_URL,
      // OPTIMIZATION: Reduced from 30s to 8s for faster failure detection
      timeout: config.timeout || 8000,
    });
  }

  async getBookings(
    params: BookingRequestParams,
    cookies?: AuthCookie[] // DEPRECATED: No longer used, kept for backward compatibility
  ): Promise<BookingResponseApi> {
    // CRITICAL FIX: Call our API route instead of direct AimHarder call
    // This ensures we always use fresh tokens from DB (device session)
    // and fixes the "can't see attendees" issue caused by stale browser cookies

    // Build URL to our API route
    const apiUrl = `/api/booking?day=${params.day}&boxId=${params.boxId}&_=${params._}`;

    // Add user email from localStorage
    if (typeof window !== "undefined") {
      const userEmail = localStorage.getItem("user-email");
      if (userEmail) {
        this.addHeaders({ "x-user-email": userEmail });
      }
    }

    try {
      const data = await this.get<any>(apiUrl);

      const validatedData = BookingResponseApiSchema.safeParse(data);
      if (!validatedData.success) {
        // LOG: Detailed validation error for getBookings
        console.error('[BOOKING_API] Validation failed for getBookings:', JSON.stringify({
          zodError: validatedData.error.issues,
          rawResponse: data,
          requestParams: params,
          url: apiUrl,
        }, null, 2));
        throw new BookingApiError(
          "Invalid API response format",
          400,
          "VALIDATION_ERROR",
          {
            zodIssues: validatedData.error.issues,
            rawResponse: data,
            requestParams: params,
          }
        );
      }

      return validatedData.data;
    } catch (error) {
      if (error instanceof BookingApiError) {
        throw error;
      }

      if (error instanceof ApiError) {
        throw new BookingApiError(
          error.message,
          error.status || 500,
          error.code as any || "UNKNOWN_ERROR",
          error.originalError
        );
      }

      throw new BookingApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500,
        "UNKNOWN_ERROR"
      );
    }
  }

  async createBooking(
    request: BookingCreateRequest,
    cookies?: AuthCookie[],
    boxSubdomain?: string
  ): Promise<BookingCreateResponse> {
    if (!boxSubdomain) {
      throw new BookingApiError(
        "Box subdomain is required for booking creation",
        400,
        "VALIDATION_ERROR"
      );
    }

    const baseUrl = `https://${boxSubdomain}.aimharder.com`;
    const url = `${baseUrl}${BOOKING_CONSTANTS.API.ENDPOINTS.CREATE_BOOKING}`;

    const headers: Record<string, string> = {
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      Referer: `${baseUrl}/`,
      Origin: baseUrl,
    };

    if (cookies && cookies.length > 0) {
      headers["Cookie"] = CookieService.formatForRequest(cookies);
    }

    // Format request body as URL-encoded form data
    const formData = new URLSearchParams();
    formData.append("day", request.day);
    formData.append("familyId", request.familyId);
    formData.append("id", request.id);
    formData.append("insist", request.insist.toString());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new BookingApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          "HTTP_ERROR"
        );
      }

      const data = await response.json();

      // LOG: Capture raw response for debugging (using console.error to ensure visibility in production)
      console.error('[BOOKING_API] Raw createBooking response:', JSON.stringify({
        url,
        statusCode: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: data,
        dataType: Array.isArray(data) ? 'array' : typeof data,
      }, null, 2));

      // CRITICAL FIX: Handle different response formats from AimHarder
      // Sometimes AimHarder returns:
      // 1. { bookState: 1, id: "123", ... } - Normal success/error response (expected)
      // 2. [] - Empty array (HTTP 200 with empty body = success, no additional data)
      // 3. {} - Empty object (less common)
      // 4. null/undefined - Unexpected but possible with some API changes

      let normalizedData = data;

      // If response is an empty array, treat as success (successful booking with no extra data)
      if (Array.isArray(data) && data.length === 0) {
        console.warn('[BOOKING_API] Received empty array response, treating as successful booking');
        normalizedData = {
          bookState: 1, // bookState: 1 = success/booked
          id: "", // No ID returned from AimHarder
          clasesContratadas: "",
        };
      } else if (data === null || data === undefined) {
        console.warn('[BOOKING_API] Received null/undefined response, treating as successful booking');
        normalizedData = {
          bookState: 1,
          id: "",
          clasesContratadas: "",
        };
      } else if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) {
        // Empty object response
        console.warn('[BOOKING_API] Received empty object response, treating as successful booking');
        normalizedData = {
          bookState: 1,
          id: "",
          clasesContratadas: "",
        };
      }

      // CRITICAL: Detect session expiration BEFORE validation
      // Aimharder returns { logout: 1 } when token/session is expired
      if (normalizedData && typeof normalizedData === 'object' && normalizedData.logout === 1) {
        console.error('[BOOKING_API] Session expired (logout: 1):', JSON.stringify({
          url,
          statusCode: response.status,
          rawResponse: normalizedData,
          requestBody: {
            day: request.day,
            familyId: request.familyId,
            id: request.id,
            insist: request.insist,
          },
        }, null, 2));

        throw new BookingApiError(
          "Session expired - authentication required",
          401,
          "AUTH_ERROR",
          {
            rawResponse: normalizedData,
            requestBody: {
              day: request.day,
              familyId: request.familyId,
              id: request.id,
              insist: request.insist,
            },
          }
        );
      }

      const validatedData = BookingCreateResponseSchema.safeParse(normalizedData);

      if (!validatedData.success) {
        // LOG: Detailed validation error with raw response (stringified for production visibility)
        console.error('[BOOKING_API] Validation failed for createBooking:', JSON.stringify({
          zodError: validatedData.error.issues,
          rawResponse: data,
          requestBody: {
            day: request.day,
            familyId: request.familyId,
            id: request.id,
            insist: request.insist,
          },
          url,
        }, null, 2));
        throw new BookingApiError(
          "Invalid booking response format",
          400,
          "VALIDATION_ERROR",
          {
            zodIssues: validatedData.error.issues,
            rawResponse: data,
            requestBody: {
              day: request.day,
              familyId: request.familyId,
              id: request.id,
              insist: request.insist,
            },
          }
        );
      }

      return validatedData.data;
    } catch (error) {
      if (error instanceof BookingApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new BookingApiError("Request timeout", 408, "TIMEOUT_ERROR");
      }

      if (error instanceof TypeError) {
        throw new BookingApiError(
          "Network error - please check your connection",
          0,
          "NETWORK_ERROR"
        );
      }

      throw new BookingApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500,
        "UNKNOWN_ERROR"
      );
    }
  }

  async cancelBooking(
    request: BookingCancelRequest,
    cookies?: AuthCookie[],
    boxSubdomain?: string
  ): Promise<BookingCancelResponse> {
    if (!boxSubdomain) {
      throw new BookingApiError(
        "Box subdomain is required for booking cancellation",
        400,
        "VALIDATION_ERROR"
      );
    }

    const baseUrl = `https://${boxSubdomain}.aimharder.com`;
    const url = `${baseUrl}${BOOKING_CONSTANTS.API.ENDPOINTS.CANCEL_BOOKING}`;

    const headers: Record<string, string> = {
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      Referer: `${baseUrl}/`,
      Origin: baseUrl,
    };

    if (cookies && cookies.length > 0) {
      headers["Cookie"] = CookieService.formatForRequest(cookies);
    }

    // Format request body as URL-encoded form data
    const formData = new URLSearchParams();
    formData.append("id", request.id);
    formData.append("late", request.late.toString());
    formData.append("familyId", request.familyId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new BookingApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          "HTTP_ERROR"
        );
      }

      const data = await response.json();

      // LOG: Capture raw response for debugging
      console.error('[BOOKING_API] Raw cancelBooking response:', JSON.stringify({
        url,
        statusCode: response.status,
        statusText: response.statusText,
        body: data,
        dataType: Array.isArray(data) ? 'array' : typeof data,
      }, null, 2));

      // CRITICAL FIX: Handle different response formats from AimHarder
      // Similar to createBooking, sometimes AimHarder returns:
      // 1. { cancelState: 1, ... } - Normal response (expected)
      // 2. [] - Empty array (HTTP 200 with empty body = success)
      // 3. {} - Empty object
      // 4. null/undefined - Unexpected but possible

      let normalizedData = data;

      // If response is an empty array, treat as success (successful cancellation)
      if (Array.isArray(data) && data.length === 0) {
        console.warn('[BOOKING_API] Received empty array response for cancel, treating as successful cancellation');
        normalizedData = {
          cancelState: 1, // cancelState: 1 = success/cancelled
        };
      } else if (data === null || data === undefined) {
        console.warn('[BOOKING_API] Received null/undefined response for cancel, treating as successful cancellation');
        normalizedData = {
          cancelState: 1,
        };
      } else if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) {
        // Empty object response
        console.warn('[BOOKING_API] Received empty object response for cancel, treating as successful cancellation');
        normalizedData = {
          cancelState: 1,
        };
      }

      const validatedData = BookingCancelResponseSchema.safeParse(normalizedData);
      if (!validatedData.success) {
        // LOG: Detailed validation error for cancelBooking (stringified for production visibility)
        console.error('[BOOKING_API] Validation failed for cancelBooking:', JSON.stringify({
          zodError: validatedData.error.issues,
          rawResponse: normalizedData,
          requestBody: {
            id: request.id,
            late: request.late,
            familyId: request.familyId,
          },
          url,
        }, null, 2));
        throw new BookingApiError(
          "Invalid cancellation response format",
          400,
          "VALIDATION_ERROR",
          {
            zodIssues: validatedData.error.issues,
            rawResponse: normalizedData,
            requestBody: {
              id: request.id,
              late: request.late,
              familyId: request.familyId,
            },
          }
        );
      }

      return validatedData.data;
    } catch (error) {
      if (error instanceof BookingApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new BookingApiError("Request timeout", 408, "TIMEOUT_ERROR");
      }

      if (error instanceof TypeError) {
        throw new BookingApiError(
          "Network error - please check your connection",
          0,
          "NETWORK_ERROR"
        );
      }

      throw new BookingApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500,
        "UNKNOWN_ERROR"
      );
    }
  }

  private buildUrl(endpoint: string, params: BookingRequestParams): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    return `${this.baseUrl}${endpoint}?${searchParams.toString()}`;
  }
}

export class BookingApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly type:
      | "HTTP_ERROR"
      | "VALIDATION_ERROR"
      | "TIMEOUT_ERROR"
      | "NETWORK_ERROR"
      | "AUTH_ERROR"
      | "UNKNOWN_ERROR",
    public readonly details?: any
  ) {
    super(message);
    this.name = "BookingApiError";
  }

  get isRetryable(): boolean {
    return (
      this.type === "TIMEOUT_ERROR" ||
      this.type === "NETWORK_ERROR" ||
      (this.type === "HTTP_ERROR" && this.statusCode >= 500)
    );
  }

  get isAuthenticationError(): boolean {
    return (
      this.type === "AUTH_ERROR" ||
      (this.type === "HTTP_ERROR" &&
        (this.statusCode === 401 || this.statusCode === 403))
    );
  }
}

export const bookingService = new BookingService();
