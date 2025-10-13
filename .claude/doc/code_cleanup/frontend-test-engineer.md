# Frontend Test Engineer - Code Cleanup Testing Strategy

**Date**: 2025-10-03
**Session**: code_cleanup
**Engineer**: frontend-test-engineer
**Status**: TESTING STRATEGY COMPLETE

---

## EXECUTIVE SUMMARY

This document provides a comprehensive testing strategy to ensure **ZERO BEHAVIOR CHANGES** during the major refactoring outlined in the code cleanup project. The strategy prioritizes **characterization testing** (capturing current behavior before changes) and **incremental validation** (testing each refactoring phase independently).

### Critical Success Criteria:
- ✅ **100% feature parity** after refactoring
- ✅ **80% code coverage maintained** throughout all phases
- ✅ **No UI/UX changes** (constraint from requirements)
- ✅ **All existing behaviors captured** in tests before refactoring
- ✅ **CI/CD gates** prevent regressions from reaching production

### Risk Level: **MEDIUM-HIGH**
- **HIGH RISK**: Business layer elimination without safety net
- **MEDIUM RISK**: Service consolidation affecting multiple modules
- **MANAGED RISK**: With comprehensive testing strategy outlined below

---

## 1. PRE-REFACTORING TESTS (CHARACTERIZATION TESTS)

### 1.1 What Are Characterization Tests?

**Definition**: Tests that document and verify *existing behavior* of the system, regardless of whether that behavior is "correct" or "optimal". These tests serve as a **safety net** during refactoring.

**Goal**: Capture ALL current behaviors (including edge cases and quirks) BEFORE making any code changes.

### 1.2 Coverage Goals (Pre-Refactoring)

| Category | Target Coverage | Priority |
|----------|----------------|----------|
| **Services** (API calls, Supabase) | 90% | CRITICAL |
| **Business Logic** (current business layer) | 85% | CRITICAL |
| **Hooks** (useBooking, useAuth, etc.) | 85% | HIGH |
| **Utils** (pure functions) | 95% | MEDIUM |
| **Components** (UI behavior) | 70% | MEDIUM |
| **API Routes** (/api/booking, etc.) | 80% | HIGH |

**Overall Target**: 80% (minimum, as per project requirements)

### 1.3 Which Behaviors Must Be Captured?

#### A. Authentication Module
```typescript
// modules/auth/__tests__/auth.characterization.test.ts

describe('Auth Module - Characterization Tests', () => {
  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      // Capture: Successful login returns user data + cookies
    });

    it('should fail login with invalid credentials', async () => {
      // Capture: Error handling for bad credentials
    });

    it('should store session in Supabase after successful login', async () => {
      // Capture: Session persistence behavior
    });

    it('should fallback to hardcoded email when header missing', async () => {
      // Capture: Current behavior (even if it's a smell)
      const email = headers.get('x-user-email') || 'alexsbd1@gmail.com';
      // This MUST work the same way after refactoring
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token every 25 minutes', async () => {
      // Capture: Current interval-based refresh logic
    });

    it('should retry refresh 3 times on failure', async () => {
      // Capture: Retry behavior (even though it will move to React Query)
    });
  });

  describe('Session Management', () => {
    it('should validate session expiry correctly', async () => {
      // Capture: SupabaseSessionService.isSessionValid() logic
    });

    it('should handle concurrent session updates', async () => {
      // Capture: Race condition handling
    });
  });
});
```

#### B. Booking Module (Most Complex)
```typescript
// modules/booking/__tests__/booking.characterization.test.ts

describe('Booking Module - Characterization Tests', () => {
  describe('Cache Behavior (Triple Cache System)', () => {
    it('should use BookingContext cache first', async () => {
      // Capture: Cache priority order
    });

    it('should fallback to BookingBusiness cache', async () => {
      // Capture: Current multi-layer cache logic
    });

    it('should bypass cache when force refresh', async () => {
      // Capture: Cache invalidation
    });

    it('should generate cache keys consistently', () => {
      const key1 = BookingUtils.getCacheKey('2025-01-15', 'box123');
      const key2 = BookingUtils.getCacheKey('2025-01-15', 'box123');
      expect(key1).toBe(key2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests 3 times with exponential backoff', async () => {
      // Capture: BookingBusiness retry behavior
      // Even though this will move to React Query, we need to verify
      // the NEW implementation has the SAME retry behavior
    });

    it('should not retry on 4xx errors', async () => {
      // Capture: Current error classification
    });
  });

  describe('Booking Creation (API Route Logic)', () => {
    it('should create booking successfully when available', async () => {
      // Capture: BOOKED state flow
    });

    it('should create prebooking when ERROR_EARLY_BOOKING', async () => {
      // Capture: Complex orchestration in route.ts lines 200+
      // This is CRITICAL - 200 lines of logic that will move
    });

    it('should validate prebooking limits (max 5 per user)', async () => {
      // Capture: Business rule in API route
    });

    it('should schedule QStash job for prebooking', async () => {
      // Capture: Integration with QStash
    });

    it('should handle ERROR_MAX_BOOKINGS correctly', async () => {
      // Capture: Another state flow
    });
  });

  describe('Data Transformations (Mappers)', () => {
    it('should map API response to domain model correctly', () => {
      // Capture: BookingMapper.mapBookingDay()
      // Snapshot testing recommended here
    });

    it('should extract availability date from error message', () => {
      // Capture: BookingMapper.extractAvailabilityDate()
      // This has parsing logic that shouldn't change
    });
  });
});
```

#### C. Prebooking Module
```typescript
// modules/prebooking/__tests__/prebooking.characterization.test.ts

describe('Prebooking Module - Characterization Tests', () => {
  describe('Scheduler Orchestration', () => {
    it('should execute ready prebookings in correct order', async () => {
      // Capture: PreBookingScheduler.execute() flow
    });

    it('should claim prebookings to prevent duplicates', async () => {
      // Capture: Claiming logic
    });

    it('should mark completed/failed correctly', async () => {
      // Capture: Status updates
    });
  });

  describe('Error Handling', () => {
    it('should parse Aimharder error messages correctly', async () => {
      // Capture: ErrorParser.parseError()
      // 194 lines of parsing logic - needs snapshot tests
    });
  });
});
```

#### D. Boxes Module
```typescript
// modules/boxes/__tests__/boxes.characterization.test.ts

describe('Boxes Module - Characterization Tests', () => {
  describe('Box Detection', () => {
    it('should parse boxes from HTML correctly', async () => {
      // Capture: BoxDetectionService HTML parsing
      // Use fixture HTML files
    });

    it('should validate box access permissions', async () => {
      // Capture: BoxAccessService logic
    });
  });
});
```

### 1.4 Test Data Fixtures

**Create fixture files for consistent test data**:

```
__tests__/
  fixtures/
    auth/
      login-success-response.json
      login-error-response.json
      session-valid.json
      session-expired.json
    booking/
      bookings-response-full.json
      bookings-response-available.json
      create-booking-success.json
      create-booking-early-error.json
      create-booking-max-error.json
    prebooking/
      prebookings-ready.json
      prebooking-claim-response.json
    boxes/
      aimharder-boxes-html.html
      boxes-with-access.json
```

### 1.5 Snapshot Testing Strategy

**Use snapshots for complex data transformations**:

```typescript
// modules/booking/__tests__/booking.mapper.snapshot.test.ts

describe('BookingMapper - Snapshot Tests', () => {
  it('should map booking API response consistently', () => {
    const apiResponse = require('../__tests__/fixtures/bookings-response-full.json');
    const domainModel = BookingMapper.mapBookingDay(apiResponse);

    // Snapshot the output
    expect(domainModel).toMatchSnapshot();
  });

  it('should extract availability date consistently', () => {
    const errorMessages = [
      'Booking will be available at 2025-01-15 20:00',
      'Error: Early booking. Available from 2025-01-15T20:00:00Z',
    ];

    errorMessages.forEach(msg => {
      const result = BookingMapper.extractAvailabilityDate(msg);
      expect(result).toMatchSnapshot();
    });
  });
});
```

---

## 2. TEST CATEGORIES & STRUCTURE

### 2.1 Test Organization

```
modules/{module}/
  __tests__/
    # CHARACTERIZATION (Pre-refactoring)
    {module}.characterization.test.ts

    # UNIT TESTS (Services, Utils)
    unit/
      services/
        {service}.service.test.ts
      utils/
        {util}.utils.test.ts
      mappers/
        {mapper}.mapper.test.ts

    # INTEGRATION TESTS (Hooks, Contexts)
    integration/
      hooks/
        use{Module}.hook.test.tsx
        use{Module}Context.hook.test.tsx
      actions/  # NEW - for Server Actions
        {action}.action.test.ts

    # E2E TESTS (Critical User Flows)
    e2e/
      {feature}.e2e.test.ts

    # FIXTURES
    fixtures/
      {data}.json
```

### 2.2 Unit Tests (Services & Utils)

#### A. Service Testing Template

```typescript
// modules/booking/__tests__/unit/services/booking.service.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingService } from '@/modules/booking/api/services/booking.service';

describe('BookingService', () => {
  let service: BookingService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new BookingService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getBookings', () => {
    it('should fetch bookings with correct URL and headers', async () => {
      const mockResponse = { bookings: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const params = { day: '2025-01-15', box: 'box123' };
      await service.getBookings(params);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/booking'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include user email header from localStorage', async () => {
      // Test current behavior (localStorage access)
      localStorage.setItem('user-email', 'test@example.com');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] }),
      });

      await service.getBookings({ day: '2025-01-15', box: 'box123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-user-email': 'test@example.com',
          }),
        })
      );
    });

    it('should handle network timeout', async () => {
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(
        service.getBookings({ day: '2025-01-15', box: 'box123' })
      ).rejects.toThrow('Timeout');
    });

    it('should validate response schema with Zod', async () => {
      const invalidResponse = { invalid: 'data' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse,
      });

      // Should throw Zod validation error
      await expect(
        service.getBookings({ day: '2025-01-15', box: 'box123' })
      ).rejects.toThrow();
    });
  });

  describe('createBooking', () => {
    it('should create booking with correct payload', async () => {
      const request = {
        classId: '123',
        date: '2025-01-15',
        boxId: 'box123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await service.createBooking(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });

    it('should handle 4xx errors without retry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad Request' }),
      });

      await expect(
        service.createBooking({ classId: '123', date: '2025-01-15' })
      ).rejects.toThrow();

      // Should NOT retry on 4xx
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
```

#### B. Utils Testing Template

```typescript
// modules/booking/__tests__/unit/utils/booking.utils.test.ts

import { describe, it, expect } from 'vitest';
import { BookingUtils } from '@/modules/booking/utils/booking.utils';

describe('BookingUtils', () => {
  describe('getCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const key1 = BookingUtils.getCacheKey('2025-01-15', 'box123');
      const key2 = BookingUtils.getCacheKey('2025-01-15', 'box123');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = BookingUtils.getCacheKey('2025-01-15', 'box123');
      const key2 = BookingUtils.getCacheKey('2025-01-16', 'box123');
      expect(key1).not.toBe(key2);
    });
  });

  describe('calculateOccupancy', () => {
    it('should calculate occupancy percentage correctly', () => {
      const result = BookingUtils.calculateOccupancy(7, 10);
      expect(result).toBe(70);
    });

    it('should handle zero capacity', () => {
      const result = BookingUtils.calculateOccupancy(0, 0);
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const result = BookingUtils.calculateOccupancy(1, 3);
      expect(result).toBe(33.33);
    });
  });
});
```

#### C. Mapper Testing Template

```typescript
// modules/booking/__tests__/unit/mappers/booking.mapper.test.ts

import { describe, it, expect } from 'vitest';
import { BookingMapper } from '@/modules/booking/api/mappers/booking.mapper';

describe('BookingMapper', () => {
  describe('mapBookingDay', () => {
    it('should map API response to domain model', () => {
      const apiResponse = {
        date: '2025-01-15',
        bookings: [
          {
            id: '1',
            class_name: 'CrossFit',
            time: '10:00',
            capacity: 10,
            booked: 7,
          },
        ],
      };

      const result = BookingMapper.mapBookingDay(apiResponse);

      expect(result).toEqual({
        date: '2025-01-15',
        bookings: [
          expect.objectContaining({
            id: '1',
            className: 'CrossFit',
            time: '10:00',
            capacity: 10,
            bookedCount: 7,
          }),
        ],
      });
    });

    it('should use snapshot for complex transformations', () => {
      const apiResponse = require('../../fixtures/bookings-response-full.json');
      const result = BookingMapper.mapBookingDay(apiResponse);
      expect(result).toMatchSnapshot();
    });
  });

  describe('extractAvailabilityDate', () => {
    it('should extract date from error message', () => {
      const message = 'Booking available at 2025-01-15 20:00';
      const result = BookingMapper.extractAvailabilityDate(message);
      expect(result).toBe('2025-01-15T20:00:00');
    });

    it('should handle various date formats', () => {
      const testCases = [
        {
          input: 'Available from 2025-01-15T20:00:00Z',
          expected: '2025-01-15T20:00:00',
        },
        {
          input: 'Error: Early booking. Try at 15/01/2025 20:00',
          expected: '2025-01-15T20:00:00',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(BookingMapper.extractAvailabilityDate(input)).toBe(expected);
      });
    });

    it('should return null for invalid messages', () => {
      expect(BookingMapper.extractAvailabilityDate('Invalid')).toBeNull();
    });
  });
});
```

### 2.3 Integration Tests (Hooks & Contexts)

#### A. Hook Testing with React Query (POST-REFACTORING)

```typescript
// modules/booking/__tests__/integration/hooks/useBookingsQuery.hook.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBookingsQuery } from '@/modules/booking/hooks/useBookingsQuery.hook';
import { bookingService } from '@/modules/booking/api/services/booking.service';

// Create wrapper with React Query provider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }, // Disable retry in tests
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useBookingsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch bookings successfully', async () => {
    const mockBookings = {
      date: '2025-01-15',
      bookings: [{ id: '1', className: 'CrossFit' }],
    };

    vi.spyOn(bookingService, 'getBookings').mockResolvedValueOnce(mockBookings);

    const { result } = renderHook(
      () => useBookingsQuery('2025-01-15', 'box123'),
      { wrapper: createWrapper() }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockBookings);
    expect(bookingService.getBookings).toHaveBeenCalledWith({
      day: '2025-01-15',
      box: 'box123',
      _: expect.any(Number),
    });
  });

  it('should handle errors correctly', async () => {
    const error = new Error('Network error');
    vi.spyOn(bookingService, 'getBookings').mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useBookingsQuery('2025-01-15', 'box123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should use cache when params are the same', async () => {
    const mockBookings = { date: '2025-01-15', bookings: [] };
    vi.spyOn(bookingService, 'getBookings').mockResolvedValue(mockBookings);

    const wrapper = createWrapper();

    // First render
    const { result: result1 } = renderHook(
      () => useBookingsQuery('2025-01-15', 'box123'),
      { wrapper }
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Second render with same params
    const { result: result2 } = renderHook(
      () => useBookingsQuery('2025-01-15', 'box123'),
      { wrapper }
    );

    // Should use cached data (no loading state)
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.data).toEqual(mockBookings);

    // Service called only ONCE (cached)
    expect(bookingService.getBookings).toHaveBeenCalledTimes(1);
  });

  it('should not fetch when params are invalid', () => {
    vi.spyOn(bookingService, 'getBookings');

    renderHook(
      () => useBookingsQuery('', 'box123'), // Empty date
      { wrapper: createWrapper() }
    );

    // Should not call service
    expect(bookingService.getBookings).not.toHaveBeenCalled();
  });
});
```

#### B. Mutation Hook Testing

```typescript
// modules/booking/__tests__/integration/hooks/useCreateBooking.hook.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateBooking } from '@/modules/booking/hooks/useBookingsQuery.hook';
import { createBookingAction } from '@/modules/booking/actions/create-booking.action';

vi.mock('@/modules/booking/actions/create-booking.action');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useCreateBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create booking successfully', async () => {
    const mockResult = { success: true, booking: { id: '123' } };
    vi.mocked(createBookingAction).mockResolvedValueOnce(mockResult);

    const { result } = renderHook(
      () => useCreateBooking(),
      { wrapper: createWrapper() }
    );

    const bookingData = { classId: '123', date: '2025-01-15' };
    result.current.mutate(bookingData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResult);
    expect(createBookingAction).toHaveBeenCalledWith(bookingData);
  });

  it('should handle errors', async () => {
    const error = new Error('Booking failed');
    vi.mocked(createBookingAction).mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useCreateBooking(),
      { wrapper: createWrapper() }
    );

    result.current.mutate({ classId: '123', date: '2025-01-15' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should invalidate queries on success', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(createBookingAction).mockResolvedValueOnce({
      success: true,
      booking: { id: '123' },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    result.current.mutate({ classId: '123', date: '2025-01-15' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['bookings'],
    });
  });
});
```

#### C. Context Testing (PRE-REFACTORING)

```typescript
// modules/booking/__tests__/integration/hooks/useBookingContext.hook.test.tsx

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BookingProvider, useBookingContext } from '@/modules/booking/hooks/useBookingContext.hook';

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <BookingProvider>{children}</BookingProvider>
  );
}

describe('useBookingContext', () => {
  it('should provide initial state', () => {
    const { result } = renderHook(() => useBookingContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toEqual({
      currentDay: null,
      selectedDate: expect.any(String),
      selectedBoxId: expect.any(String),
      isLoading: false,
      error: null,
      cache: expect.any(Map),
    });
  });

  it('should update selected date', () => {
    const { result } = renderHook(() => useBookingContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.actions.setSelectedDate('2025-01-15');
    });

    expect(result.current.state.selectedDate).toBe('2025-01-15');
  });

  it('should cache booking data', () => {
    const { result } = renderHook(() => useBookingContext(), {
      wrapper: createWrapper(),
    });

    const mockBookingDay = {
      date: '2025-01-15',
      bookings: [],
    };

    act(() => {
      result.current.actions.cacheDay('2025-01-15', 'box123', mockBookingDay);
    });

    const cacheKey = 'booking_2025-01-15_box123';
    expect(result.current.state.cache.has(cacheKey)).toBe(true);
    expect(result.current.state.cache.get(cacheKey)).toEqual(mockBookingDay);
  });

  it('should compute statistics correctly', () => {
    const { result } = renderHook(() => useBookingContext(), {
      wrapper: createWrapper(),
    });

    const mockBookingDay = {
      date: '2025-01-15',
      bookings: [
        { id: '1', capacity: 10, bookedCount: 7, status: 'available' },
        { id: '2', capacity: 10, bookedCount: 10, status: 'full' },
      ],
    };

    act(() => {
      result.current.actions.setCurrentDay(mockBookingDay);
    });

    expect(result.current.computed.hasBookings).toBe(true);
    expect(result.current.computed.availableBookings).toHaveLength(1);
  });
});
```

### 2.4 E2E Tests (Critical User Flows)

#### A. End-to-End Test Setup

```typescript
// vitest.config.e2e.ts

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'e2e',
    include: ['**/*.e2e.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.e2e.ts'],
    globals: true,
  },
});
```

```typescript
// vitest.setup.e2e.ts

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;
```

#### B. Critical Flow: Login to Booking

```typescript
// modules/booking/__tests__/e2e/booking-flow.e2e.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingDashboard } from '@/modules/booking/pods/booking-dashboard/booking-dashboard.component';

describe('Booking Flow - E2E', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Setup authenticated user
    localStorage.setItem('user-email', 'test@example.com');

    // Mock initial data fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '2025-01-15',
        bookings: [
          {
            id: '1',
            className: 'CrossFit',
            time: '10:00',
            capacity: 10,
            bookedCount: 7,
            status: 'available',
          },
        ],
      }),
    });
  });

  it('should complete full booking flow', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDashboard />
      </QueryClientProvider>
    );

    // 1. Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('CrossFit')).toBeInTheDocument();
    });

    // 2. User selects a different date
    const datePicker = screen.getByLabelText('Select date');
    await user.click(datePicker);
    await user.click(screen.getByText('16')); // Select Jan 16

    // 3. Verify new data fetched
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('day=2025-01-16'),
        expect.any(Object)
      );
    });

    // 4. User clicks book button
    const bookButton = screen.getByRole('button', { name: /book/i });
    await user.click(bookButton);

    // 5. Verify booking confirmation
    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
    });
  });

  it('should handle early booking error and create prebooking', async () => {
    const user = userEvent.setup();

    // Mock early booking error response
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ // Initial fetch
        ok: true,
        json: async () => ({ date: '2025-01-15', bookings: [] }),
      })
      .mockResolvedValueOnce({ // Booking attempt
        ok: false,
        status: 400,
        json: async () => ({
          error: 'ERROR_EARLY_BOOKING',
          message: 'Booking available at 2025-01-15 20:00',
        }),
      })
      .mockResolvedValueOnce({ // Prebooking creation
        ok: true,
        json: async () => ({
          success: true,
          state: 'PREBOOKING_CREATED',
        }),
      });

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /book/i })).toBeInTheDocument();
    });

    const bookButton = screen.getByRole('button', { name: /book/i });
    await user.click(bookButton);

    // Verify prebooking created
    await waitFor(() => {
      expect(screen.getByText(/prebooking created/i)).toBeInTheDocument();
      expect(screen.getByText(/scheduled for 20:00/i)).toBeInTheDocument();
    });
  });

  it('should prevent double booking', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDashboard />
      </QueryClientProvider>
    );

    const bookButton = screen.getByRole('button', { name: /book/i });

    // Click twice rapidly
    await user.click(bookButton);
    await user.click(bookButton);

    // Only ONE booking request should be made
    await waitFor(() => {
      const bookingCalls = (global.fetch as any).mock.calls.filter(
        (call: any) => call[0].includes('POST')
      );
      expect(bookingCalls).toHaveLength(1);
    });
  });
});
```

### 2.5 Visual Regression Tests (UI Preservation)

**CONSTRAINT**: No UI/UX changes allowed during refactoring.

#### Setup Visual Regression Testing

```bash
npm install --save-dev @storybook/test-runner playwright
npx playwright install
```

```typescript
// modules/booking/__tests__/visual/booking-dashboard.visual.test.ts

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BookingDashboard } from '@/modules/booking/pods/booking-dashboard/booking-dashboard.component';

describe('BookingDashboard - Visual Regression', () => {
  it('should match snapshot - default state', () => {
    const { container } = render(<BookingDashboard />);
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot - loading state', () => {
    const { container } = render(
      <BookingDashboard initialLoading={true} />
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot - error state', () => {
    const { container } = render(
      <BookingDashboard initialError="Failed to load" />
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot - with bookings', () => {
    const mockBookings = [
      { id: '1', className: 'CrossFit', time: '10:00', status: 'available' },
    ];

    const { container } = render(
      <BookingDashboard initialBookings={mockBookings} />
    );
    expect(container).toMatchSnapshot();
  });
});
```

---

## 3. REFACTORING SAFETY NET

### 3.1 How to Ensure No Behavior Changes?

#### A. Test-Driven Refactoring (TDR) Process

```
PHASE 0: Write Tests (BEFORE refactoring)
  ├─ Characterization tests (capture current behavior)
  ├─ Unit tests (services, utils, mappers)
  ├─ Integration tests (hooks, contexts)
  └─ E2E tests (critical flows)

PHASE 1: Infrastructure Refactoring
  ├─ Create new patterns (Server Actions, React Query hooks)
  ├─ Run OLD tests against NEW code
  ├─ Verify 100% pass rate
  └─ ONLY THEN remove old code

PHASE 2: Service Consolidation
  ├─ Merge services (6 auth → 3, 3 boxes → 1-2)
  ├─ Update imports in tests
  ├─ Run full test suite
  └─ Fix any regressions

PHASE 3: Component Refactoring
  ├─ Split mega-components
  ├─ Run visual regression tests
  ├─ Verify snapshots match
  └─ Update snapshots ONLY if intentional
```

#### B. Parallel Implementation Strategy

**DON'T**: Delete old code first
**DO**: Create new code alongside old, migrate incrementally

```typescript
// PHASE 1: Both exist in parallel

// OLD (keep temporarily)
// modules/booking/business/booking.business.ts
export class BookingBusiness { /* ... */ }

// NEW (create alongside)
// modules/booking/actions/create-booking.action.ts
'use server';
export async function createBookingAction() { /* ... */ }

// PHASE 2: Feature flag to switch between implementations
const USE_NEW_ARCHITECTURE = process.env.NEXT_PUBLIC_USE_NEW_ARCH === 'true';

export function useBooking() {
  if (USE_NEW_ARCHITECTURE) {
    return useBookingsQuery(); // New React Query hook
  } else {
    return useBookingLegacy(); // Old context/business hook
  }
}

// PHASE 3: After 100% verification, remove old code
// modules/booking/business/booking.business.ts ❌ DELETE
```

### 3.2 What Should We Snapshot?

#### A. Data Transformations (Mappers)

```typescript
// Test ALL mappers with snapshots
describe('BookingMapper', () => {
  it('should map API response consistently', () => {
    const apiResponse = require('../fixtures/bookings-full.json');
    expect(BookingMapper.mapBookingDay(apiResponse)).toMatchSnapshot();
  });
});
```

#### B. Complex Business Logic Outputs

```typescript
// modules/booking/__tests__/unit/business/booking-orchestration.snapshot.test.ts

describe('Booking Orchestration - Snapshots', () => {
  it('should handle early booking error flow', async () => {
    const input = {
      classId: '123',
      date: '2025-01-15',
      boxId: 'box123',
    };

    const result = await handleEarlyBooking(input, mockError, mockSession);

    // Snapshot the ENTIRE result structure
    expect(result).toMatchSnapshot();
  });
});
```

#### C. Component Render Output

```typescript
// modules/booking/__tests__/visual/booking-card.snapshot.test.tsx

describe('BookingCard - Snapshots', () => {
  it('should render correctly for each status', () => {
    const statuses = ['available', 'full', 'booked', 'waitlist'];

    statuses.forEach(status => {
      const { container } = render(
        <BookingCard booking={{ ...mockBooking, status }} />
      );
      expect(container).toMatchSnapshot(`status-${status}`);
    });
  });
});
```

### 3.3 Feature Parity Validation

#### Parity Checklist (Must Pass Before Removing Old Code)

```typescript
// __tests__/parity/booking-feature-parity.test.ts

describe('Booking Feature Parity', () => {
  describe('OLD vs NEW Implementation', () => {
    it('should return same data for getBookings', async () => {
      // OLD implementation
      const oldBusiness = new BookingBusiness();
      const oldResult = await oldBusiness.getBookingsForDay('2025-01-15', 'box123');

      // NEW implementation
      const newResult = await fetchBookingsViaReactQuery('2025-01-15', 'box123');

      // Results MUST match exactly
      expect(newResult).toEqual(oldResult);
    });

    it('should have same retry behavior', async () => {
      // Mock 2 failures, then success
      mockFetch
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce({ ok: true, json: async () => mockData });

      // OLD: Manual retry in BookingBusiness
      const oldResult = await oldBusiness.getBookingsForDay('2025-01-15', 'box123');

      // NEW: React Query retry
      const newResult = await fetchBookingsViaReactQuery('2025-01-15', 'box123');

      // Both should succeed after retries
      expect(oldResult).toEqual(newResult);
      expect(mockFetch).toHaveBeenCalledTimes(6); // 3 for old, 3 for new
    });

    it('should have same cache behavior', async () => {
      // OLD: Manual cache
      const old1 = await oldBusiness.getBookingsForDay('2025-01-15', 'box123');
      const old2 = await oldBusiness.getBookingsForDay('2025-01-15', 'box123');

      // NEW: React Query cache
      const new1 = await fetchBookingsViaReactQuery('2025-01-15', 'box123');
      const new2 = await fetchBookingsViaReactQuery('2025-01-15', 'box123');

      // Both should use cache (only 1 fetch each)
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 for old, 1 for new
      expect(old1).toEqual(new1);
      expect(old2).toEqual(new2);
    });
  });
});
```

---

## 4. TEST MIGRATION STRATEGY

### 4.1 Moving from Business Layer to Server Actions

#### BEFORE (Business Layer Test)

```typescript
// modules/booking/__tests__/unit/business/booking.business.test.ts

describe('BookingBusiness', () => {
  it('should create prebooking on early booking error', async () => {
    const business = new BookingBusiness();

    // Mock service to return early booking error
    vi.spyOn(bookingService, 'createBooking').mockResolvedValue({
      state: 'ERROR_EARLY_BOOKING',
      error: 'Available at 2025-01-15 20:00',
    });

    const result = await business.createBooking({
      classId: '123',
      date: '2025-01-15',
    });

    expect(result.state).toBe('PREBOOKING_CREATED');
    expect(result.scheduledAt).toBe('2025-01-15T20:00:00');
  });
});
```

#### AFTER (Server Action Test)

```typescript
// modules/booking/__tests__/integration/actions/create-booking.action.test.ts

import { describe, it, expect, vi } from 'vitest';
import { createBookingAction } from '@/modules/booking/actions/create-booking.action';
import { bookingService } from '@/modules/booking/api/services/booking.service';
import { prebookingService } from '@/modules/prebooking/api/services/prebooking.service';

vi.mock('@/modules/booking/api/services/booking.service');
vi.mock('@/modules/prebooking/api/services/prebooking.service');
vi.mock('@/modules/auth/utils/session.utils');

describe('createBookingAction', () => {
  it('should create prebooking on early booking error', async () => {
    // Mock session
    vi.mocked(getServerSession).mockResolvedValue({
      userId: 'user123',
      email: 'test@example.com',
      cookies: [],
    });

    // Mock early booking error
    vi.mocked(bookingService.createBooking).mockResolvedValue({
      state: 'ERROR_EARLY_BOOKING',
      error: 'Available at 2025-01-15 20:00',
    });

    vi.mocked(prebookingService.create).mockResolvedValue({
      id: 'prebooking123',
      status: 'pending',
    });

    // Call Server Action
    const result = await createBookingAction({
      classId: '123',
      date: '2025-01-15',
    });

    // SAME assertions as before
    expect(result.success).toBe(true);
    expect(result.state).toBe('PREBOOKING_CREATED');
    expect(result.availableAt).toBe('2025-01-15T20:00:00');

    // Verify orchestration
    expect(prebookingService.create).toHaveBeenCalledWith({
      userId: 'user123',
      scheduledAt: '2025-01-15T20:00:00',
      bookingData: { classId: '123', date: '2025-01-15' },
    });
  });

  it('should validate input with Zod schema', async () => {
    const invalidInput = { classId: '' }; // Missing required fields

    await expect(
      createBookingAction(invalidInput)
    ).rejects.toThrow(); // Zod validation error
  });

  it('should require authentication', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const result = await createBookingAction({
      classId: '123',
      date: '2025-01-15',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});
```

### 4.2 Hook Testing with React Query

#### Migration Pattern

```typescript
// BEFORE: Testing manual cache hook
describe('useBooking', () => {
  it('should use cached data when available', async () => {
    const { result } = renderHook(() => useBooking(), {
      wrapper: BookingProvider,
    });

    // First fetch
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const firstData = result.current.bookingDay;

    // Second fetch (should use cache)
    act(() => result.current.refetch());
    const secondData = result.current.bookingDay;

    expect(firstData).toBe(secondData); // Same reference (cached)
  });
});

// AFTER: Testing React Query hook
describe('useBookingsQuery', () => {
  it('should use cached data when queryKey is the same', async () => {
    const wrapper = createQueryWrapper();

    // First hook instance
    const { result: result1 } = renderHook(
      () => useBookingsQuery('2025-01-15', 'box123'),
      { wrapper }
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    const firstData = result1.current.data;

    // Second hook instance with SAME queryKey
    const { result: result2 } = renderHook(
      () => useBookingsQuery('2025-01-15', 'box123'),
      { wrapper }
    );

    // Should immediately have data (from cache)
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.data).toBe(firstData); // Same reference

    // Service called only ONCE
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

### 4.3 Service Consolidation Test Updates

#### BEFORE (6 Auth Services)

```typescript
// __tests__/unit/services/auth.service.test.ts
import { AuthService } from '@/modules/auth/api/services/auth.service';

// __tests__/unit/services/aimharder-auth.service.test.ts
import { AimharderAuthService } from '@/modules/auth/api/services/aimharder-auth.service';

// __tests__/unit/services/aimharder-refresh.service.test.ts
import { AimharderRefreshService } from '@/modules/auth/api/services/aimharder-refresh.service';

// ... 3 more files
```

#### AFTER (3 Consolidated Services)

```typescript
// __tests__/unit/services/aimharder-client.service.test.ts
import { AimharderClientService } from '@/modules/auth/api/services/aimharder-client.service';

describe('AimharderClientService', () => {
  // Merge all login, refresh, cookie, HTML parsing tests here
  describe('login', () => { /* ... */ });
  describe('refresh', () => { /* ... */ });
  describe('parseCookies', () => { /* ... */ });
  describe('parseBoxesFromHTML', () => { /* ... */ });
});

// __tests__/unit/services/session.service.test.ts
import { SessionService } from '@/modules/auth/api/services/session.service';

describe('SessionService', () => {
  // All Supabase session CRUD tests
  describe('getSession', () => { /* ... */ });
  describe('createSession', () => { /* ... */ });
  describe('updateSession', () => { /* ... */ });
  describe('deleteSession', () => { /* ... */ });
  describe('isSessionValid', () => { /* ... */ });
});

// __tests__/unit/utils/auth.utils.test.ts
import { parseCookie, validateEmail } from '@/modules/auth/utils/auth.utils';

describe('Auth Utils', () => {
  // Pure helper functions
});
```

**Migration Checklist**:
- [ ] Copy all test cases from old service files
- [ ] Update imports to new service
- [ ] Run tests to verify 100% pass
- [ ] Delete old service test files
- [ ] Update test count (should be same or more)

---

## 5. CI/CD INTEGRATION

### 5.1 What Should Block Merges?

#### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # BLOCKER 1: Linting
      - name: Run ESLint
        run: npm run lint
        continue-on-error: false

      # BLOCKER 2: Type checking
      - name: TypeScript type check
        run: npx tsc --noEmit
        continue-on-error: false

      # BLOCKER 3: Unit tests
      - name: Run unit tests
        run: npm run test:unit
        continue-on-error: false

      # BLOCKER 4: Integration tests
      - name: Run integration tests
        run: npm run test:integration
        continue-on-error: false

      # BLOCKER 5: E2E tests
      - name: Run E2E tests
        run: npm run test:e2e
        continue-on-error: false

      # BLOCKER 6: Coverage threshold
      - name: Check coverage
        run: |
          npm run test:coverage
          npm run coverage:check -- --lines 80 --functions 80 --branches 75 --statements 80
        continue-on-error: false

      # BLOCKER 7: Visual regression (snapshots)
      - name: Check snapshots
        run: npm run test:snapshots
        continue-on-error: false

      # Upload coverage report
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true

      # Notify on failure
      - name: Notify on failure
        if: failure()
        run: echo "Tests failed! PR cannot be merged."
```

### 5.2 Coverage Thresholds

#### package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --run --config vitest.config.unit.ts",
    "test:integration": "vitest --run --config vitest.config.integration.ts",
    "test:e2e": "vitest --run --config vitest.config.e2e.ts",
    "test:coverage": "vitest --run --coverage",
    "test:snapshots": "vitest --run --update=false",
    "test:watch": "vitest --watch",
    "coverage:check": "vitest --coverage --coverage.reporter=json-summary && node scripts/check-coverage.js"
  }
}
```

#### Vitest Coverage Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // THRESHOLDS (CI BLOCKERS)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },

      // Exclude from coverage
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.ts',
        '*.d.ts',
        'app/layout.tsx', // Next.js root layout
        'middleware.ts', // Next.js middleware
      ],

      // Include in coverage
      include: [
        'modules/**/*.ts',
        'modules/**/*.tsx',
        'common/**/*.ts',
        'common/**/*.tsx',
        'app/api/**/*.ts',
      ],
    },
  },
});
```

### 5.3 Test Execution Order

#### Sequential Execution (Fast Feedback)

```json
{
  "scripts": {
    "test:ci": "npm run test:lint && npm run test:types && npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

**Rationale**:
1. **Lint** (fastest, catches syntax errors)
2. **Type check** (fast, catches type errors)
3. **Unit tests** (fast, tests isolated logic)
4. **Integration tests** (medium, tests module interactions)
5. **E2E tests** (slow, tests full user flows)

**Optimization**: Run unit + integration in parallel if CI allows
```bash
npm run test:unit & npm run test:integration && wait
```

### 5.4 Test Environment Variables

```bash
# .env.test

# Database (use test Supabase project)
NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-key

# Feature flags
NEXT_PUBLIC_USE_NEW_ARCH=false  # Start with old, toggle during migration

# Disable external services in tests
NEXT_PUBLIC_ENABLE_QSTASH=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Test-specific settings
NODE_ENV=test
VITEST=true
```

---

## 6. PHASE-SPECIFIC TESTING REQUIREMENTS

### Phase 0: Preparation (BEFORE any refactoring)

**Required Tests** (100% must pass before proceeding):

```
✓ Characterization tests for ALL modules
  ├─ Auth module (login, refresh, session)
  ├─ Booking module (fetch, create, cancel, cache, retry)
  ├─ Prebooking module (scheduler, error parsing)
  └─ Boxes module (detection, access validation)

✓ Service unit tests (90% coverage)
  ├─ Auth services (6 services)
  ├─ Booking service
  ├─ Prebooking service
  └─ Box services (3 services)

✓ Utils unit tests (95% coverage)
  ├─ Booking utils
  ├─ Date utils
  └─ Validation utils

✓ E2E tests for critical flows
  ├─ Login → Dashboard → Booking
  ├─ Early booking → Prebooking creation
  └─ Error handling

✓ Baseline snapshots
  ├─ All mapper outputs
  ├─ All component renders
  └─ All complex business logic outputs
```

**Success Criteria**:
- [ ] 80%+ overall coverage
- [ ] All tests green
- [ ] Snapshots committed to git
- [ ] CI pipeline passing

---

### Phase 1: Infrastructure (Middleware, React Query, Server Actions)

**New Tests Required**:

```typescript
// middleware.test.ts
describe('Next.js Middleware', () => {
  it('should validate x-user-email header', async () => { /* ... */ });
  it('should add CORS headers', async () => { /* ... */ });
  it('should block unauthenticated requests', async () => { /* ... */ });
});

// React Query setup tests
describe('QueryClient Configuration', () => {
  it('should have correct default options', () => { /* ... */ });
  it('should retry 3 times with exponential backoff', () => { /* ... */ });
});

// Server Action template tests
describe('Server Action Template', () => {
  it('should validate inputs with Zod', async () => { /* ... */ });
  it('should require authentication', async () => { /* ... */ });
  it('should revalidate paths on success', async () => { /* ... */ });
});
```

**Regression Tests**:
- [ ] Run ALL Phase 0 tests
- [ ] Verify middleware doesn't break existing routes
- [ ] Verify React Query provider doesn't break existing hooks

**Success Criteria**:
- [ ] All Phase 0 tests still pass
- [ ] New infrastructure tests pass
- [ ] Coverage maintained or improved

---

### Phase 2: Booking Module Migration

**Pre-Migration**:
```bash
npm run test:unit -- modules/booking  # Capture baseline
```

**During Migration**:

**A. Server Action Tests**
```typescript
// create-booking.action.test.ts
describe('createBookingAction', () => {
  it('should handle all booking states', async () => { /* ... */ });
  it('should create prebooking on early error', async () => { /* ... */ });
  it('should validate limits', async () => { /* ... */ });
});
```

**B. React Query Hook Tests**
```typescript
// useBookingsQuery.hook.test.tsx
describe('useBookingsQuery', () => {
  it('should fetch, cache, and retry correctly', async () => { /* ... */ });
  it('should match OLD useBooking behavior', async () => { /* ... */ });
});
```

**C. Parity Tests** (CRITICAL)
```typescript
// booking-parity.test.ts
describe('Booking Feature Parity', () => {
  it('OLD vs NEW: same data', async () => { /* ... */ });
  it('OLD vs NEW: same retry behavior', async () => { /* ... */ });
  it('OLD vs NEW: same cache behavior', async () => { /* ... */ });
});
```

**Post-Migration**:
```bash
npm run test:unit -- modules/booking  # Must match baseline count
npm run test:integration -- modules/booking
npm run test:e2e -- booking
```

**Success Criteria**:
- [ ] All parity tests pass (OLD === NEW)
- [ ] Coverage maintained (85%+)
- [ ] E2E tests pass
- [ ] Visual snapshots unchanged

---

### Phase 3: Auth Services Consolidation

**Pre-Consolidation**:
```bash
# Count tests
npm run test -- modules/auth --reporter=verbose | grep "Test Files"
# Example output: "Test Files  8 passed (8)"
```

**Migration**:
1. Create `aimharder-client.service.test.ts` (merge 4 service tests)
2. Create `session.service.test.ts` (consolidate Supabase tests)
3. Create `auth.utils.test.ts` (extract pure function tests)

**Post-Consolidation**:
```bash
# MUST have same or MORE tests
npm run test -- modules/auth --reporter=verbose | grep "Test Files"
# Example output: "Test Files  3 passed (3)" (consolidated files)
# But test COUNT should be >= original
```

**Success Criteria**:
- [ ] Same number of test cases (or more)
- [ ] Coverage maintained (90%+)
- [ ] All auth flows work (login, refresh, logout)

---

### Phase 4: Prebooking & Boxes Migration

**Apply same pattern as Phase 2**:
- [ ] Create Server Actions + tests
- [ ] Create React Query hooks + tests
- [ ] Run parity tests
- [ ] Verify E2E flows

---

### Phase 5: Cleanup

**Regression Suite**:
```bash
# Run EVERYTHING
npm run test:all
npm run test:coverage
npm run test:e2e
```

**Final Validation**:
- [ ] Remove old code
- [ ] Update snapshots (if needed)
- [ ] Run full test suite
- [ ] Verify coverage >= 80%
- [ ] Check bundle size reduction

---

### Phase 6: Component Refactoring

**Visual Regression** (CRITICAL - NO UI CHANGES ALLOWED):

```typescript
// booking-dashboard.visual.test.ts
describe('BookingDashboard - Visual Regression', () => {
  it('BEFORE refactor: snapshot', () => {
    const { container } = render(<BookingDashboardOld />);
    expect(container).toMatchSnapshot('before-refactor');
  });

  it('AFTER refactor: MUST match BEFORE', () => {
    const { container } = render(<BookingDashboardNew />);
    expect(container).toMatchSnapshot('after-refactor');
  });
});
```

**Snapshot Comparison**:
```bash
npm run test:snapshots -- --update=false  # MUST NOT update
```

**Success Criteria**:
- [ ] All visual snapshots match
- [ ] Component count increased (split mega-components)
- [ ] Props interfaces unchanged (API compatibility)
- [ ] No visual changes in browser preview

---

## 7. TESTING TOOLS & SETUP

### 7.1 Install Testing Dependencies

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @vitest/coverage-v8 \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  jsdom \
  @vitejs/plugin-react \
  msw
```

### 7.2 Vitest Configuration Files

#### vitest.config.ts (Main Config)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],

    include: [
      '**/__tests__/**/*.test.{ts,tsx}',
      '**/*.test.{ts,tsx}',
    ],

    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    testTimeout: 10000, // 10s for async tests
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

#### vitest.config.unit.ts

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'unit',
      include: ['**/__tests__/unit/**/*.test.{ts,tsx}'],
      testTimeout: 5000, // Unit tests should be fast
    },
  })
);
```

#### vitest.config.integration.ts

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'integration',
      include: ['**/__tests__/integration/**/*.test.{ts,tsx}'],
      testTimeout: 15000, // Integration tests can be slower
    },
  })
);
```

#### vitest.config.e2e.ts

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'e2e',
      include: ['**/__tests__/e2e/**/*.test.{ts,tsx}'],
      testTimeout: 30000, // E2E tests can take longer
    },
  })
);
```

### 7.3 Setup File

#### vitest.setup.ts

```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (for lazy loading)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
```

### 7.4 Test Utilities

#### test-utils.tsx (Custom Render with Providers)

```typescript
// __tests__/utils/test-utils.tsx

import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement, ReactNode } from 'react';

// Create a custom render that includes providers
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retry in tests
        gcTime: 0, // Disable cache
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

function AllTheProviders({ children, queryClient }: AllTheProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
```

### 7.5 Mock Service Worker (MSW) Setup

```typescript
// __tests__/mocks/handlers.ts

import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock booking endpoints
  http.get('/api/booking', ({ request }) => {
    const url = new URL(request.url);
    const day = url.searchParams.get('day');
    const box = url.searchParams.get('box');

    return HttpResponse.json({
      date: day,
      bookings: [
        {
          id: '1',
          className: 'CrossFit',
          time: '10:00',
          capacity: 10,
          bookedCount: 7,
          status: 'available',
        },
      ],
    });
  }),

  http.post('/api/booking', async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      booking: {
        id: 'new-booking-123',
        ...body,
      },
    });
  }),

  // Mock auth endpoints
  http.post('/api/auth/aimharder', async ({ request }) => {
    const body = await request.json();

    if (body.email === 'valid@example.com') {
      return HttpResponse.json({
        success: true,
        user: { email: body.email },
        cookies: [],
      });
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),
];
```

```typescript
// __tests__/mocks/server.ts

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// vitest.setup.ts (add to existing setup)

import { server } from './__tests__/mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());
```

---

## 8. METRICS & MONITORING

### 8.1 Coverage Badges

Add to README.md:

```markdown
[![Coverage](https://codecov.io/gh/username/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/username/repo)
```

### 8.2 Test Execution Time Tracking

```typescript
// scripts/track-test-performance.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function trackTestPerformance() {
  const start = Date.now();

  try {
    await execAsync('npm run test:ci');
    const duration = Date.now() - start;

    console.log(`✓ All tests passed in ${duration}ms`);

    // Save to metrics file
    const fs = require('fs');
    const metrics = {
      date: new Date().toISOString(),
      duration,
      success: true,
    };

    fs.appendFileSync(
      'test-metrics.jsonl',
      JSON.stringify(metrics) + '\n'
    );
  } catch (error) {
    console.error('✗ Tests failed');
    process.exit(1);
  }
}

trackTestPerformance();
```

### 8.3 Flaky Test Detection

```typescript
// scripts/detect-flaky-tests.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function detectFlakyTests(runs = 10) {
  const results: Record<string, { pass: number; fail: number }> = {};

  for (let i = 0; i < runs; i++) {
    console.log(`Run ${i + 1}/${runs}`);

    try {
      const { stdout } = await execAsync('npm run test -- --reporter=json');
      const testResults = JSON.parse(stdout);

      // Track each test's result
      testResults.testResults.forEach((file: any) => {
        file.assertionResults.forEach((test: any) => {
          const testName = `${file.name}::${test.title}`;
          if (!results[testName]) {
            results[testName] = { pass: 0, fail: 0 };
          }

          if (test.status === 'passed') {
            results[testName].pass++;
          } else {
            results[testName].fail++;
          }
        });
      });
    } catch (error) {
      console.error('Test run failed:', error);
    }
  }

  // Report flaky tests
  const flakyTests = Object.entries(results).filter(
    ([_, counts]) => counts.pass > 0 && counts.fail > 0
  );

  if (flakyTests.length > 0) {
    console.error('⚠️  Flaky tests detected:');
    flakyTests.forEach(([test, counts]) => {
      console.error(
        `  - ${test}: ${counts.pass} pass, ${counts.fail} fail (${
          (counts.fail / runs) * 100
        }% failure rate)`
      );
    });

    process.exit(1);
  } else {
    console.log('✓ No flaky tests detected');
  }
}

detectFlakyTests();
```

---

## 9. IMPORTANT NOTES & WARNINGS

### 9.1 CRITICAL: Testing Non-Negotiables

**MUST DO** (blocking):
- [ ] Write characterization tests BEFORE any refactoring
- [ ] Maintain 80% coverage at ALL phases
- [ ] Run full test suite before merging each phase
- [ ] NO UI changes (validate with visual snapshots)
- [ ] Parity tests for OLD vs NEW implementations

**MUST NOT DO** (blockers):
- [ ] ❌ Delete old code before NEW code is tested
- [ ] ❌ Update snapshots without review
- [ ] ❌ Skip tests "temporarily"
- [ ] ❌ Merge with failing tests
- [ ] ❌ Change UI during refactoring

### 9.2 Testing Anti-Patterns to Avoid

#### ❌ Testing Implementation Details

```typescript
// BAD: Testing internal state
it('should update state.isLoading', () => {
  const { result } = renderHook(() => useBooking());
  expect(result.current.state.isLoading).toBe(false); // ❌
});

// GOOD: Testing observable behavior
it('should show loading indicator initially', () => {
  render(<BookingDashboard />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument(); // ✓
});
```

#### ❌ Brittle Selectors

```typescript
// BAD: Relying on classes/IDs
const button = container.querySelector('.booking-button'); // ❌

// GOOD: Using accessible roles
const button = screen.getByRole('button', { name: /book/i }); // ✓
```

#### ❌ Not Cleaning Up

```typescript
// BAD: Polluting global state
it('test 1', () => {
  localStorage.setItem('user', 'test');
  // No cleanup ❌
});

// GOOD: Cleanup after each test
afterEach(() => {
  localStorage.clear(); // ✓
});
```

### 9.3 Common Pitfalls During Refactoring

**Pitfall 1: "Tests pass but behavior changed"**
- **Cause**: Tests were too loose (e.g., `expect(result).toBeTruthy()`)
- **Solution**: Use precise assertions (`expect(result).toEqual(expectedValue)`)

**Pitfall 2: "Coverage dropped after consolidation"**
- **Cause**: Forgot to migrate all test cases
- **Solution**: Track test count before/after

**Pitfall 3: "Snapshots keep failing"**
- **Cause**: UI is changing (violates constraint)
- **Solution**: Revert UI changes, refactor without touching JSX

**Pitfall 4: "E2E tests are flaky"**
- **Cause**: Async timing issues
- **Solution**: Use `waitFor`, `findBy` queries, increase timeout

---

## 10. QUESTIONS FOR USER CLARIFICATION

Before proceeding with the implementation of this testing strategy, please clarify:

### 10.1 Testing Infrastructure

**Q1**: Does the project already have **ANY** tests?
- If YES: Where are they located? What framework?
- If NO: We'll start from scratch with Vitest

**Q2**: Is there a **CI/CD pipeline** already set up?
- If YES: GitHub Actions? GitLab CI? Other?
- If NO: We'll create GitHub Actions workflow

**Q3**: Do you have a **test database/environment**?
- If YES: Separate Supabase project for testing?
- If NO: We'll need to create one (DO NOT test on production DB)

### 10.2 Testing Coverage & Quality

**Q4**: What's your **current test coverage**?
- Run: `npm run test:coverage` (if tests exist)
- If 0%: We'll start from baseline

**Q5**: Are there any **critical user flows** that are non-negotiable?
- Example: Login → Book class → Receive confirmation
- These will get E2E tests with highest priority

### 10.3 Refactoring Timeline

**Q6**: Can you afford **downtime** during refactoring?
- If YES: Big-bang migration possible
- If NO: Need feature flags + gradual rollout

**Q7**: What's the **timeline** for this refactoring?
- This will determine how comprehensive pre-refactoring tests need to be

### 10.4 UI/UX Constraints

**Q8**: Is the "NO UI CHANGES" constraint **absolute**?
- If YES: Visual regression tests are CRITICAL
- If NO: Which UI changes are allowed?

**Q9**: Are there any **accessibility requirements**?
- WCAG AA? WCAG AAA?
- We'll add accessibility tests if needed

### 10.5 External Dependencies

**Q10**: What external services does the app depend on?
- Aimharder API
- Supabase
- QStash
- Others?

**How should we mock them in tests?**
- MSW (recommended)?
- Manual mocks?
- Real calls to test environments?

---

## NEXT STEPS

1. **Read this document** thoroughly
2. **Answer clarification questions** (section 10)
3. **Approve testing strategy** or request modifications
4. **I will then**:
   - Install testing dependencies
   - Create test configurations
   - Write characterization tests for Phase 0
   - Set up CI/CD pipeline
   - Provide Phase 0 test report
5. **Then proceed** with refactoring phases incrementally

---

**REMEMBER**: The goal is **ZERO BEHAVIOR CHANGES**. Tests are the safety net that ensures this. Do NOT skip or rush testing phases.

---

**End of Testing Strategy Document**
