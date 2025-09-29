# Frontend Test Engineer - Booking System Implementation Plan

## Executive Summary

This document provides comprehensive test case definitions for implementing the booking system in Test-Driven Development (TDD) mode. The tests cover API route handlers, service methods, data models, and error handling scenarios critical for a reliable booking system.

## Test Strategy Overview

### Testing Philosophy
- **Behavior-driven testing**: Test user interactions and outcomes, not implementation details
- **Integration-first approach**: Prioritize tests that provide confidence across system boundaries
- **Error scenario coverage**: Extensive testing of failure modes and edge cases
- **TDD compliance**: Tests written before implementation to drive design decisions

### Testing Framework Requirements

Based on project analysis, the following testing setup is required:

#### Required Dependencies
```bash
# Testing Framework
npm install -D vitest @vitejs/plugin-react

# Testing Utilities
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom

# API Mocking
npm install -D msw

# Test Utilities
npm install -D @types/node jsdom
```

#### Configuration Files

**`vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test-setup.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**`src/test-setup.ts`**
```typescript
import '@testing-library/jest-dom'
import { server } from './test/mocks/server'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())

// Mock window.localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
})
```

## Test Suite Structure

### 1. API Route Handler Tests
**File**: `/app/api/booking/route.test.ts`

#### 1.1 POST Method Success Scenarios

```typescript
describe('POST /api/booking - Success Scenarios', () => {
  it('should successfully create booking with valid parameters', async () => {
    // Test successful booking (bookState: 1)
    // Mock: SupabaseSessionService.getSession() returns valid session
    // Mock: External API returns success response with booking ID
    // Assert: Returns 200 with booking ID and success state
    // Assert: Response includes booking details
  })

  it('should handle successful booking with session cookies', async () => {
    // Test that cookies are properly forwarded to external API
    // Mock: Session service returns cookies array
    // Assert: External API called with formatted cookie string
    // Assert: Request headers include proper authentication
  })

  it('should return booking details with contract information', async () => {
    // Test that response includes clasesContratadas field
    // Assert: Response structure matches expected format
    // Assert: All required fields are present in response
  })
})
```

#### 1.2 POST Method Error Scenarios

```typescript
describe('POST /api/booking - Error Scenarios', () => {
  it('should return 400 for missing required parameters', async () => {
    // Test cases for missing: day, id parameters
    // Assert: Returns 400 status code
    // Assert: Error message specifies missing parameters
  })

  it('should handle early booking error (bookState: -12)', async () => {
    // Mock: External API returns bookState: -12 with error message
    // Assert: Returns 400 with proper error message
    // Assert: Error includes timing restriction information
    // Assert: Spanish error message is preserved
  })

  it('should return 401 for missing or invalid session', async () => {
    // Mock: SupabaseSessionService.getSession() returns null
    // Assert: Returns 401 status code
    // Assert: Error message indicates authentication required
  })

  it('should handle external API network errors', async () => {
    // Mock: External API call throws network error
    // Assert: Returns 500 status code
    // Assert: Generic error message for security
  })

  it('should handle external API timeout', async () => {
    // Mock: External API call times out
    // Assert: Returns 408 or 500 status code
    // Assert: Appropriate timeout error message
  })

  it('should handle external API server errors (5xx)', async () => {
    // Mock: External API returns 500+ status codes
    // Assert: Returns 502 or 500 status code
    // Assert: Service unavailable message
  })
})
```

#### 1.3 Authentication and Authorization Tests

```typescript
describe('POST /api/booking - Authentication', () => {
  it('should extract user email from request headers', async () => {
    // Test x-user-email header extraction
    // Mock: Request with x-user-email header
    // Assert: Session service called with correct email
  })

  it('should fallback to default email when header missing', async () => {
    // Test default email behavior
    // Mock: Request without x-user-email header
    // Assert: Uses default email for session lookup
  })

  it('should validate session cookies before API call', async () => {
    // Test session validation flow
    // Assert: Session service called before external API
    // Assert: No external API call if session invalid
  })
})
```

### 2. BookingService Unit Tests
**File**: `/modules/booking/api/services/booking.service.test.ts`

#### 2.1 makeReservation Method Tests

```typescript
describe('BookingService.makeReservation', () => {
  let bookingService: BookingService

  beforeEach(() => {
    bookingService = new BookingService()
  })

  it('should make successful reservation with valid parameters', async () => {
    // Mock: Successful API response with bookState: 1
    // Test: Call with valid day, id, familyId parameters
    // Assert: Returns parsed booking response
    // Assert: Request sent to correct endpoint with POST method
    // Assert: Request includes required headers
  })

  it('should handle early booking restrictions', async () => {
    // Mock: API returns bookState: -12 with error message
    // Test: Call makeReservation method
    // Assert: Throws BookingApiError with specific type
    // Assert: Error includes timing restriction details
    // Assert: Error message preserved from API response
  })

  it('should format request parameters correctly', async () => {
    // Test parameter formatting and URL construction
    // Assert: POST request body includes day, familyId, id, insist
    // Assert: insist parameter defaults to 0
    // Assert: familyId defaults to empty string
  })

  it('should include authentication cookies in request', async () => {
    // Test cookie handling in makeReservation
    // Mock: Cookies parameter provided
    // Assert: Cookie header formatted correctly
    // Assert: Multiple cookies joined with semicolon separator
  })

  it('should handle network timeout errors', async () => {
    // Mock: Request times out
    // Assert: Throws BookingApiError with TIMEOUT_ERROR type
    // Assert: Error message indicates timeout
    // Assert: isRetryable returns true
  })

  it('should handle validation errors for malformed responses', async () => {
    // Mock: API returns response that fails Zod validation
    // Assert: Throws BookingApiError with VALIDATION_ERROR type
    // Assert: Error includes validation details
    // Assert: isRetryable returns false
  })
})
```

#### 2.2 BookingApiError Class Tests

```typescript
describe('BookingApiError', () => {
  it('should correctly identify retryable errors', async () => {
    // Test isRetryable property for different error types
    // Assert: TIMEOUT_ERROR is retryable
    // Assert: NETWORK_ERROR is retryable
    // Assert: HTTP 5xx errors are retryable
    // Assert: HTTP 4xx errors are not retryable
  })

  it('should correctly identify authentication errors', async () => {
    // Test isAuthenticationError property
    // Assert: HTTP 401 is authentication error
    // Assert: HTTP 403 is authentication error
    // Assert: Other status codes return false
  })

  it('should preserve error details and context', async () => {
    // Test error construction with details
    // Assert: Message, statusCode, type preserved
    // Assert: Details object available for debugging
    // Assert: Error name is 'BookingApiError'
  })
})
```

### 3. API Models and Validation Tests
**File**: `/modules/booking/api/models/booking-reservation.api.test.ts`

#### 3.1 Request Schema Validation

```typescript
describe('BookingReservationRequest Schema', () => {
  it('should validate valid reservation request', async () => {
    // Test valid request object
    const validRequest = {
      day: '20250929',
      id: '123456',
      familyId: '',
      insist: 0
    }
    // Assert: Schema validation passes
    // Assert: All fields correctly typed
  })

  it('should reject invalid day format', async () => {
    // Test various invalid day formats
    // Assert: Rejects non-YYYYMMDD formats
    // Assert: Rejects invalid dates
    // Assert: Validation errors include field details
  })

  it('should require mandatory fields', async () => {
    // Test missing required fields
    // Assert: Rejects requests missing day or id
    // Assert: Allows optional fields to be undefined
  })

  it('should handle edge cases for insist parameter', async () => {
    // Test insist parameter edge cases
    // Assert: Accepts 0 and 1 values
    // Assert: Rejects other values
    // Assert: Defaults appropriately when missing
  })
})
```

#### 3.2 Response Schema Validation

```typescript
describe('BookingReservationResponse Schema', () => {
  it('should validate successful booking response', async () => {
    // Test success response structure
    const successResponse = {
      clasesContratadas: "WOD, GYMNASTICS",
      hasPublicMemberships: 1,
      bookState: 1,
      id: "106015104"
    }
    // Assert: Schema validation passes
    // Assert: All success fields present
  })

  it('should validate error booking response', async () => {
    // Test error response structure
    const errorResponse = {
      clasesContratadas: "WOD, GYMNASTICS",
      bookState: -12,
      errorMssg: "No puedes reservar clases con más de 4 días de antelación",
      errorMssgLang: "ERROR_ANTELACION_CLIENTE"
    }
    // Assert: Schema validation passes
    // Assert: Error fields properly typed
  })

  it('should handle response field variations', async () => {
    // Test optional and varying field types
    // Assert: hasPublicMemberships can be number or boolean
    // Assert: id field properly handled when present/absent
    // Assert: Error fields only required for error states
  })
})
```

### 4. Business Logic Tests
**File**: `/modules/booking/business/booking-reservation.business.test.ts`

#### 4.1 Reservation Business Rules

```typescript
describe('BookingReservation Business Logic', () => {
  it('should validate booking timing restrictions', async () => {
    // Test business rules for booking timing
    // Assert: Future date validation
    // Assert: Maximum advance booking period
    // Assert: Minimum advance booking period
  })

  it('should handle class capacity and waitlist logic', async () => {
    // Test capacity management
    // Assert: Full class handling
    // Assert: Waitlist enrollment logic
    // Assert: Capacity validation
  })

  it('should process reservation state changes', async () => {
    // Test state transitions
    // Assert: Available -> Booked transition
    // Assert: Reservation confirmation handling
    // Assert: State persistence
  })
})
```

### 5. Integration Tests
**File**: `/modules/booking/__tests__/booking-integration.test.ts`

#### 5.1 End-to-End Booking Flow

```typescript
describe('Booking Integration Tests', () => {
  it('should complete full booking flow successfully', async () => {
    // Test complete user journey
    // 1. User authentication
    // 2. Class selection
    // 3. Reservation request
    // 4. Confirmation handling
    // Assert: Each step completes successfully
    // Assert: Data flows correctly between layers
  })

  it('should handle booking conflicts gracefully', async () => {
    // Test concurrent booking scenarios
    // Mock: Multiple simultaneous booking attempts
    // Assert: Proper conflict resolution
    // Assert: User feedback for conflicts
  })

  it('should integrate with authentication system', async () => {
    // Test auth integration
    // Assert: Session validation works end-to-end
    // Assert: Cookie handling throughout flow
    // Assert: Proper error handling for auth failures
  })
})
```

### 6. Error Handling and Edge Cases
**File**: `/modules/booking/__tests__/booking-edge-cases.test.ts`

#### 6.1 Edge Case Scenarios

```typescript
describe('Booking Edge Cases', () => {
  it('should handle malformed API responses', async () => {
    // Test various malformed response formats
    // Assert: Graceful error handling
    // Assert: User-friendly error messages
    // Assert: System stability maintained
  })

  it('should handle network interruptions', async () => {
    // Test network failure scenarios
    // Assert: Proper retry logic
    // Assert: Timeout handling
    // Assert: User feedback for network issues
  })

  it('should handle rate limiting scenarios', async () => {
    // Test API rate limiting
    // Mock: 429 responses from external API
    // Assert: Appropriate backoff strategy
    // Assert: User notification of rate limits
  })

  it('should validate date boundaries', async () => {
    // Test edge cases for dates
    // Assert: Leap year handling
    // Assert: Month boundary validations
    // Assert: Timezone considerations
  })
})
```

## Test Data Management

### Mock Data Factories

```typescript
// /src/test/factories/booking-factories.ts
export const createMockBookingRequest = (overrides = {}) => ({
  day: '20250929',
  id: '123456',
  familyId: '',
  insist: 0,
  ...overrides
})

export const createMockSuccessResponse = (overrides = {}) => ({
  clasesContratadas: "WOD, GYMNASTICS, HALTEROFILIA",
  hasPublicMemberships: 1,
  bookState: 1,
  id: "106015104",
  ...overrides
})

export const createMockErrorResponse = (overrides = {}) => ({
  clasesContratadas: "WOD, GYMNASTICS",
  bookState: -12,
  errorMssg: "No puedes reservar clases con más de 4 días de antelación",
  errorMssgLang: "ERROR_ANTELACION_CLIENTE",
  ...overrides
})
```

### MSW Request Handlers

```typescript
// /src/test/mocks/handlers/booking-handlers.ts
import { http, HttpResponse } from 'msw'

export const bookingHandlers = [
  // Success booking
  http.post('https://crossfitcerdanyola300.aimharder.com/api/book', () => {
    return HttpResponse.json(createMockSuccessResponse())
  }),

  // Early booking error
  http.post('https://crossfitcerdanyola300.aimharder.com/api/book', ({ request }) => {
    const url = new URL(request.url)
    const day = url.searchParams.get('day')

    if (day && isEarlyBooking(day)) {
      return HttpResponse.json(createMockErrorResponse(), { status: 400 })
    }
    return HttpResponse.json(createMockSuccessResponse())
  }),

  // Network error
  http.post('https://crossfitcerdanyola300.aimharder.com/api/book', () => {
    return HttpResponse.error()
  })
]
```

## Test Coverage Requirements

### Minimum Coverage Thresholds
- **Statements**: 85%
- **Branches**: 80%
- **Functions**: 90%
- **Lines**: 85%

### Critical Path Coverage
- All API endpoint methods: 100%
- Error handling paths: 90%
- Authentication flows: 95%
- Data validation: 100%

## Test Execution Strategy

### Test Categories and Markers
```typescript
// Use Vitest test markers for test categorization
describe.concurrent('Unit Tests', () => { /* unit tests */ })
describe.sequential('Integration Tests', () => { /* integration tests */ })
describe.skip('Manual Tests', () => { /* manual test scenarios */ })
```

### CI/CD Integration
- Run unit tests on every commit
- Run integration tests on pull requests
- Full test suite on main branch pushes
- Performance tests on release candidates

## Accessibility and User Experience Testing

### Screen Reader Testing
```typescript
describe('Booking Accessibility', () => {
  it('should provide proper ARIA labels for booking states', async () => {
    // Test screen reader compatibility
    // Assert: Proper ARIA attributes
    // Assert: Meaningful labels for booking states
  })

  it('should support keyboard navigation', async () => {
    // Test keyboard accessibility
    // Assert: Tab navigation works
    // Assert: Enter/Space key activation
  })
})
```

## Performance Testing

### Load Testing Scenarios
```typescript
describe('Booking Performance', () => {
  it('should handle concurrent booking requests', async () => {
    // Test concurrent request handling
    // Assert: Response times within acceptable limits
    // Assert: No race conditions
  })

  it('should cache authentication sessions appropriately', async () => {
    // Test session caching performance
    // Assert: Minimal auth overhead
    // Assert: Proper cache invalidation
  })
})
```

## Security Testing

### Authentication Security
```typescript
describe('Booking Security', () => {
  it('should validate session tokens properly', async () => {
    // Test token validation
    // Assert: Expired tokens rejected
    // Assert: Invalid tokens rejected
  })

  it('should sanitize user input', async () => {
    // Test input sanitization
    // Assert: XSS prevention
    // Assert: SQL injection prevention
  })
})
```

## Implementation Notes

### Key Testing Principles
1. **Test Behavior, Not Implementation**: Focus on what the system should do, not how it does it
2. **Fail Fast**: Tests should fail quickly and provide clear error messages
3. **Isolation**: Each test should be independent and not rely on others
4. **Repeatability**: Tests should produce consistent results across environments

### Critical Success Factors
1. **External API Reliability**: Mock external dependencies consistently
2. **Authentication Flow**: Ensure session management works reliably
3. **Error Handling**: Test all error scenarios thoroughly
4. **Data Validation**: Validate all inputs and outputs strictly

### Things to Clarify with User

1. **Specific Business Rules**: Are there additional business rules for booking restrictions beyond the 4-day advance limit?

2. **Error Message Localization**: Should error messages be localized, or is Spanish acceptable for all users?

3. **Rate Limiting Strategy**: How should the system handle rate limiting from the external API?

4. **Booking Confirmation Flow**: After successful booking, are there additional steps (email confirmation, calendar integration)?

5. **Session Management**: How long should booking sessions remain active?

6. **Capacity Management**: How should the system handle class capacity limits and waitlists?

7. **Retry Logic**: What retry strategy should be implemented for network failures?

8. **Logging and Monitoring**: What level of logging is required for booking operations?

9. **Performance Requirements**: What are the acceptable response times for booking operations?

10. **Browser Support**: Which browsers and versions need to be supported for testing?

## Conclusion

This comprehensive test plan provides the foundation for implementing the booking system using Test-Driven Development. The tests cover all critical scenarios including success cases, error handling, authentication, and edge cases. Following this plan will ensure a robust, reliable booking system that meets user expectations and business requirements.

The TDD approach will help drive the design of clean, testable code while providing confidence that the booking system works correctly across all scenarios. Regular execution of these tests will catch regressions early and maintain system quality throughout development and maintenance cycles.