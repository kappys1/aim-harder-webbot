# Frontend Test Implementation Plan: Loading State Issue

## Executive Summary

After thorough analysis of the loading state issue in the booking application, I've identified **multiple root causes** that prevent the loading skeleton from displaying. Your hypothesis was **partially correct** - the `SET_CURRENT_DAY` reducer action automatically setting `isLoading: false` is a major issue, but there are additional architectural problems that compound this.

## Root Cause Validation

### ✅ Your Hypothesis: PARTIALLY CORRECT

**What you got RIGHT**:
1. ✅ `setCurrentDay` in the reducer automatically sets `isLoading: false` (line 78 in `useBookingContext.hook.tsx`)
2. ✅ State changes happen too quickly for React to render the loading state
3. ✅ The explicit `setLoading(false)` on line 74 of `useBooking.hook.tsx` is redundant

**What you MISSED**:
1. ❌ **Cached data path never sets loading state at all** (lines 55-60 in `useBooking.hook.tsx`)
2. ❌ **React batching behavior** - React batches multiple state updates together in event handlers and effects
3. ❌ **Synchronous state updates** - When data is cached, everything happens synchronously without any async gap for React to render

### 🔴 Critical Issues Found

#### Issue #1: Cached Data Has NO Loading State (HIGH PRIORITY)
```typescript
// useBooking.hook.tsx lines 55-60
if (!forceRefresh && enableCache && state.cache.has(cacheKey)) {
  const cachedData = state.cache.get(cacheKey);
  if (cachedData) {
    actions.setCurrentDay(cachedData);  // ❌ Never sets isLoading: true
    return;
  }
}
```

**Impact**: When cached data exists (most common case after first load), users NEVER see a loading state.

#### Issue #2: Reducer Violates Single Responsibility Principle
```typescript
// useBookingContext.hook.tsx lines 74-80
case "SET_CURRENT_DAY":
  return {
    ...state,
    currentDay: action.payload,
    isLoading: false,  // ❌ Loading state shouldn't be managed here
    error: null,
  };
```

**Impact**:
- Implicit loading state management
- Makes `setLoading(false)` redundant
- Creates tight coupling between data and loading states

#### Issue #3: React State Batching
When the API call completes (lines 63-74):
```typescript
actions.setLoading(true);        // Update 1
// ... await API call ...
actions.setCurrentDay(bookingDay); // Update 2 (sets isLoading: false)
actions.setLoading(false);         // Update 3 (redundant)
```

React batches these updates. The component only renders the **final state** where `isLoading: false`.

#### Issue #4: useEffect Dependency Array Issue
```typescript
// useBooking.hook.tsx line 141-146
useEffect(() => {
  if (autoFetch) {
    fetchBookings(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state.selectedDate, state.selectedBoxId, autoFetch]);
```

**Problem**: `fetchBookings` missing from dependencies causes stale closures. The eslint-disable comment masks this critical issue.

## Architectural Analysis

### Current Flow (BROKEN)

#### Scenario 1: Fresh API Call
```
1. User changes date
2. setLoading(true)           → isLoading: true  (batched)
3. API call starts
4. API call completes
5. setCurrentDay(data)        → isLoading: false (batched)
6. setLoading(false)          → isLoading: false (redundant)
7. React renders ONCE with isLoading: false ❌
```

#### Scenario 2: Cached Data (WORSE)
```
1. User changes date
2. Cache hit
3. setCurrentDay(cachedData)  → isLoading: false
4. Return
5. React renders with isLoading: false ❌
(Never set loading state at all!)
```

### Why Loading State Never Shows

1. **React Batching**: Multiple `setState` calls in the same execution context get batched
2. **Synchronous Execution**: Cached data path is 100% synchronous
3. **Reducer Side Effect**: `SET_CURRENT_DAY` automatically sets `isLoading: false`
4. **No Minimum Duration**: Even if loading state is set, it changes back immediately

## Recommended Solution: Option 1 (Clean Architecture)

### ✅ Best Solution: Remove Auto-Loading from Reducer

**Why this is the best approach**:
1. ✅ Follows single responsibility principle
2. ✅ Explicit loading state management
3. ✅ Easier to debug and test
4. ✅ No artificial delays (better UX)
5. ✅ Fixes architectural issues

**Changes Required**:

#### 1. Update Reducer (useBookingContext.hook.tsx)
```typescript
case "SET_CURRENT_DAY":
  return {
    ...state,
    currentDay: action.payload,
    // ✅ REMOVE: isLoading: false,
    error: null,
  };
```

#### 2. Update Hook (useBooking.hook.tsx)

**For Cached Data** (lines 55-62):
```typescript
if (!forceRefresh && enableCache && state.cache.has(cacheKey)) {
  const cachedData = state.cache.get(cacheKey);
  if (cachedData) {
    // ✅ ADD: Show loading state even for cached data
    actions.setLoading(true);

    // Use setTimeout to ensure React renders the loading state
    setTimeout(() => {
      actions.setCurrentDay(cachedData);
      actions.setLoading(false);
    }, 0);

    return;
  }
}
```

**For API Calls** (lines 63-78):
```typescript
try {
  actions.setLoading(true);
  actions.setError(null);

  const bookingDay = await bookingBusiness.getBookingsForDay(
    state.selectedDate,
    state.selectedBoxId,
    cookies
  );

  actions.setCurrentDay(bookingDay);
  actions.setLoading(false);  // ✅ Now necessary, not redundant

  if (enableCache) {
    actions.cacheDay(cacheKey, bookingDay);
  }
}
```

#### 3. Fix useEffect Dependencies (line 141-146)
```typescript
useEffect(() => {
  if (autoFetch) {
    fetchBookings(false);
  }
}, [autoFetch, fetchBookings]); // ✅ Include fetchBookings
```

### Alternative Solutions (NOT RECOMMENDED)

#### ❌ Option 2: Add Artificial Delay
```typescript
if (!forceRefresh && enableCache && state.cache.has(cacheKey)) {
  const cachedData = state.cache.get(cacheKey);
  if (cachedData) {
    actions.setLoading(true);
    setTimeout(() => {
      actions.setCurrentDay(cachedData);
    }, 100);  // ❌ Artificial delay hurts UX
    return;
  }
}
```

**Why NOT recommended**: Artificial delays create poor UX and don't fix architectural issues.

#### ❌ Option 3: Use flushSync (React 18+)
```typescript
import { flushSync } from 'react-dom';

flushSync(() => {
  actions.setLoading(true);
});
// API call here
```

**Why NOT recommended**: Overkill, hurts performance, and doesn't address root cause.

## Comprehensive Test Implementation Plan

### Test Structure

```
modules/booking/
├── hooks/
│   ├── useBooking.hook.test.tsx          ✅ CREATE
│   └── useBookingContext.hook.test.tsx   ✅ CREATE
└── pods/
    └── booking-dashboard/
        └── booking-dashboard.test.tsx    ✅ CREATE
```

### Test Suite 1: useBookingContext.hook.test.tsx

**Purpose**: Test the reducer and context provider in isolation

#### Test Cases:

1. **Reducer State Management**
   ```typescript
   describe('bookingReducer', () => {
     describe('SET_CURRENT_DAY action', () => {
       it('should update currentDay with payload', () => {
         // Test that currentDay is set correctly
       });

       it('should NOT automatically set isLoading to false', () => {
         // ✅ CRITICAL: Verify isLoading is NOT touched
         const state = { ...initialState, isLoading: true };
         const action = { type: 'SET_CURRENT_DAY', payload: mockBookingDay };
         const newState = bookingReducer(state, action);
         expect(newState.isLoading).toBe(true); // Should remain unchanged
       });

       it('should clear error when setting current day', () => {
         // Test error is cleared
       });
     });

     describe('SET_LOADING action', () => {
       it('should set isLoading to true', () => {
         // Test loading state
       });

       it('should set isLoading to false', () => {
         // Test loading state
       });
     });

     describe('SET_ERROR action', () => {
       it('should set error message', () => {
         // Test error setting
       });

       it('should set isLoading to false when error occurs', () => {
         // Test loading stops on error
       });
     });
   });
   ```

2. **Context Provider**
   ```typescript
   describe('BookingProvider', () => {
     it('should provide initial state', () => {
       // Test initial state
     });

     it('should accept initialDate and initialBoxId props', () => {
       // Test custom initial values
     });

     it('should throw error when used outside provider', () => {
       // Test context boundary
     });
   });
   ```

3. **Computed Values**
   ```typescript
   describe('computed values', () => {
     it('should calculate hasBookings correctly', () => {
       // Test computed.hasBookings
     });

     it('should filter availableBookings correctly', () => {
       // Test computed.availableBookings
     });

     it('should filter userBookings correctly', () => {
       // Test computed.userBookings
     });
   });
   ```

**Mock Setup**:
```typescript
const mockBookingDay: BookingDay = {
  date: '2025-10-02',
  boxId: '10122',
  bookings: [
    {
      id: 1,
      timeSlot: { startTime: '09:00', endTime: '10:00', time: '09:00' },
      status: BookingStatus.AVAILABLE,
      capacity: { current: 5, limit: 12, available: 7, percentage: 41.67 },
      userBookingId: null,
    },
    // ... more bookings
  ],
};
```

### Test Suite 2: useBooking.hook.test.tsx

**Purpose**: Test the custom hook logic, caching, and loading states

#### Test Cases:

1. **Loading State Management - Cached Data**
   ```typescript
   describe('useBooking - Cached Data', () => {
     it('should show loading state when returning cached data', async () => {
       // Setup: Pre-populate cache
       const { result } = renderHook(() => useBooking({ enableCache: true }));

       // First call - populate cache
       await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
       });

       // Change date - should use cache
       act(() => {
         result.current.setDate('2025-10-03');
       });

       // ✅ CRITICAL: Should show loading state even for cached data
       expect(result.current.isLoading).toBe(true);

       await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
         expect(result.current.bookingDay).toBeDefined();
       });
     });

     it('should bypass cache when forceRefresh is true', async () => {
       // Test refetch bypasses cache
     });

     it('should not use cache when enableCache is false', async () => {
       // Test cache disabled
     });
   });
   ```

2. **Loading State Management - API Calls**
   ```typescript
   describe('useBooking - API Calls', () => {
     it('should show loading state during API call', async () => {
       const { result } = renderHook(() => useBooking({ enableCache: false }));

       // Should start loading
       expect(result.current.isLoading).toBe(true);

       // Should stop loading when complete
       await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
       });
     });

     it('should maintain loading state throughout entire API call', async () => {
       let resolveApiCall: (value: BookingDay) => void;
       const apiPromise = new Promise<BookingDay>((resolve) => {
         resolveApiCall = resolve;
       });

       // Mock slow API
       vi.spyOn(bookingBusiness, 'getBookingsForDay').mockReturnValue(apiPromise);

       const { result } = renderHook(() => useBooking());

       // Should be loading
       expect(result.current.isLoading).toBe(true);

       // Resolve API call
       act(() => {
         resolveApiCall!(mockBookingDay);
       });

       // Should stop loading
       await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
       });
     });

     it('should set loading to false on API error', async () => {
       // Test error handling
     });
   });
   ```

3. **State Transition Tests**
   ```typescript
   describe('useBooking - State Transitions', () => {
     it('should transition: false → true → false for API calls', async () => {
       const states: boolean[] = [];
       const { result } = renderHook(() => useBooking({ enableCache: false }));

       // Track all loading state changes
       states.push(result.current.isLoading);

       await waitFor(() => {
         states.push(result.current.isLoading);
       });

       // Should have seen: [true, false] or [false, true, false]
       expect(states).toContain(true);
       expect(states[states.length - 1]).toBe(false);
     });

     it('should handle rapid date changes without race conditions', async () => {
       const { result } = renderHook(() => useBooking());

       // Rapid date changes
       act(() => {
         result.current.setDate('2025-10-03');
         result.current.setDate('2025-10-04');
         result.current.setDate('2025-10-05');
       });

       // Should handle gracefully
       await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
       });
     });
   });
   ```

4. **Cache Management**
   ```typescript
   describe('useBooking - Cache', () => {
     it('should cache booking data by date and boxId', async () => {
       const { result } = renderHook(() => useBooking({ enableCache: true }));

       // First call
       await waitFor(() => {
         expect(result.current.bookingDay).toBeDefined();
       });

       const firstCallData = result.current.bookingDay;

       // Change date and back
       act(() => {
         result.current.setDate('2025-10-03');
       });

       await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
       });

       act(() => {
         result.current.setDate('2025-10-02');
       });

       // Should return cached data
       await waitFor(() => {
         expect(result.current.bookingDay).toBe(firstCallData);
       });
     });

     it('should generate correct cache keys', () => {
       // Test BookingUtils.getCacheKey
     });
   });
   ```

5. **Auto-fetch Behavior**
   ```typescript
   describe('useBooking - Auto-fetch', () => {
     it('should fetch on mount when autoFetch is true', async () => {
       const fetchSpy = vi.spyOn(bookingBusiness, 'getBookingsForDay');

       renderHook(() => useBooking({ autoFetch: true }));

       await waitFor(() => {
         expect(fetchSpy).toHaveBeenCalledTimes(1);
       });
     });

     it('should NOT fetch on mount when autoFetch is false', () => {
       const fetchSpy = vi.spyOn(bookingBusiness, 'getBookingsForDay');

       renderHook(() => useBooking({ autoFetch: false }));

       expect(fetchSpy).not.toHaveBeenCalled();
     });

     it('should re-fetch when selectedDate changes', async () => {
       const fetchSpy = vi.spyOn(bookingBusiness, 'getBookingsForDay');

       const { result } = renderHook(() => useBooking({ enableCache: false }));

       await waitFor(() => {
         expect(fetchSpy).toHaveBeenCalledTimes(1);
       });

       act(() => {
         result.current.setDate('2025-10-03');
       });

       await waitFor(() => {
         expect(fetchSpy).toHaveBeenCalledTimes(2);
       });
     });
   });
   ```

6. **Error Handling**
   ```typescript
   describe('useBooking - Error Handling', () => {
     it('should handle network errors gracefully', async () => {
       vi.spyOn(bookingBusiness, 'getBookingsForDay').mockRejectedValue(
         new Error('network error')
       );

       const { result } = renderHook(() => useBooking());

       await waitFor(() => {
         expect(result.current.error).toContain('network');
         expect(result.current.isLoading).toBe(false);
       });
     });

     it('should retry on error when retryOnError is called', async () => {
       // Test retry mechanism
     });

     it('should show appropriate toast messages for different errors', async () => {
       // Test toast notifications
     });
   });
   ```

**Mock Setup**:
```typescript
// Mock BookingBusiness
const mockBookingBusiness = {
  getBookingsForDay: vi.fn(),
  getBookingStatistics: vi.fn(),
};

// Mock context wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BookingProvider initialDate="2025-10-02" initialBoxId="10122">
    {children}
  </BookingProvider>
);

// Render hook with context
const { result } = renderHook(() => useBooking(), { wrapper });
```

### Test Suite 3: booking-dashboard.test.tsx

**Purpose**: Integration tests for the full component

#### Test Cases:

1. **Loading State Display**
   ```typescript
   describe('BookingDashboard - Loading States', () => {
     it('should display loading skeleton during initial load', async () => {
       render(<BookingDashboardComponent {...defaultProps} />);

       // Should show skeleton
       expect(screen.getAllByRole('presentation')).toHaveLength(6); // 6 skeleton cards
       expect(screen.getByText(/animate-pulse/i)).toBeInTheDocument();

       // Should hide skeleton when loaded
       await waitFor(() => {
         expect(screen.queryByText(/animate-pulse/i)).not.toBeInTheDocument();
       });
     });

     it('should display loading skeleton when date changes', async () => {
       render(<BookingDashboardComponent {...defaultProps} />);

       // Wait for initial load
       await waitFor(() => {
         expect(screen.queryByText(/animate-pulse/i)).not.toBeInTheDocument();
       });

       // Change date
       const dateInput = screen.getByRole('textbox', { name: /date/i });
       await userEvent.clear(dateInput);
       await userEvent.type(dateInput, '2025-10-03');

       // ✅ CRITICAL: Should show loading skeleton
       expect(screen.getAllByRole('presentation')).toHaveLength(6);

       // Should hide skeleton when loaded
       await waitFor(() => {
         expect(screen.queryByText(/animate-pulse/i)).not.toBeInTheDocument();
       });
     });

     it('should show loading indicator in refresh button', async () => {
       render(<BookingDashboardComponent {...defaultProps} />);

       await waitFor(() => {
         expect(screen.queryByText(/animate-spin/i)).not.toBeInTheDocument();
       });

       const refreshButton = screen.getByRole('button', { name: /actualizar/i });
       await userEvent.click(refreshButton);

       // Should show spinning icon
       expect(screen.getByText(/animate-spin/i)).toBeInTheDocument();
     });
   });
   ```

2. **Data Display**
   ```typescript
   describe('BookingDashboard - Data Display', () => {
     it('should display bookings after loading', async () => {
       render(<BookingDashboardComponent {...defaultProps} />);

       await waitFor(() => {
         expect(screen.getByText(/09:00/i)).toBeInTheDocument();
       });
     });

     it('should display statistics correctly', async () => {
       // Test statistics cards
     });
   });
   ```

3. **Error Handling**
   ```typescript
   describe('BookingDashboard - Error States', () => {
     it('should display error message when fetch fails', async () => {
       // Mock API error

       render(<BookingDashboardComponent {...defaultProps} />);

       await waitFor(() => {
         expect(screen.getByText(/error al cargar/i)).toBeInTheDocument();
       });
     });

     it('should allow retry on error', async () => {
       // Test retry button
     });
   });
   ```

4. **User Interactions**
   ```typescript
   describe('BookingDashboard - User Interactions', () => {
     it('should handle booking action', async () => {
       // Test booking flow
     });

     it('should handle cancellation action', async () => {
       // Test cancellation flow
     });

     it('should disable actions during loading', async () => {
       // Test disabled state
     });
   });
   ```

## Test Utilities and Mocks

### Custom Render Function
```typescript
// test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { BookingProvider } from './useBookingContext.hook';

interface CustomRenderOptions extends RenderOptions {
  initialDate?: string;
  initialBoxId?: string;
}

export function renderWithBookingProvider(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const { initialDate, initialBoxId, ...renderOptions } = options || {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BookingProvider initialDate={initialDate} initialBoxId={initialBoxId}>
      {children}
    </BookingProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
```

### Mock Data Factory
```typescript
// mock-factories.ts
export const createMockBooking = (overrides?: Partial<Booking>): Booking => ({
  id: 1,
  timeSlot: { startTime: '09:00', endTime: '10:00', time: '09:00' },
  status: BookingStatus.AVAILABLE,
  capacity: { current: 5, limit: 12, available: 7, percentage: 41.67 },
  userBookingId: null,
  ...overrides,
});

export const createMockBookingDay = (overrides?: Partial<BookingDay>): BookingDay => ({
  date: '2025-10-02',
  boxId: '10122',
  bookings: [createMockBooking()],
  ...overrides,
});
```

### API Mocks
```typescript
// setup-tests.ts
import { vi } from 'vitest';

// Mock BookingBusiness
vi.mock('../business/booking.business', () => ({
  BookingBusiness: vi.fn().mockImplementation(() => ({
    getBookingsForDay: vi.fn().mockResolvedValue(createMockBookingDay()),
    getBookingStatistics: vi.fn().mockReturnValue({
      total: 10,
      available: 5,
      booked: 3,
      full: 1,
      waitlist: 1,
      occupancyPercentage: 50,
      availabilityPercentage: 50,
      classTypes: ['CrossFit'],
    }),
  })),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));
```

## Implementation Steps

### Phase 1: Fix Reducer (Day 1)
1. ✅ Remove `isLoading: false` from `SET_CURRENT_DAY` action
2. ✅ Write tests for reducer state management
3. ✅ Verify tests pass

### Phase 2: Fix Hook Logic (Day 1-2)
1. ✅ Add loading state for cached data path
2. ✅ Use `setTimeout(fn, 0)` to ensure React renders loading state
3. ✅ Fix useEffect dependencies
4. ✅ Write comprehensive hook tests
5. ✅ Verify tests pass

### Phase 3: Integration Tests (Day 2-3)
1. ✅ Write component integration tests
2. ✅ Test loading skeleton display
3. ✅ Test user interactions during loading
4. ✅ Verify all tests pass

### Phase 4: Edge Cases (Day 3)
1. ✅ Test rapid state changes
2. ✅ Test race conditions
3. ✅ Test error scenarios
4. ✅ Test cache invalidation

## Success Criteria

### Functional Requirements
- [ ] Loading skeleton displays for ALL data fetches (cached and API)
- [ ] Loading state shows for minimum 100ms (visible to users)
- [ ] No race conditions with rapid date changes
- [ ] Error states display correctly
- [ ] Retry mechanism works as expected

### Test Coverage
- [ ] 80%+ code coverage on hooks
- [ ] 80%+ code coverage on components
- [ ] All critical paths tested
- [ ] Edge cases covered

### Performance
- [ ] No unnecessary re-renders
- [ ] Cache works correctly
- [ ] No memory leaks
- [ ] No console errors

## Files to Create/Modify

### Create (3 files):
```
✅ modules/booking/hooks/useBooking.hook.test.tsx
✅ modules/booking/hooks/useBookingContext.hook.test.tsx
✅ modules/booking/pods/booking-dashboard/booking-dashboard.test.tsx
```

### Modify (2 files):
```
✅ modules/booking/hooks/useBookingContext.hook.tsx
   - Remove isLoading: false from SET_CURRENT_DAY

✅ modules/booking/hooks/useBooking.hook.tsx
   - Add loading state for cached data
   - Use setTimeout(fn, 0) for cached data
   - Fix useEffect dependencies
```

## Key Testing Patterns

### 1. Testing Loading State Transitions
```typescript
it('should show loading state', async () => {
  const { result } = renderHook(() => useBooking());

  // Verify loading state is shown
  expect(result.current.isLoading).toBe(true);

  // Wait for completion
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
});
```

### 2. Testing React Batching Behavior
```typescript
it('should handle batched updates correctly', async () => {
  const states: boolean[] = [];

  const { result } = renderHook(() => {
    const hook = useBooking();
    states.push(hook.isLoading);
    return hook;
  });

  // Verify we saw loading state
  await waitFor(() => {
    expect(states).toContain(true);
  });
});
```

### 3. Testing Async State Updates
```typescript
it('should handle async updates', async () => {
  vi.useFakeTimers();

  const { result } = renderHook(() => useBooking());

  // Fast-forward time
  act(() => {
    vi.advanceTimersByTime(100);
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  vi.useRealTimers();
});
```

## Critical Notes for Implementation

### ⚠️ React 18 Batching Behavior
React 18 batches ALL state updates (even in async code). This means:
```typescript
// These will batch together:
setLoading(true);
await apiCall();
setLoading(false);

// Component only renders once with final state
```

**Solution**: Use `setTimeout(fn, 0)` to break out of batching:
```typescript
setLoading(true);
setTimeout(() => {
  setCurrentDay(data);
  setLoading(false);
}, 0);
```

### ⚠️ Stale Closures in useEffect
Current code has stale closure issue:
```typescript
useEffect(() => {
  fetchBookings(); // ❌ Captures stale version
}, [state.selectedDate]); // ❌ Missing fetchBookings
```

**Solution**: Include `fetchBookings` in dependencies OR use `useCallback` properly.

### ⚠️ Cache Key Generation
Verify cache keys are unique per date + boxId:
```typescript
const cacheKey = `${date}-${boxId}`;
```

### ⚠️ Minimum Loading Duration
For better UX, consider minimum 100ms loading display:
```typescript
const MIN_LOADING_DURATION = 100;
const startTime = Date.now();

// ... fetch data ...

const elapsed = Date.now() - startTime;
const delay = Math.max(0, MIN_LOADING_DURATION - elapsed);

setTimeout(() => {
  setLoading(false);
}, delay);
```

## Questions for Clarification

1. **Minimum Loading Duration**: Should we enforce a minimum loading duration (e.g., 100ms) to ensure skeleton is visible?
   - PRO: Better UX, users see feedback
   - CON: Adds artificial delay

2. **Cache Strategy**: Should cached data show loading state at all?
   - Current approach: Yes, for consistency
   - Alternative: Skip loading for instant cache hits

3. **Error Recovery**: Should errors clear on retry or require explicit user action?
   - Current: Automatic retry on new date selection
   - Alternative: Explicit retry button only

4. **Loading Indicators**: Multiple vs. single loading indicator?
   - Current: Single `isLoading` for entire component
   - Alternative: Separate loading states per section

5. **Test Coverage Target**: Is 80% sufficient or should we aim higher?
   - Current target: 80%
   - Consider: 90%+ for critical paths

## Conclusion

Your hypothesis was on the right track, but the issue is more complex than just `setCurrentDay` setting `isLoading: false`. The main problems are:

1. **Architectural**: Reducer violates single responsibility by managing loading state
2. **Cached Data**: Never sets loading state at all
3. **React Batching**: Multiple state updates batch together
4. **Synchronous Execution**: No async gap for React to render intermediate states

The recommended solution removes loading state management from the reducer and ensures ALL data paths (cached and API) properly show loading states with `setTimeout(fn, 0)` to break React batching.

This comprehensive test plan will validate the fix and prevent regressions.
