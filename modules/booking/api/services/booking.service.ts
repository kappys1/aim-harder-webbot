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

export class BookingService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: BookingServiceConfig = {}) {
    this.baseUrl = config.baseUrl || BOOKING_CONSTANTS.API.BASE_URL;
    // OPTIMIZATION: Reduced from 30s to 8s for faster failure detection
    this.timeout = config.timeout || 8000;
  }

  async getBookings(
    params: BookingRequestParams,
    cookies?: AuthCookie[]
  ): Promise<BookingResponseApi> {
    const url = this.buildUrl(BOOKING_CONSTANTS.API.ENDPOINTS.BOOKINGS, params);

    const headers: Record<string, string> = {
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    };

    // Add user email from localStorage if available
    if (typeof window !== "undefined") {
      const userEmail = localStorage.getItem("user-email");
      if (userEmail) {
        headers["x-user-email"] = userEmail;
      }
    }

    if (cookies && cookies.length > 0) {
      headers["Cookie"] = CookieService.formatForRequest(cookies);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        credentials: "include",
        mode: "cors",
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

      const validatedData = BookingResponseApiSchema.safeParse(data);
      if (!validatedData.success) {
        // LOG: Detailed validation error for getBookings (stringified for production visibility)
        console.error('[BOOKING_API] Validation failed for getBookings:', JSON.stringify({
          zodError: validatedData.error.issues,
          rawResponse: data,
          requestParams: params,
          url,
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

      // CRITICAL: Detect session expiration BEFORE validation
      // Aimharder returns { logout: 1 } when token/session is expired
      if (data.logout === 1) {
        console.error('[BOOKING_API] Session expired (logout: 1):', JSON.stringify({
          url,
          statusCode: response.status,
          rawResponse: data,
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

      // LOG: Capture raw response for debugging (using console.error to ensure visibility in production)
      console.error('[BOOKING_API] Raw createBooking response:', JSON.stringify({
        url,
        statusCode: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: data,
      }, null, 2));

      const validatedData = BookingCreateResponseSchema.safeParse(data);

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

      const validatedData = BookingCancelResponseSchema.safeParse(data);
      if (!validatedData.success) {
        // LOG: Detailed validation error for cancelBooking (stringified for production visibility)
        console.error('[BOOKING_API] Validation failed for cancelBooking:', JSON.stringify({
          zodError: validatedData.error.issues,
          rawResponse: data,
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
            rawResponse: data,
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
