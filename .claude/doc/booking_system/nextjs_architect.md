# POST Booking System Implementation Plan

## Overview

This document provides a comprehensive implementation strategy for adding POST booking functionality to the existing booking system. The implementation extends the current GET-based booking retrieval with class reservation capabilities while maintaining architectural consistency and following established patterns.

## Current Architecture Analysis

### Existing Components

1. **API Route**: `/app/api/booking/route.ts`
   - ✅ GET method with external API proxy
   - ✅ SupabaseSessionService authentication
   - ✅ Proper CORS headers and error handling

2. **Service Layer**: `modules/booking/api/services/booking.service.ts`
   - ✅ BookingService class with timeout, validation
   - ✅ BookingApiError with proper error classification
   - ✅ Cookie-based authentication integration

3. **Data Models**: `modules/booking/api/models/booking.api.ts`
   - ✅ Zod schemas for GET requests/responses
   - ✅ Type-safe request/response handling

4. **Authentication**: `modules/auth/api/services/supabase-session.service.ts`
   - ✅ Cookie-based session management
   - ✅ External API authentication flow

## Implementation Strategy

### 1. API Route Enhancement

**File**: `/app/api/booking/route.ts`

**Action**: Extend existing route with POST method

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validatedRequest = BookingCreateRequestSchema.safeParse(body);

    if (!validatedRequest.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: validatedRequest.error.issues },
        { status: 400 }
      );
    }

    // 2. Get user authentication (reuse existing pattern)
    const userEmail = request.headers.get("x-user-email") || "alexsbd1@gmail.com";
    const session = await SupabaseSessionService.getSession(userEmail);

    if (!session) {
      return NextResponse.json(
        { error: "User session not found. Please login first." },
        { status: 401 }
      );
    }

    // 3. Format cookies and make POST request to external API
    const cookieString = session.cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const response = await fetch(`${BOOKING_API_BASE_URL}/api/book`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieString,
        // ... other headers from GET implementation
      },
      body: new URLSearchParams(validatedRequest.data),
    });

    // 4. Handle response with business logic error handling
    const data = await response.json();
    const validatedResponse = BookingCreateResponseSchema.safeParse(data);

    if (!validatedResponse.success) {
      return NextResponse.json(
        { error: "Invalid API response format" },
        { status: 502 }
      );
    }

    // 5. Handle business logic responses
    if (validatedResponse.data.bookState === 1) {
      // Success - booking created
      return NextResponse.json({
        success: true,
        bookingId: validatedResponse.data.id,
        message: "Booking created successfully"
      });
    } else if (validatedResponse.data.bookState === -12) {
      // Early booking error
      return NextResponse.json({
        success: false,
        error: "booking_restriction",
        message: validatedResponse.data.errorMssg,
        errorCode: validatedResponse.data.errorMssgLang
      }, { status: 422 });
    } else {
      // Other business errors
      return NextResponse.json({
        success: false,
        error: "booking_failed",
        message: validatedResponse.data.errorMssg || "Booking failed"
      }, { status: 422 });
    }

  } catch (error) {
    console.error("Booking creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### 2. API Models Extension

**File**: `modules/booking/api/models/booking.api.ts`

**Action**: Add POST-specific schemas

```typescript
// POST Request Schema
export const BookingCreateRequestSchema = z.object({
  day: z.string().regex(/^\d{8}$/, "Day must be in YYYYMMDD format"),
  familyId: z.string().default(""),
  id: z.string().min(1, "Slot ID is required"),
  insist: z.literal(0),
});

// POST Response Schema
export const BookingCreateResponseSchema = z.object({
  clasesContratadas: z.string(),
  hasPublicMemberships: z.number().optional(),
  bookState: z.number(),
  id: z.string().optional(), // Booking ID when successful
  errorMssg: z.string().optional(), // Error message when failed
  errorMssgLang: z.string().optional(), // Error language key
});

// Type exports
export type BookingCreateRequest = z.infer<typeof BookingCreateRequestSchema>;
export type BookingCreateResponse = z.infer<typeof BookingCreateResponseSchema>;
```

### 3. Service Layer Enhancement

**File**: `modules/booking/api/services/booking.service.ts`

**Action**: Add createBooking method

```typescript
import { BookingCreateRequest, BookingCreateResponse, BookingCreateResponseSchema } from '../models/booking.api';

export class BookingService {
  // ... existing code ...

  async createBooking(
    params: BookingCreateRequest,
    cookies?: AuthCookie[]
  ): Promise<BookingCreateResponse> {
    const url = `${this.baseUrl}${BOOKING_CONSTANTS.API.ENDPOINTS.BOOK}`;

    const headers: Record<string, string> = {
      'Accept': '*/*',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Add user email from localStorage if available
    if (typeof window !== 'undefined') {
      const userEmail = localStorage.getItem('user-email');
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
    }

    if (cookies && cookies.length > 0) {
      headers['Cookie'] = CookieService.formatForRequest(cookies);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const body = new URLSearchParams(params);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        credentials: 'include',
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new BookingApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          'HTTP_ERROR'
        );
      }

      const data = await response.json();
      const validatedData = BookingCreateResponseSchema.safeParse(data);

      if (!validatedData.success) {
        throw new BookingApiError(
          'Invalid API response format',
          400,
          'VALIDATION_ERROR',
          validatedData.error.issues
        );
      }

      return validatedData.data;

    } catch (error) {
      // ... existing error handling pattern ...
    }
  }
}
```

### 4. Constants Update

**File**: `modules/booking/constants/booking.constants.ts`

**Action**: Add POST endpoint

```typescript
export const BOOKING_CONSTANTS = {
  API: {
    BASE_URL: '',
    ENDPOINTS: {
      BOOKINGS: '/api/booking',
      BOOK: '/api/booking', // Same route, POST method
    },
    EXTERNAL: {
      BOOK: '/api/book', // External API endpoint
    },
    // ... rest of constants
  },
  // ... rest of constants
} as const;
```

## Error Handling Strategy

### 1. HTTP-Level Errors (4xx/5xx)
- **Network errors**: Connection timeout, DNS resolution
- **Authentication errors**: Invalid session, expired cookies
- **Server errors**: External API downtime, malformed responses

### 2. Business-Level Errors (bookState responses)
- **Success**: `bookState: 1` → Return booking ID
- **Early booking**: `bookState: -12` → Return user-friendly error with restriction message
- **Other errors**: Other bookState values → Return generic booking failure

### 3. Error Response Format
```typescript
// Success
{ success: true, bookingId: "106015104", message: "Booking created successfully" }

// Business error
{ success: false, error: "booking_restriction", message: "No puedes reservar...", errorCode: "ERROR_ANTELACION_CLIENTE" }

// HTTP error
{ error: "User session not found. Please login first." }
```

## Integration Points

### 1. Frontend Integration
- **Business Hook**: Extend `useBooking.hook.tsx` with `createBooking` mutation
- **UI Components**: Add booking buttons to `booking-card.component.tsx`
- **State Management**: Update booking state after successful reservation

### 2. Authentication Flow
- **Reuse Pattern**: Same SupabaseSessionService integration as GET
- **Cookie Management**: Forward same authentication cookies
- **Error Handling**: Handle 401 responses consistently

### 3. Data Flow
1. User clicks "Book" button → UI component
2. Component calls business hook → `useBooking.hook.tsx`
3. Hook calls service → `BookingService.createBooking`
4. Service calls API route → `/app/api/booking` (POST)
5. API route calls external API → AimHarder API
6. Response flows back through layers with proper error handling

## Testing Strategy

### 1. Unit Tests
- **API Route**: Test POST method with valid/invalid payloads
- **Service Layer**: Test `createBooking` with various scenarios
- **Validation**: Test Zod schemas with edge cases

### 2. Integration Tests
- **End-to-End**: Test complete booking flow with authentication
- **Error Scenarios**: Test different bookState responses
- **Network Errors**: Test timeout and connection failures

## Implementation Checklist

- [ ] Extend `/app/api/booking/route.ts` with POST method
- [ ] Add new Zod schemas in `booking.api.ts`
- [ ] Extend `BookingService` with `createBooking` method
- [ ] Update constants with new endpoints
- [ ] Add business hook integration
- [ ] Add UI components for booking actions
- [ ] Implement comprehensive error handling
- [ ] Add unit and integration tests
- [ ] Test authentication flow end-to-end
- [ ] Validate all error scenarios

## Key Architectural Decisions

1. **Route Extension vs New Route**: Chose extension for consistency and REST principles
2. **Error Handling**: Two-tier approach separating HTTP and business errors
3. **Service Integration**: Extended existing service to maintain patterns
4. **Validation Strategy**: Zod schemas for both request and response validation
5. **Authentication**: Reused existing SupabaseSessionService pattern

This implementation maintains architectural consistency while adding robust booking functionality with proper error handling and type safety.