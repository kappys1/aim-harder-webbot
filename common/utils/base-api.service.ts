/**
 * Base API Service - Consolidates common API patterns
 *
 * BOILERPLATE REDUCTION: This service eliminates ~250 lines of repeated code
 * found in booking.service.ts, prebooking.service.ts, box.service.ts, etc.
 *
 * Common patterns consolidated:
 * - Fetch with timeout/abort
 * - JSON validation with Zod
 * - Error handling and logging
 * - Header construction
 * - Request/response transformation
 */

import type { ZodSchema } from "zod";

export interface ApiServiceConfig {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Base class for API services
 * Provides common fetch, validation, and error handling logic
 */
export abstract class BaseApiService {
  protected readonly baseUrl: string;
  protected readonly timeout: number;
  protected readonly defaultHeaders: Record<string, string>;

  constructor(config: ApiServiceConfig = {}) {
    this.baseUrl = config.baseUrl || "";
    this.timeout = config.timeout || 8000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  /**
   * Perform a fetch request with timeout and error handling
   * @param endpoint - API endpoint path
   * @param options - Fetch options
   * @returns Raw response data
   */
  protected async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: ZodSchema
  ): Promise<T> {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          "HTTP_ERROR"
        );
      }

      const data = await response.json();

      // Validate with schema if provided
      if (schema) {
        const validated = schema.safeParse(data);
        if (!validated.success) {
          const errorMessage = `Validation failed: ${JSON.stringify(validated.error.issues)}`;
          throw new ApiError(errorMessage, undefined, "VALIDATION_ERROR", data);
        }
        return validated.data as T;
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof AbortSignal) {
        throw new ApiError("Request timeout", undefined, "TIMEOUT_ERROR", error);
      }

      if (error instanceof Error) {
        throw new ApiError(error.message, undefined, "NETWORK_ERROR", error);
      }

      throw new ApiError("Unknown error", undefined, "UNKNOWN_ERROR", error);
    }
  }

  /**
   * GET request helper
   */
  protected async get<T>(
    endpoint: string,
    schema?: ZodSchema
  ): Promise<T> {
    return this.fetch<T>(endpoint, { method: "GET" }, schema);
  }

  /**
   * POST request helper
   */
  protected async post<T>(
    endpoint: string,
    data?: unknown,
    schema?: ZodSchema
  ): Promise<T> {
    return this.fetch<T>(
      endpoint,
      {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
      },
      schema
    );
  }

  /**
   * PUT request helper
   */
  protected async put<T>(
    endpoint: string,
    data?: unknown,
    schema?: ZodSchema
  ): Promise<T> {
    return this.fetch<T>(
      endpoint,
      {
        method: "PUT",
        body: data ? JSON.stringify(data) : undefined,
      },
      schema
    );
  }

  /**
   * PATCH request helper
   */
  protected async patch<T>(
    endpoint: string,
    data?: unknown,
    schema?: ZodSchema
  ): Promise<T> {
    return this.fetch<T>(
      endpoint,
      {
        method: "PATCH",
        body: data ? JSON.stringify(data) : undefined,
      },
      schema
    );
  }

  /**
   * DELETE request helper
   */
  protected async delete<T>(
    endpoint: string,
    schema?: ZodSchema
  ): Promise<T> {
    return this.fetch<T>(endpoint, { method: "DELETE" }, schema);
  }

  /**
   * Add custom headers to request
   * Useful for auth, user context, etc.
   */
  protected addHeaders(headers: Record<string, string>): void {
    Object.assign(this.defaultHeaders, headers);
  }

  /**
   * Get header value
   */
  protected getHeader(key: string): string | undefined {
    return this.defaultHeaders[key];
  }
}

/**
 * Factory function to create typed API service
 * Reduces boilerplate of service class instantiation
 */
export function createApiService<T extends BaseApiService>(
  ServiceClass: new (config?: ApiServiceConfig) => T,
  config?: ApiServiceConfig
): T {
  return new ServiceClass(config);
}
