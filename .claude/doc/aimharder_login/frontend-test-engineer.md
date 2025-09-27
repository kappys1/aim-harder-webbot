# Frontend Test Engineer Implementation Plan
## Aimharder Login Authentication Service

## Overview

This plan outlines comprehensive test cases for implementing a real authentication service that integrates with aimharder.com's external API. The implementation follows TDD principles with extensive mocking strategies for external dependencies.

## Current State Analysis

### Existing Infrastructure
- **Mock API Client**: Currently using a simple mock implementation in `core/api/client.ts`
- **Auth Module Structure**: Well-organized feature-based architecture with services, models, and hooks
- **No Testing Framework**: Missing Vitest, React Testing Library, and related testing dependencies
- **Zod Validation**: Already implemented for type safety

### Key Implementation Challenges
1. **External API Integration**: Real HTTP calls to `https://login.aimharder.com/`
2. **HTML Response Parsing**: Extracting tokens from iframe src URLs
3. **Cookie Management**: Handling AWSALB, AWSALBCORS, PHPSESSID, amhrdrauth cookies
4. **Supabase Integration**: Session persistence in database
5. **Form Data Encoding**: application/x-www-form-urlencoded content type

## Test Setup Requirements

### Dependencies to Add
```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "msw": "^2.0.0",
    "axios": "^1.7.0"
  }
}
```

### Test Configuration Files
- `vitest.config.ts` - Vitest configuration with jsdom
- `src/test/setup.ts` - Test setup with jest-dom matchers
- `src/test/utils.tsx` - Custom render utilities with providers

## Test Implementation Plan

### 1. Unit Tests - Aimharder API Service

**File**: `modules/auth/api/services/aimharder.service.test.ts`

#### Test Categories:

**A. Request Construction Tests**
```typescript
describe('AimharderService - Request Construction', () => {
  it('should construct proper form data with all required fields', () => {
    // Test loginfingerprint generation
    // Test form data encoding
    // Test header configuration
  });

  it('should generate unique login fingerprint on each request', () => {
    // Test fingerprint uniqueness
    // Test fingerprint format validation
  });
});
```

**B. HTML Response Parsing Tests**
```typescript
describe('AimharderService - HTML Parsing', () => {
  it('should extract token from iframe src URL successfully', () => {
    // Mock HTML response with iframe
    // Test token extraction regex
    // Test URL parameter parsing
  });

  it('should handle malformed HTML responses gracefully', () => {
    // Test missing iframe
    // Test invalid iframe src
    // Test empty response body
  });

  it('should extract multiple tokens if present', () => {
    // Test scenarios with multiple iframes
    // Test token precedence rules
  });
});
```

**C. Cookie Management Tests**
```typescript
describe('AimharderService - Cookie Management', () => {
  it('should extract all required cookies from response', () => {
    // Test AWSALB cookie extraction
    // Test AWSALBCORS cookie extraction
    // Test PHPSESSID cookie extraction
    // Test amhrdrauth cookie extraction
  });

  it('should store cookies for subsequent requests', () => {
    // Test cookie persistence
    // Test cookie attachment to future requests
  });

  it('should handle missing or expired cookies', () => {
    // Test partial cookie responses
    // Test cookie expiration handling
  });
});
```

**D. Error Handling Tests**
```typescript
describe('AimharderService - Error Handling', () => {
  it('should handle network failures gracefully', () => {
    // Test connection timeout
    // Test network unreachable
    // Test DNS resolution failures
  });

  it('should handle authentication failures', () => {
    // Test invalid credentials response
    // Test account locked scenarios
    // Test rate limiting responses
  });

  it('should handle server errors', () => {
    // Test 500 internal server error
    // Test 502 bad gateway
    // Test 503 service unavailable
  });
});
```

### 2. Integration Tests - Complete Auth Flow

**File**: `modules/auth/pods/login/login.integration.test.tsx`

#### Test Scenarios:

**A. Successful Authentication Flow**
```typescript
describe('Login Integration - Success Flow', () => {
  it('should complete full authentication flow successfully', async () => {
    // Setup MSW mock for aimharder API
    // Mock Supabase session creation
    // Render login form
    // Fill credentials and submit
    // Verify cookie extraction
    // Verify token storage
    // Verify navigation to dashboard
    // Verify Supabase session persistence
  });

  it('should maintain session across page refreshes', async () => {
    // Mock existing Supabase session
    // Test session restoration
    // Verify user state persistence
  });
});
```

**B. Authentication Failure Scenarios**
```typescript
describe('Login Integration - Failure Scenarios', () => {
  it('should handle invalid credentials gracefully', async () => {
    // Mock 401 response from aimharder
    // Test error message display
    // Test form remains interactive
    // Test no navigation occurs
  });

  it('should handle network failures with retry capability', async () => {
    // Mock network timeout
    // Test error message display
    // Test retry functionality
    // Test loading state management
  });

  it('should handle malformed API responses', async () => {
    // Mock corrupted HTML response
    // Test error boundary activation
    // Test graceful degradation
  });
});
```

### 3. Hook Tests - useLogin Hook

**File**: `modules/auth/pods/login/hooks/useLogin.hook.test.tsx`

#### Test Categories:

**A. State Management Tests**
```typescript
describe('useLogin Hook - State Management', () => {
  it('should initialize with correct default state', () => {
    // Test initial loading state
    // Test initial error state
    // Test initial user state
  });

  it('should update loading state during authentication', async () => {
    // Test loading true during request
    // Test loading false after response
    // Test loading state during errors
  });

  it('should manage error state correctly', async () => {
    // Test error clearing on new attempts
    // Test error persistence until resolved
    // Test different error types
  });
});
```

**B. Authentication Logic Tests**
```typescript
describe('useLogin Hook - Authentication Logic', () => {
  it('should call aimharder service with correct parameters', async () => {
    // Mock aimharder service
    // Test service call with form data
    // Verify request parameters
  });

  it('should handle successful authentication response', async () => {
    // Mock successful service response
    // Test token storage
    // Test user state update
    // Test navigation trigger
  });

  it('should handle authentication errors appropriately', async () => {
    // Mock service errors
    // Test error state updates
    // Test error message setting
  });
});
```

### 4. Component Tests - Login Form Components

**File**: `modules/auth/pods/login/components/login-form.test.tsx`

#### Test Scenarios:

**A. Form Interaction Tests**
```typescript
describe('LoginForm - User Interactions', () => {
  it('should validate email format correctly', async () => {
    // Test invalid email formats
    // Test valid email acceptance
    // Test error message display
  });

  it('should validate password requirements', async () => {
    // Test minimum length validation
    // Test password strength indicators
    // Test error message display
  });

  it('should submit form with valid data', async () => {
    // Fill valid form data
    // Test form submission
    // Verify loading state
    // Verify service call
  });

  it('should prevent submission with invalid data', async () => {
    // Test invalid email submission
    // Test short password submission
    // Verify no service call occurs
  });
});
```

**B. Accessibility Tests**
```typescript
describe('LoginForm - Accessibility', () => {
  it('should have proper ARIA labels and roles', () => {
    // Test form role
    // Test input labels
    // Test error announcements
  });

  it('should support keyboard navigation', async () => {
    // Test tab navigation
    // Test enter key submission
    // Test escape key handling
  });

  it('should announce loading and error states to screen readers', async () => {
    // Test aria-live regions
    // Test status announcements
  });
});
```

### 5. Service Integration Tests - Supabase Session Management

**File**: `modules/auth/api/services/session.service.test.ts`

#### Test Categories:

**A. Session Persistence Tests**
```typescript
describe('SessionService - Persistence', () => {
  it('should store session data in Supabase after successful login', async () => {
    // Mock Supabase client
    // Test session creation
    // Test user data storage
    // Test token storage
  });

  it('should retrieve existing session on app initialization', async () => {
    // Mock existing Supabase session
    // Test session retrieval
    // Test user state restoration
  });

  it('should clear session data on logout', async () => {
    // Mock existing session
    // Test session destruction
    // Test cleanup verification
  });
});
```

**B. Session Validation Tests**
```typescript
describe('SessionService - Validation', () => {
  it('should validate session expiration', async () => {
    // Mock expired session
    // Test expiration detection
    // Test automatic cleanup
  });

  it('should handle invalid session data gracefully', async () => {
    // Mock corrupted session data
    // Test validation logic
    // Test fallback behavior
  });
});
```

## Mock Strategies

### 1. External API Mocking (MSW)

```typescript
// src/test/mocks/handlers.ts
export const handlers = [
  http.post('https://login.aimharder.com/', ({ request }) => {
    // Mock successful login response
    return HttpResponse.html(`
      <html>
        <body>
          <iframe src="https://dashboard.aimharder.com?token=mock-token-123&user=test"></iframe>
        </body>
      </html>
    `, {
      headers: {
        'Set-Cookie': [
          'AWSALB=mock-alb-value; Path=/',
          'AWSALBCORS=mock-cors-value; Path=/',
          'PHPSESSID=mock-session-id; Path=/',
          'amhrdrauth=mock-auth-token; Path=/'
        ]
      }
    });
  }),

  // Mock network failure scenario
  http.post('https://login.aimharder.com/', () => {
    return HttpResponse.error();
  }, { once: true }),

  // Mock invalid credentials scenario
  http.post('https://login.aimharder.com/', () => {
    return HttpResponse.html('<html><body>Invalid credentials</body></html>', {
      status: 401
    });
  }, { once: true })
];
```

### 2. Supabase Mocking

```typescript
// src/test/mocks/supabase.ts
export const createMockSupabaseClient = () => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    setSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ data: [], error: null }),
  select: vi.fn().mockResolvedValue({ data: [], error: null }),
  update: vi.fn().mockResolvedValue({ data: [], error: null }),
});
```

### 3. Router Mocking

```typescript
// src/test/mocks/next-router.ts
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));
```

## Test Data Fixtures

### 1. Authentication Request Data

```typescript
// src/test/fixtures/auth.fixtures.ts
export const validLoginCredentials = {
  email: 'test@example.com',
  password: 'validPassword123'
};

export const invalidLoginCredentials = {
  email: 'invalid-email',
  password: '123'
};

export const mockAimharderResponse = {
  html: `
    <html>
      <body>
        <iframe src="https://dashboard.aimharder.com?token=mock-token-123&user=testuser&refresh=refresh-token-456"></iframe>
      </body>
    </html>
  `,
  cookies: {
    'AWSALB': 'mock-alb-value',
    'AWSALBCORS': 'mock-cors-value',
    'PHPSESSID': 'mock-session-id',
    'amhrdrauth': 'mock-auth-token'
  }
};
```

### 2. Supabase Session Data

```typescript
export const mockSupabaseSession = {
  access_token: 'mock-supabase-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() + 3600000,
  user: {
    id: 'mock-user-id',
    email: 'test@example.com',
    user_metadata: {
      name: 'Test User'
    }
  }
};
```

## Test Utilities

### 1. Custom Render Function

```typescript
// src/test/utils/render.tsx
export function renderWithProviders(
  ui: React.ReactElement,
  options: {
    initialAuthState?: Partial<AuthState>;
    supabaseClient?: any;
  } = {}
) {
  const { initialAuthState, supabaseClient = createMockSupabaseClient() } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SupabaseProvider client={supabaseClient}>
        <AuthProvider initialState={initialAuthState}>
          {children}
        </AuthProvider>
      </SupabaseProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
```

### 2. Wait Utilities

```typescript
// src/test/utils/wait.ts
export const waitForAuthCompletion = () =>
  waitFor(() => expect(screen.queryByText('Signing in...')).not.toBeInTheDocument());

export const waitForErrorMessage = (message: string) =>
  waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
```

## Test Coverage Requirements

### Coverage Targets
- **Unit Tests**: 90%+ coverage for services and utilities
- **Integration Tests**: 85%+ coverage for authentication flow
- **Component Tests**: 80%+ coverage for UI components
- **Hook Tests**: 95%+ coverage for custom hooks

### Critical Path Coverage
1. **Authentication Flow**: 100% coverage
2. **Error Handling**: 100% coverage
3. **Session Management**: 95% coverage
4. **Form Validation**: 90% coverage

## Performance Test Considerations

### 1. Authentication Response Time
```typescript
it('should complete authentication within acceptable time limits', async () => {
  const startTime = performance.now();

  // Perform authentication
  await user.click(submitButton);
  await waitForAuthCompletion();

  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(5000); // 5 second limit
});
```

### 2. Memory Leak Prevention
```typescript
it('should not create memory leaks during authentication flow', async () => {
  // Test component unmounting
  // Test event listener cleanup
  // Test timer cleanup
  // Test subscription cleanup
});
```

## Security Test Considerations

### 1. Credential Handling
```typescript
it('should not log sensitive information', async () => {
  const consoleSpy = vi.spyOn(console, 'log');

  await authService.login(validCredentials);

  // Verify no password in logs
  expect(consoleSpy).not.toHaveBeenCalledWith(
    expect.stringContaining(validCredentials.password)
  );
});
```

### 2. Cookie Security
```typescript
it('should handle cookies securely', async () => {
  // Test secure cookie attributes
  // Test HttpOnly cookie handling
  // Test SameSite cookie policies
});
```

## Implementation Dependencies

### Required Files to Create/Modify

1. **Test Setup Files**:
   - `vitest.config.ts` - Vitest configuration
   - `src/test/setup.ts` - Test environment setup
   - `src/test/utils.tsx` - Custom render utilities

2. **Service Files to Create**:
   - `modules/auth/api/services/aimharder.service.ts` - Real aimharder API integration
   - `modules/auth/api/services/session.service.ts` - Supabase session management
   - `modules/auth/api/services/cookie.service.ts` - Cookie management utilities

3. **Test Files to Create**:
   - All test files mentioned in the implementation plan above

4. **Mock Files**:
   - `src/test/mocks/handlers.ts` - MSW request handlers
   - `src/test/mocks/supabase.ts` - Supabase client mocks
   - `src/test/fixtures/auth.fixtures.ts` - Test data fixtures

### Files to Modify

1. **Update API Client**: `core/api/client.ts` - Replace mock with real HTTP client
2. **Update Auth Service**: `modules/auth/api/services/auth.service.ts` - Use new aimharder service
3. **Update Login Hook**: `modules/auth/pods/login/hooks/useLogin.hook.tsx` - Add session management
4. **Update Package.json**: Add testing dependencies

## Key Testing Patterns to Follow

### 1. Test Naming Convention
```typescript
// Pattern: should [expected behavior] when [condition]
it('should extract authentication token when HTML contains valid iframe', () => {});
it('should display error message when credentials are invalid', () => {});
it('should redirect to dashboard when authentication succeeds', () => {});
```

### 2. Arrange-Act-Assert Pattern
```typescript
it('should handle login success', async () => {
  // Arrange
  const mockCredentials = { email: 'test@example.com', password: 'password' };
  const mockResponse = createMockAuthResponse();

  // Act
  const result = await authService.login(mockCredentials);

  // Assert
  expect(result.success).toBe(true);
  expect(result.user).toBeDefined();
});
```

### 3. Error Test Pattern
```typescript
it('should handle authentication errors gracefully', async () => {
  // Arrange
  server.use(
    http.post('https://login.aimharder.com/', () => {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    })
  );

  // Act & Assert
  await expect(authService.login(invalidCredentials))
    .rejects.toThrow('Authentication failed');
});
```

## Questions for Clarification

Based on my analysis of the current codebase and requirements, I need clarification on:

1. **Fingerprint Generation**: How should the `loginfingerprint` hash be generated? Should it be random, user-specific, or time-based?

2. **Token Storage Strategy**: Where should the extracted tokens be stored? localStorage, sessionStorage, or only in Supabase?

3. **Session Refresh Logic**: How should token refresh be handled when the initial token expires?

4. **Error Recovery**: What retry mechanisms should be implemented for network failures?

5. **Cookie Persistence**: Should cookies be stored in browser storage for offline access or only maintained during the session?

6. **Supabase Schema**: What database schema should be used for storing session data and user information?

7. **Development vs Production**: Should there be different authentication flows for development and production environments?

8. **Rate Limiting**: How should the application handle rate limiting from the aimharder API?

## Notes for Implementation Team

### Critical Implementation Points

1. **Security First**: Never log sensitive information (passwords, tokens)
2. **Error Handling**: Implement comprehensive error boundaries and fallback UI
3. **Performance**: Use React.memo and useMemo for expensive operations
4. **Accessibility**: Ensure all form interactions are keyboard accessible
5. **Type Safety**: Use Zod schemas for all external API responses
6. **Testing**: Write tests before implementation (TDD approach)

### Development Workflow

1. Set up testing dependencies first
2. Create mock services and test utilities
3. Implement tests for core authentication service
4. Build real aimharder service following tests
5. Create integration tests for complete flow
6. Update existing components to use new service
7. Add comprehensive error handling and validation
8. Performance and security audit

This comprehensive test plan ensures robust, maintainable, and secure authentication implementation with excellent test coverage and clear testing patterns for the team to follow.