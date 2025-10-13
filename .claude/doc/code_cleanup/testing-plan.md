# Comprehensive Testing Plan for AimHarder WOD Bot

**Status**: DRAFT - NO IMPLEMENTATION YET
**Created**: 2025-10-04
**Coverage Goal**: 80% minimum
**Framework**: Vitest + React Testing Library

---

## Executive Summary

### Current State Analysis
- **Test Files Found**: ZERO ❌
- **Test Coverage**: 0% ❌
- **Testing Infrastructure**: NOT CONFIGURED ❌
- **Total TypeScript Files**: ~112 files
- **Module Files**: 64 files (auth, booking, prebooking, boxes)
- **Critical Paths**: Authentication, Booking Flow, Prebooking Scheduler

### Immediate Risks
⚠️ **CRITICAL**: No tests exist. Any refactoring could break production functionality.

### Recommended Approach
1. **Phase 0**: Setup testing infrastructure (2-3 hours)
2. **Phase 1**: Critical path tests first (5-7 hours)
3. **Phase 2**: Service layer coverage (4-6 hours)
4. **Phase 3**: Integration tests (3-4 hours)
5. **Phase 4**: Edge cases and error handling (2-3 hours)
6. **Phase 5**: Visual regression baseline (1-2 hours)

**Total Estimated Time**: 17-25 hours

---

## Phase 0: Testing Infrastructure Setup (REQUIRED)

### 0.1 Install Testing Dependencies

**Files to modify**:
- `package.json` - Add dev dependencies

**Dependencies needed**:
```json
{
  "devDependencies": {
    "@testing-library/react": "^15.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.2.1",
    "vitest": "^1.3.1",
    "jsdom": "^24.0.0",
    "msw": "^2.1.5",
    "@vitest/coverage-v8": "^1.3.1"
  }
}
```

### 0.2 Create Vitest Configuration

**New file**: `/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'app/api/**', // API routes tested via integration
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
```

### 0.3 Create Test Setup File

**New file**: `/tests/setup.ts`

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
```

### 0.4 Create Test Utilities Directory

**New directory structure**:
```
/tests
  /setup.ts
  /utils
    /test-utils.tsx      # Custom render function
    /mock-factories.ts   # Mock data factories
    /test-helpers.ts     # Common test helpers
  /mocks
    /handlers.ts         # MSW handlers
    /server.ts          # MSW server setup
```

### 0.5 Update package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

---

## Phase 1: Critical Path Tests (Priority 1)

### 1.1 Authentication Flow Tests

**Estimated Time**: 2-3 hours

#### 1.1.1 Auth Service Tests
**New file**: `/modules/auth/api/services/__tests__/auth.service.test.ts`

**Test cases**:
- ✓ Login with valid credentials succeeds
- ✓ Login with invalid credentials fails
- ✓ Login handles network errors gracefully
- ✓ Rate limiting blocks after max attempts
- ✓ Rate limiting resets after timeout
- ✓ Session check validates active session
- ✓ Session check returns false for invalid session
- ✓ isAuthenticated checks cookie correctly
- ✓ getCookieValue extracts cookie correctly
- ✓ getAimharderCookies returns all required cookies

**Key mocking needs**:
- Mock `fetch` API
- Mock `document.cookie`
- Mock rate limiter

**Coverage target**: 90%+

#### 1.1.2 useAuth Hook Tests
**New file**: `/modules/auth/hooks/__tests__/useAuth.hook.test.tsx`

**Test cases**:
- ✓ Login flow updates user state
- ✓ Login flow stores data in localStorage
- ✓ Login flow navigates to dashboard on success
- ✓ Login shows error on failure
- ✓ Logout clears user state
- ✓ Logout clears localStorage
- ✓ Logout navigates to login page
- ✓ checkAuthStatus validates session
- ✓ Token refresh starts on successful auth
- ✓ Token refresh stops on logout

**Key mocking needs**:
- Mock `authService`
- Mock `useRouter`
- Mock `localStorage`
- Mock `useTokenRefresh`

**Coverage target**: 85%+

#### 1.1.3 Login Component Tests
**New file**: `/modules/auth/pods/login/__tests__/login.component.test.tsx`

**Test cases**:
- ✓ Renders login form correctly
- ✓ Email validation shows error for invalid format
- ✓ Password validation requires minimum length
- ✓ Submit button disabled when form invalid
- ✓ Form submission calls login with correct data
- ✓ Loading state shown during submission
- ✓ Error message displayed on login failure
- ✓ Success redirects to dashboard

**Coverage target**: 80%+

---

### 1.2 Booking Flow Tests

**Estimated Time**: 3-4 hours

#### 1.2.1 Booking Service Tests
**New file**: `/modules/booking/api/services/__tests__/booking.service.test.ts`

**Test cases**:
- ✓ getBookings fetches bookings successfully
- ✓ getBookings validates response schema
- ✓ getBookings handles HTTP errors
- ✓ getBookings handles timeout
- ✓ getBookings handles network errors
- ✓ createBooking sends correct request format
- ✓ createBooking validates response
- ✓ createBooking handles booking conflicts
- ✓ cancelBooking sends correct request
- ✓ cancelBooking handles errors
- ✓ BookingApiError isRetryable logic works
- ✓ BookingApiError isAuthenticationError logic works

**Key mocking needs**:
- Mock `fetch` API
- Mock `AbortController`
- Mock `CookieService`

**Coverage target**: 90%+

#### 1.2.2 Booking Business Logic Tests
**New file**: `/modules/booking/business/__tests__/booking.business.test.ts`

**Test cases**:
- ✓ getBookingsForDay fetches and caches data
- ✓ getBookingsForDay retries on failure
- ✓ getBookingsForDay enhances booking data
- ✓ validateBookingEligibility checks status
- ✓ validateBookingEligibility checks time slots
- ✓ validateBookingEligibility checks user booking
- ✓ filterAndSortBookings applies filters
- ✓ getBookingStatistics calculates correctly
- ✓ Cache management works correctly
- ✓ Cache cleanup removes expired entries

**Key mocking needs**:
- Mock `BookingService`
- Mock `BookingMapper`

**Coverage target**: 85%+

#### 1.2.3 useBooking Hook Tests
**New file**: `/modules/booking/hooks/__tests__/useBooking.hook.test.tsx`

**Test cases**:
- ✓ Auto-fetch loads bookings on mount
- ✓ setDate triggers new fetch
- ✓ setBox triggers new fetch
- ✓ refetch forces cache bypass
- ✓ Cache returns cached data
- ✓ Error handling shows toast
- ✓ Loading states managed correctly
- ✓ Statistics calculated from bookings

**Coverage target**: 85%+

#### 1.2.4 Booking Context Tests
**New file**: `/modules/booking/hooks/__tests__/useBookingContext.hook.test.tsx`

**Test cases**:
- ✓ Provider initializes state correctly
- ✓ setLoading updates state
- ✓ setError updates state and loading
- ✓ setCurrentDay updates bookings
- ✓ setSelectedDate updates date
- ✓ setSelectedBox updates box
- ✓ Cache operations work correctly
- ✓ Computed values calculate correctly
- ✓ Throws error when used outside provider

**Coverage target**: 90%+

#### 1.2.5 Booking Utils Tests
**New file**: `/modules/booking/utils/__tests__/booking.utils.test.ts`

**Test cases**:
- ✓ formatDate handles various inputs
- ✓ formatDateForApi returns correct format
- ✓ parseTime extracts hours and minutes
- ✓ calculateCapacityPercentage handles edge cases
- ✓ getStatusColor returns correct colors
- ✓ isBookingAvailable logic works
- ✓ canUserBook checks all conditions
- ✓ filterBookings applies all filters
- ✓ sortBookingsByTime orders correctly
- ✓ isPastTimeSlot detects past times
- ✓ isToday compares dates correctly

**Coverage target**: 95%+

---

### 1.3 Prebooking Scheduler Tests

**Estimated Time**: 2-3 hours

#### 1.3.1 Prebooking Service Tests
**New file**: `/modules/prebooking/api/services/__tests__/prebooking.service.test.ts`

**Test cases**:
- ✓ create inserts prebooking
- ✓ findReadyToExecute queries correctly
- ✓ claimPrebooking prevents race conditions
- ✓ markCompleted updates status
- ✓ markFailed updates with error
- ✓ delete removes prebooking
- ✓ findByUser filters by email
- ✓ countPendingByUser returns count
- ✓ Error handling works correctly

**Key mocking needs**:
- Mock Supabase client
- Mock crypto.randomUUID

**Coverage target**: 85%+

#### 1.3.2 Prebooking Scheduler Tests
**New file**: `/modules/prebooking/business/__tests__/prebooking-scheduler.business.test.ts`

**Test cases**:
- ✓ execute finds and processes prebookings
- ✓ execute handles FIFO ordering
- ✓ execute stagger timing (50ms)
- ✓ execute handles booking success
- ✓ execute handles booking failure
- ✓ execute handles session not found
- ✓ execute returns correct results
- ✓ execute handles errors gracefully

**Key mocking needs**:
- Mock `preBookingService`
- Mock `bookingService`
- Mock `SupabaseSessionService`

**Coverage target**: 85%+

---

## Phase 2: Service Layer Tests (Priority 2)

### 2.1 Boxes Module Tests

**Estimated Time**: 2-3 hours

#### 2.1.1 Box Service Tests
**New file**: `/modules/boxes/api/services/__tests__/box.service.test.ts`

**Test cases**:
- ✓ upsertBox creates new box
- ✓ upsertBox returns existing box
- ✓ linkUserToBox creates relationship
- ✓ linkUserToBox handles duplicates
- ✓ getUserBoxes fetches with access info
- ✓ getBoxById fetches single box
- ✓ updateLastAccessed updates timestamp
- ✓ getUserDefaultBox returns last accessed

**Coverage target**: 85%+

#### 2.1.2 Box Detection Service Tests
**New file**: `/modules/boxes/api/services/__tests__/box-detection.service.test.ts`

**Test cases**:
- ✓ Detects box from HTML successfully
- ✓ Handles missing box information
- ✓ Parses contact info correctly
- ✓ Handles malformed HTML

**Coverage target**: 80%+

#### 2.1.3 useBoxes Hook Tests
**New file**: `/modules/boxes/hooks/__tests__/useBoxes.hook.test.tsx`

**Test cases**:
- ✓ Fetches user boxes on mount
- ✓ Updates boxes on refresh
- ✓ Handles loading states
- ✓ Handles errors
- ✓ Updates last accessed

**Coverage target**: 80%+

---

### 2.2 Core Infrastructure Tests

**Estimated Time**: 2-3 hours

#### 2.2.1 Supabase Client Tests
**New file**: `/core/database/__tests__/supabase.test.ts`

**Test cases**:
- ✓ Lazy initialization works
- ✓ Environment validation throws errors
- ✓ createIsolatedSupabaseAdmin creates unique instances
- ✓ Retry logic works on fetch failures
- ✓ Timeout handling works

**Coverage target**: 80%+

#### 2.2.2 Cookie Service Tests
**New file**: `/modules/auth/api/services/__tests__/cookie.service.test.ts`

**Test cases**:
- ✓ formatForRequest formats cookies correctly
- ✓ parseCookieString parses Set-Cookie header
- ✓ extractCookies gets all required cookies
- ✓ Handles missing cookies gracefully

**Coverage target**: 85%+

---

## Phase 3: Integration Tests (Priority 2)

### 3.1 API Route Integration Tests

**Estimated Time**: 3-4 hours

#### 3.1.1 Auth API Routes
**New file**: `/app/api/auth/aimharder/__tests__/route.test.ts`

**Test cases**:
- ✓ POST login with valid credentials
- ✓ POST login with invalid credentials
- ✓ POST login with rate limiting
- ✓ POST login validation errors
- ✓ GET session check
- ✓ DELETE logout

**Coverage target**: 80%+

#### 3.1.2 Booking API Routes
**New file**: `/app/api/booking/__tests__/route.test.ts`

**Test cases**:
- ✓ GET bookings with valid params
- ✓ POST create booking
- ✓ DELETE cancel booking
- ✓ Error handling

**Coverage target**: 75%+

#### 3.1.3 Prebooking API Routes
**New file**: `/app/api/prebooking/__tests__/route.test.ts`

**Test cases**:
- ✓ POST create prebooking
- ✓ GET user prebookings
- ✓ DELETE cancel prebooking
- ✓ Validation errors

**Coverage target**: 75%+

---

## Phase 4: Edge Cases and Error Handling (Priority 3)

### 4.1 Error Boundary Tests

**Estimated Time**: 1-2 hours

**Test scenarios**:
- ✓ Network failures
- ✓ Timeout errors
- ✓ Rate limiting
- ✓ Authentication errors
- ✓ Validation errors
- ✓ Concurrent operations
- ✓ Race conditions
- ✓ Invalid data formats

---

## Phase 5: Visual Regression Baseline (Priority 3)

### 5.1 Component Snapshot Tests

**Estimated Time**: 1-2 hours

**Components to snapshot**:
- Login form
- Booking card
- Week selector
- Booking dashboard
- Prebooking card

**Purpose**: Ensure UI doesn't change during refactoring

**Files**: Create `.test.tsx` alongside each component

---

## Test File Organization

```
/modules
  /auth
    /api
      /services
        /__tests__
          auth.service.test.ts
          cookie.service.test.ts
          aimharder-auth.service.test.ts
    /hooks
      /__tests__
        useAuth.hook.test.tsx
        useTokenRefresh.hook.test.tsx
    /pods
      /login
        /__tests__
          login.component.test.tsx

  /booking
    /api
      /services
        /__tests__
          booking.service.test.ts
      /mappers
        /__tests__
          booking.mapper.test.ts
    /business
      /__tests__
        booking.business.test.ts
    /hooks
      /__tests__
        useBooking.hook.test.tsx
        useBookingContext.hook.test.tsx
    /utils
      /__tests__
        booking.utils.test.ts
    /pods
      /booking-dashboard
        /__tests__
          booking-dashboard.component.test.tsx

  /prebooking
    /api
      /services
        /__tests__
          prebooking.service.test.ts
    /business
      /__tests__
        prebooking-scheduler.business.test.ts
    /hooks
      /__tests__
        useMyPrebookings.hook.test.tsx
        usePreBooking.hook.test.tsx

  /boxes
    /api
      /services
        /__tests__
          box.service.test.ts
          box-detection.service.test.ts
    /hooks
      /__tests__
        useBoxes.hook.test.tsx
        useBoxAccess.hook.test.tsx

/app
  /api
    /auth
      /aimharder
        /__tests__
          route.test.ts
    /booking
      /__tests__
        route.test.ts
    /prebooking
      /__tests__
        route.test.ts

/core
  /database
    /__tests__
      supabase.test.ts
  /api
    /__tests__
      client.test.ts

/tests
  /setup.ts
  /utils
    /test-utils.tsx
    /mock-factories.ts
    /test-helpers.ts
  /mocks
    /handlers.ts
    /server.ts
```

---

## Test Utilities to Create

### Custom Render Function
**File**: `/tests/utils/test-utils.tsx`

```typescript
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { BookingProvider } from '@/modules/booking/hooks/useBookingContext.hook'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withBookingProvider?: boolean
  withQueryClient?: boolean
  initialDate?: string
  initialBoxId?: string
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const {
    withBookingProvider = false,
    withQueryClient = false,
    initialDate,
    initialBoxId,
    ...renderOptions
  } = options || {}

  let Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>

  if (withQueryClient) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const PrevWrapper = Wrapper
    Wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <PrevWrapper>{children}</PrevWrapper>
      </QueryClientProvider>
    )
  }

  if (withBookingProvider) {
    const PrevWrapper = Wrapper
    Wrapper = ({ children }) => (
      <BookingProvider initialDate={initialDate} initialBoxId={initialBoxId}>
        <PrevWrapper>{children}</PrevWrapper>
      </BookingProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

export * from '@testing-library/react'
export { customRender as render }
```

### Mock Factories
**File**: `/tests/utils/mock-factories.ts`

```typescript
import { Booking, BookingDay, BookingStatus } from '@/modules/booking/models/booking.model'
import { PreBooking } from '@/modules/prebooking/models/prebooking.model'
import { BoxWithAccess } from '@/modules/boxes/models/box.model'

export const mockBookingFactory = (overrides?: Partial<Booking>): Booking => ({
  id: '1',
  classId: '100',
  timeSlot: {
    id: '1',
    startTime: '10:00',
    endTime: '11:00',
    time: '10:00 - 11:00',
  },
  class: {
    id: '100',
    name: 'CrossFit',
    color: '#FF6B6B',
  },
  capacity: {
    current: 5,
    limit: 10,
    percentage: 50,
    hasWaitlist: false,
  },
  status: BookingStatus.AVAILABLE,
  userBookingId: null,
  isIncludedInPlan: true,
  instructor: 'John Doe',
  ...overrides,
})

export const mockBookingDayFactory = (overrides?: Partial<BookingDay>): BookingDay => ({
  date: '2024-01-15',
  bookings: [mockBookingFactory()],
  aimharderDate: '20240115',
  ...overrides,
})

export const mockPreBookingFactory = (overrides?: Partial<PreBooking>): PreBooking => ({
  id: '1',
  userEmail: 'test@example.com',
  bookingData: {
    day: '20240115',
    familyId: '1',
    id: '100',
    insist: false,
  },
  availableAt: new Date('2024-01-15T10:00:00'),
  status: 'pending',
  boxId: '10122',
  createdAt: new Date(),
  ...overrides,
})

export const mockBoxFactory = (overrides?: Partial<BoxWithAccess>): BoxWithAccess => ({
  id: '1',
  box_id: '10122',
  subdomain: 'cerdanyola',
  name: 'CrossFit Cerdanyola',
  phone: '+34 123456789',
  email: 'info@crossfitcerdanyola.com',
  address: 'Test Address',
  website: 'https://cerdanyola.aimharder.com',
  logo_url: 'https://example.com/logo.png',
  base_url: 'https://cerdanyola.aimharder.com',
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-01-01T00:00:00',
  last_accessed_at: '2024-01-15T10:00:00',
  ...overrides,
})
```

### MSW Handlers
**File**: `/tests/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/aimharder', async ({ request }) => {
    const body = await request.json()
    // Mock login logic
    return HttpResponse.json({
      success: true,
      data: {
        user: { email: body.email, id: '1' },
        token: 'mock-token',
      },
    })
  }),

  // Booking endpoints
  http.get('/api/booking', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    })
  }),

  // Add more handlers as needed
]
```

---

## Coverage Targets by Module

| Module | Target | Priority | Rationale |
|--------|--------|----------|-----------|
| `auth/api/services` | 90% | High | Critical authentication logic |
| `auth/hooks` | 85% | High | User-facing auth flows |
| `booking/api/services` | 90% | High | Core booking functionality |
| `booking/business` | 85% | High | Business logic validation |
| `booking/hooks` | 85% | High | State management |
| `booking/utils` | 95% | Medium | Pure functions, easy to test |
| `prebooking/api/services` | 85% | High | Background job logic |
| `prebooking/business` | 85% | High | Scheduler logic |
| `boxes/api/services` | 85% | Medium | Box management |
| `core/database` | 80% | Medium | Infrastructure |
| API Routes | 75% | Medium | Integration layer |
| UI Components | 70% | Low | Snapshot testing |

---

## Success Criteria

### Before Refactoring Begins
- [ ] All Phase 0 setup completed
- [ ] All Phase 1 tests written and passing
- [ ] Coverage reaches 60% minimum
- [ ] CI/CD pipeline runs tests
- [ ] No test failures in main branch

### After Phase 1 Complete
- [ ] Auth flow fully tested
- [ ] Booking flow fully tested
- [ ] Prebooking scheduler tested
- [ ] Coverage reaches 70%

### After All Phases Complete
- [ ] Coverage reaches 80%+
- [ ] All critical paths tested
- [ ] Visual regression baseline established
- [ ] Test documentation complete
- [ ] Team trained on testing practices

---

## Execution Strategy

### Week 1: Foundation
- **Day 1-2**: Phase 0 (Setup)
- **Day 3**: Start Phase 1.1 (Auth tests)
- **Day 4**: Complete Phase 1.1
- **Day 5**: Phase 1.2 (Booking service tests)

### Week 2: Core Coverage
- **Day 1-2**: Complete Phase 1.2 (Booking tests)
- **Day 3**: Phase 1.3 (Prebooking tests)
- **Day 4-5**: Phase 2.1 (Boxes module)

### Week 3: Integration & Polish
- **Day 1-2**: Phase 2.2 (Core infrastructure)
- **Day 3-4**: Phase 3 (Integration tests)
- **Day 5**: Phase 4 & 5 (Edge cases + Visual regression)

---

## Key Testing Patterns

### 1. Service Layer Testing
```typescript
describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should login successfully with valid credentials', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { user: { email: 'test@example.com' } } })
    })

    // Act
    const result = await authService.login({ email: 'test@example.com', password: 'password' })

    // Assert
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
  })
})
```

### 2. Hook Testing
```typescript
describe('useAuth', () => {
  it('should update user state on successful login', async () => {
    // Arrange
    const { result } = renderHook(() => useAuth())

    // Act
    await act(async () => {
      await result.current.login({ email: 'test@example.com', password: 'password' })
    })

    // Assert
    expect(result.current.user).not.toBeNull()
    expect(result.current.user?.email).toBe('test@example.com')
  })
})
```

### 3. Component Testing
```typescript
describe('LoginComponent', () => {
  it('should submit form with valid data', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<LoginComponent />)

    // Act
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /login/i }))

    // Assert
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      })
    })
  })
})
```

---

## Important Notes for Implementation

### ⚠️ CRITICAL REMINDERS

1. **DO NOT modify any production code** while writing tests
2. **Test behavior, not implementation** - Tests should survive refactoring
3. **Use RTL queries in order**: getByRole > getByLabelText > getByText > getByTestId
4. **Avoid brittle selectors** - Don't test internal state or implementation details
5. **Mock at boundaries** - Mock external services, not internal modules
6. **Test async code properly** - Use waitFor, findBy queries, act()
7. **Clean up after tests** - Restore mocks, clear timers, cleanup renders

### Testing Anti-Patterns to Avoid
❌ Testing implementation details
❌ Testing internal state directly
❌ Fragile selectors (class names, IDs not meant for testing)
❌ Not waiting for async operations
❌ Shared mutable state between tests
❌ Testing third-party libraries
❌ Snapshot testing everything

### Testing Best Practices
✅ Test user-visible behavior
✅ Use semantic queries (role, label, text)
✅ Wait for async operations to complete
✅ Isolate tests (no shared state)
✅ Mock external dependencies only
✅ Keep tests simple and readable
✅ Use descriptive test names

---

## Risk Assessment

### High Risk Areas (Test First)
1. **Authentication Flow** - Session management, rate limiting
2. **Booking Creation** - Race conditions, validation
3. **Prebooking Scheduler** - FIFO ordering, timing, concurrency
4. **Token Refresh** - Background processes, timing

### Medium Risk Areas
1. **Box Detection** - HTML parsing edge cases
2. **Cache Management** - Staleness, invalidation
3. **Error Handling** - User feedback, retry logic

### Low Risk Areas
1. **UI Components** - Visual consistency
2. **Utility Functions** - Pure functions
3. **Constants** - No logic

---

## Questions to Clarify

### Infrastructure Questions
1. Should tests run in CI/CD pipeline? (Recommended: Yes)
2. Should coverage reports be generated? (Recommended: Yes)
3. Should tests block deployment on failure? (Recommended: Yes for main branch)
4. What's the tolerance for flaky tests? (Recommended: Zero tolerance)

### Testing Strategy Questions
1. Should we test API routes as integration tests or unit tests? (Recommended: Both)
2. How should we handle external API dependencies (AimHarder API)? (Recommended: MSW mocks)
3. Should we test Supabase integration? (Recommended: Mock Supabase client)
4. What's the priority: coverage % or critical path coverage? (Recommended: Critical paths first)

### Execution Questions
1. Can development pause for testing setup? (Recommended: Yes, 1 week)
2. Should existing bugs be fixed before testing? (Recommended: No, tests will find them)
3. Who will write the tests? (Recommended: Original developer or dedicated QA)
4. When should refactoring start? (Recommended: After 70% coverage)

---

## Next Steps

1. **Review this plan** with the team
2. **Answer clarification questions** above
3. **Get approval** to proceed with Phase 0
4. **Allocate time** for testing implementation
5. **Begin Phase 0** setup immediately
6. **Track progress** using `.claude/sessions/context_session_testing.md`

---

**Last Updated**: 2025-10-04
**Status**: Awaiting Approval
**Prepared By**: Frontend Test Engineer Agent
