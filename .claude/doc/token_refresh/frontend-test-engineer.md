# Token Update Feature - Test Implementation Plan

## Overview

This document outlines comprehensive test cases for the new tokenUpdate feature using TDD (Test-Driven Development) approach. The feature includes a new endpoint, service layer, database operations, and cron job automation that works alongside the existing `setrefresh` functionality.

## Test Infrastructure Setup

### 1. Testing Framework Configuration

Since the project currently lacks test configuration, we need to set up:

```json
// package.json additions
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "jsdom": "^22.0.0",
    "msw": "^2.0.0"
  }
}
```

### 2. Vitest Configuration

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

### 3. Test Utilities and Mocks

Create shared test utilities:
- `src/test/setup.ts` - Global test setup
- `src/test/mocks/` - Mock implementations
- `src/test/utils/` - Test helper functions

## Test Coverage Requirements

### Test Categories (using markers)
- `@unit` - Unit tests for isolated functions/methods
- `@integration` - Integration tests for feature workflows
- `@api` - API endpoint tests
- `@auth` - Authentication-related tests
- `@database` - Database operation tests
- `@cron` - Cron job automation tests

## Detailed Test Cases

### 1. API Endpoint Tests (`/api/tokenUpdate`)

**File:** `app/api/tokenUpdate/route.test.ts`

#### Success Scenarios
```typescript
describe('@api POST /api/tokenUpdate', () => {
  describe('Success scenarios', () => {
    it('should successfully update token when valid fingerprint and token provided', async () => {
      // Mock AimharderTokenUpdateService.updateToken to return newToken
      // Mock SupabaseSessionService.updateTokenAndCookies
      // Assert 200 response with {"newToken": "new_token_value"}
    })

    it('should update database with new token and cookies', async () => {
      // Mock external service to return valid response with cookies
      // Verify SupabaseSessionService.updateTokenAndCookies called with correct params
      // Verify response headers include AWSALB and AWSALBCORS updates
    })

    it('should handle requests with valid JSON payload', async () => {
      // Test with proper Content-Type and valid JSON structure
      // Verify request parsing works correctly
    })
  })
})
```

#### Failure Scenarios
```typescript
describe('Failure scenarios', () => {
  it('should return 400 when fingerprint is missing', async () => {
    // Send request without fingerprint
    // Assert 400 status and error message
  })

  it('should return 400 when token is missing', async () => {
    // Send request without token
    // Assert 400 status and error message
  })

  it('should return 400 when request body is invalid JSON', async () => {
    // Send malformed JSON
    // Assert 400 status and parsing error
  })

  it('should return logout response when external service indicates logout', async () => {
    // Mock AimharderTokenUpdateService to return logout: 1
    // Assert response is {"logout": 1}
  })

  it('should return 500 when database update fails', async () => {
    // Mock SupabaseSessionService to throw error
    // Assert 500 status and error handling
  })

  it('should return 500 when external service throws error', async () => {
    // Mock AimharderTokenUpdateService to throw error
    // Assert 500 status and error handling
  })
})
```

### 2. Service Layer Tests (`AimharderTokenUpdateService`)

**File:** `modules/auth/api/services/aimharder-token-update.service.test.ts`

#### Core Functionality Tests
```typescript
describe('@unit AimharderTokenUpdateService', () => {
  describe('updateToken method', () => {
    it('should make correct HTTP request to tokenUpdate endpoint', async () => {
      // Mock fetch to capture request
      // Verify POST method, correct URL, headers, and body
      // Assert fingerprint and token in request payload
    })

    it('should parse successful response correctly', async () => {
      // Mock successful response: {"newToken": "69232|1766907797|f3069323e00d81750c8590bb1f5f93b6"}
      // Assert service returns parsed newToken value
    })

    it('should handle logout response correctly', async () => {
      // Mock logout response: {"logout": 1}
      // Assert service returns appropriate logout indicator
    })

    it('should extract cookies from response headers', async () => {
      // Mock response with AWSALB and AWSALBCORS headers
      // Verify cookie extraction logic
      // Assert returned cookies match expected format
    })

    it('should handle network errors gracefully', async () => {
      // Mock fetch to reject/throw network error
      // Assert service handles error and returns appropriate error response
    })

    it('should handle HTTP error status codes', async () => {
      // Mock responses with 4xx and 5xx status codes
      // Assert service handles non-2xx responses correctly
    })

    it('should handle malformed JSON responses', async () => {
      // Mock response with invalid JSON
      // Assert service handles parsing errors gracefully
    })

    it('should include correct User-Agent header', async () => {
      // Verify User-Agent header matches browser signature
      // Important for bypassing bot detection
    })
  })
})
```

#### Request Building Tests
```typescript
describe('Request building', () => {
  it('should build correct request URL', async () => {
    // Verify URL construction with environment variables
    // Assert proper endpoint URL formation
  })

  it('should format request payload correctly', async () => {
    // Test fingerprint and token inclusion in payload
    // Verify JSON structure and encoding
  })

  it('should handle special characters in tokens', async () => {
    // Test with tokens containing URL-unsafe characters
    // Verify proper encoding/escaping
  })
})
```

### 3. Database Operations Tests

**File:** `modules/auth/api/services/supabase-session.service.test.ts` (additions)

#### Token Update Tests
```typescript
describe('@database SupabaseSessionService - Token Updates', () => {
  describe('updateTokenAndCookies method', () => {
    it('should update aimharder_token field correctly', async () => {
      // Mock supabaseAdmin.from().update()
      // Verify correct token value in update call
      // Assert email filter is applied correctly
    })

    it('should update AWSALB and AWSALBCORS cookies', async () => {
      // Mock successful update with new cookie values
      // Verify specific cookie updates in aimharder_cookies JSONB field
      // Assert other cookies remain unchanged
    })

    it('should update timestamps correctly', async () => {
      // Verify updated_at field is set to current timestamp
      // Assert timestamp format is ISO string
    })

    it('should handle non-existent user gracefully', async () => {
      // Test update for email that doesn't exist in database
      // Verify error handling or creation logic
    })

    it('should handle database connection errors', async () => {
      // Mock supabase client to throw connection error
      // Assert error is properly caught and re-thrown with context
    })

    it('should handle partial cookie updates', async () => {
      // Test scenarios where only AWSALB or AWSALBCORS is provided
      // Verify selective cookie updating logic
    })

    it('should preserve existing cookies when updating specific ones', async () => {
      // Ensure other cookies aren't lost during update
      // Test JSONB merge behavior
    })
  })
})
```

#### Token Retrieval Tests
```typescript
describe('getSessionForTokenUpdate method', () => {
  it('should retrieve session by email for token update', async () => {
    // Mock session retrieval with required fields
    // Verify fingerprint and token are included in response
  })

  it('should handle session not found scenarios', async () => {
    // Test retrieval when email doesn't exist
    // Assert proper null/undefined handling
  })

  it('should validate session data structure', async () => {
    // Verify returned session has required fields for token update
    // Assert data types match expected interfaces
  })
})
```

### 4. Integration Tests

**File:** `modules/auth/api/integration/token-update.integration.test.ts`

#### End-to-End Workflow Tests
```typescript
describe('@integration Token Update Workflow', () => {
  it('should complete full token update cycle successfully', async () => {
    // 1. Setup: Create test session in database
    // 2. Mock external tokenUpdate API
    // 3. Call /api/tokenUpdate endpoint
    // 4. Verify database was updated
    // 5. Verify response format
    // 6. Cleanup: Remove test session
  })

  it('should handle token expiration scenario', async () => {
    // Simulate expired token scenario
    // Verify logout response triggers proper cleanup
    // Assert session is marked for re-authentication
  })

  it('should work with existing auth session data', async () => {
    // Use real session data structure from existing auth
    // Verify compatibility with current auth_sessions table
    // Assert no conflicts with existing refresh mechanisms
  })

  it('should maintain session integrity during concurrent updates', async () => {
    // Test concurrent token updates for same user
    // Verify database consistency and race condition handling
  })
})
```

### 5. Cron Job Integration Tests

**File:** `modules/auth/api/cron/token-update-cron.test.ts`

#### GitHub Actions Cron Tests
```typescript
describe('@cron Token Update Automation', () => {
  describe('Cron job execution', () => {
    it('should process all active sessions', async () => {
      // Mock SupabaseSessionService.getAllActiveSessions()
      // Verify each session gets token update attempt
      // Assert proper error handling for individual failures
    })

    it('should handle rate limiting across multiple sessions', async () => {
      // Test processing many sessions without hitting rate limits
      // Verify appropriate delays between requests
    })

    it('should skip sessions that don\'t need token updates', async () => {
      // Test logic for determining which sessions need updates
      // Verify filtering based on last update time
    })

    it('should log appropriate metrics and results', async () => {
      // Verify logging of success/failure counts
      // Assert proper error reporting for monitoring
    })

    it('should handle partial failures gracefully', async () => {
      // Test scenario where some session updates fail
      // Verify cron continues processing remaining sessions
      // Assert failed sessions are properly logged/tracked
    })
  })

  describe('Scheduling and timing', () => {
    it('should run every 15 minutes as configured', async () => {
      // Test cron schedule configuration
      // Verify GitHub Actions workflow timing
    })

    it('should respect token expiration timing (1.5 hours)', async () => {
      // Test update frequency aligns with token lifecycle
      // Verify updates happen before token expiration
    })
  })
})
```

### 6. Error Handling and Edge Cases

**File:** `modules/auth/api/error-handling/token-update-errors.test.ts`

#### Comprehensive Error Scenarios
```typescript
describe('@auth Token Update Error Handling', () => {
  describe('External service errors', () => {
    it('should handle timeout errors from aimharder.com', async () => {
      // Mock request timeout
      // Verify graceful degradation
      // Assert retry logic if implemented
    })

    it('should handle 429 rate limiting responses', async () => {
      // Mock rate limit response from external service
      // Verify backoff strategy
    })

    it('should handle unexpected response formats', async () => {
      // Mock responses that don't match expected schema
      // Verify robust parsing and error handling
    })
  })

  describe('Database error scenarios', () => {
    it('should handle concurrent modification conflicts', async () => {
      // Test simultaneous updates to same session
      // Verify conflict resolution strategy
    })

    it('should handle database constraint violations', async () => {
      // Test edge cases with invalid data
      // Verify constraint error handling
    })
  })

  describe('Authentication edge cases', () => {
    it('should handle logout scenarios correctly', async () => {
      // Test when external service returns {logout: 1}
      // Verify session cleanup and user notification
    })

    it('should handle session invalidation during update', async () => {
      // Test scenario where session becomes invalid mid-update
      // Verify proper cleanup and error handling
    })
  })
})
```

### 7. Performance and Load Tests

**File:** `modules/auth/api/performance/token-update-performance.test.ts`

```typescript
describe('@integration Token Update Performance', () => {
  it('should handle multiple concurrent token updates', async () => {
    // Test multiple simultaneous requests
    // Verify no race conditions or data corruption
    // Assert reasonable response times
  })

  it('should process large numbers of sessions efficiently', async () => {
    // Test cron job with many active sessions
    // Verify memory usage and processing time
    // Assert scalability characteristics
  })

  it('should handle database connection pooling correctly', async () => {
    // Test high-concurrency database access
    // Verify connection management
  })
})
```

## Mock Implementations

### 1. AimharderTokenUpdateService Mock
```typescript
// src/test/mocks/aimharder-token-update-service.mock.ts
export const mockAimharderTokenUpdateService = {
  updateToken: vi.fn(),
  // Add mock implementations for different scenarios
}
```

### 2. Supabase Mock
```typescript
// src/test/mocks/supabase.mock.ts
export const mockSupabaseAdmin = {
  from: vi.fn(() => ({
    update: vi.fn(() => ({ eq: vi.fn() })),
    select: vi.fn(() => ({ eq: vi.fn() })),
    // Add more mock methods as needed
  }))
}
```

### 3. Fetch Mock
```typescript
// src/test/mocks/fetch.mock.ts
export const mockFetch = vi.fn()
global.fetch = mockFetch
```

## Test Data Fixtures

### 1. Sample Session Data
```typescript
// src/test/fixtures/session-data.ts
export const validSessionData = {
  email: 'test@example.com',
  token: '12345|1234567890|abcdef123456',
  cookies: [
    { name: 'AWSALB', value: 'sample-alb-value' },
    { name: 'AWSALBCORS', value: 'sample-cors-value' }
  ],
  // ... other fields
}
```

### 2. API Response Fixtures
```typescript
// src/test/fixtures/api-responses.ts
export const tokenUpdateSuccessResponse = {
  newToken: '69232|1766907797|f3069323e00d81750c8590bb1f5f93b6'
}

export const tokenUpdateLogoutResponse = {
  logout: 1
}
```

## Test Execution Strategy

### 1. TDD Implementation Order
1. **Unit Tests First**: Start with service layer tests
2. **Integration Tests**: Build up to endpoint tests
3. **Database Tests**: Test data persistence layer
4. **End-to-End Tests**: Complete workflow validation
5. **Performance Tests**: Load and stress testing

### 2. Test Categories for CI/CD
- **Fast Tests** (`@unit`): Run on every commit
- **Integration Tests** (`@integration`, `@api`): Run on PR
- **Database Tests** (`@database`): Run with database setup
- **Cron Tests** (`@cron`): Run in scheduled pipelines

### 3. Coverage Requirements
- **Minimum Coverage**: 80% overall
- **Critical Paths**: 95% coverage for auth flows
- **Error Handling**: 90% coverage for error scenarios
- **Database Operations**: 85% coverage for data persistence

## Important Implementation Notes

### 1. Testing Environment Setup
- **Database**: Use test database instance or mock
- **External APIs**: Always mock aimharder.com calls
- **Secrets**: Use test environment variables
- **Timing**: Mock Date.now() for consistent test results

### 2. Test Isolation
- **No Shared State**: Each test should be independent
- **Database Cleanup**: Clear test data between tests
- **Mock Reset**: Reset all mocks in beforeEach/afterEach
- **Environment Reset**: Restore environment variables

### 3. Security Testing Considerations
- **Input Validation**: Test malicious payload handling
- **SQL Injection**: Verify parameterized queries
- **Authentication**: Test unauthorized access scenarios
- **Rate Limiting**: Verify abuse prevention mechanisms

### 4. Compatibility with Existing System
- **No Breaking Changes**: Ensure tests pass with current auth system
- **Backward Compatibility**: Test interaction with existing refresh mechanism
- **Data Migration**: Test with existing session data structures
- **API Versioning**: Consider future API changes

## Files to Create

1. **Test Configuration**:
   - `vitest.config.ts`
   - `src/test/setup.ts`

2. **Unit Tests**:
   - `modules/auth/api/services/aimharder-token-update.service.test.ts`
   - `modules/auth/api/services/supabase-session.service.test.ts` (additions)

3. **API Tests**:
   - `app/api/tokenUpdate/route.test.ts`

4. **Integration Tests**:
   - `modules/auth/api/integration/token-update.integration.test.ts`
   - `modules/auth/api/cron/token-update-cron.test.ts`

5. **Error Handling Tests**:
   - `modules/auth/api/error-handling/token-update-errors.test.ts`

6. **Performance Tests**:
   - `modules/auth/api/performance/token-update-performance.test.ts`

7. **Test Utilities**:
   - `src/test/mocks/aimharder-token-update-service.mock.ts`
   - `src/test/mocks/supabase.mock.ts`
   - `src/test/mocks/fetch.mock.ts`
   - `src/test/fixtures/session-data.ts`
   - `src/test/fixtures/api-responses.ts`

## Next Steps

1. **Setup Phase**: Install testing dependencies and configure Vitest
2. **Unit Test Phase**: Implement service layer tests following TDD
3. **API Test Phase**: Create endpoint tests with comprehensive scenarios
4. **Integration Phase**: Build end-to-end workflow tests
5. **Error Handling Phase**: Implement comprehensive error scenario tests
6. **Performance Phase**: Add load and stress tests
7. **CI/CD Integration**: Configure test execution in GitHub Actions

This comprehensive test plan ensures robust validation of the tokenUpdate feature while maintaining compatibility with the existing authentication system and following TDD best practices.