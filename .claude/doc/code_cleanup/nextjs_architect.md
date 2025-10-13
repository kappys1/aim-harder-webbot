# Next.js Architect - Code Cleanup Refactoring Analysis

**Date**: 2025-10-03
**Session**: code_cleanup
**Architect**: nextjs-architect
**Status**: REVIEW COMPLETE

---

## EXECUTIVE SUMMARY

After analyzing the proposed refactoring plan and examining the codebase, I have **MIXED CONCERNS** about the proposed changes. While many suggestions are valid, some recommendations could introduce architectural issues specific to Next.js 15 and the App Router paradigm.

### Overall Assessment:
- **Architecture Validation**: 60% aligned (major concerns with business layer elimination)
- **Next.js Best Practices**: 70% aligned (good direction but missing key considerations)
- **Risk Level**: **MEDIUM-HIGH** (particularly Phase 1 and Phase 3)
- **Recommended Approach**: **INCREMENTAL WITH MODIFICATIONS**

---

## 1. ARCHITECTURE VALIDATION

### 1.1 Eliminating the `business/` Layer - **CRITICAL CONCERN**

#### The Problem with Complete Elimination:

The analysis suggests eliminating ALL business layer files because they "don't add value." This is **partially correct but oversimplified**.

**Current Issue (Confirmed)**:
```typescript
// booking.business.ts - Lines 22-93
class BookingBusiness {
  private cache: Map<string, { data: BookingDay; timestamp: number }>;
  // Manual retry logic
  // Manual caching
  // Just wraps service calls
}
```

**YES**, the current implementation is over-engineered with:
- Manual caching (React Query does this)
- Manual retry logic (React Query does this)
- Unnecessary indirection

**BUT** - Here's what the analysis **MISSED**:

#### What Business Logic Actually Needs:

In Next.js 15 App Router architecture, you need a **coordination layer** for:

1. **Server-side orchestration** (Server Actions)
2. **Complex multi-service operations**
3. **Business rule validation**
4. **Transaction coordination**

**Example from your code** (app/api/booking/route.ts):
```typescript
// POST method has 200+ lines of business logic:
if (bookState === ERROR_EARLY_BOOKING) {
  // 1. Create prebooking
  // 2. Validate limits
  // 3. Schedule QStash
  // 4. Handle edge cases
}
```

This logic **SHOULD NOT** be in an API route. It should be in a **business service** or **Server Action**.

#### My Recommendation: **TRANSFORM, DON'T ELIMINATE**

**Instead of eliminating `business/`, refactor it to:**

```
modules/booking/
  ├── actions/              # NEW - Server Actions (Next.js 15)
  │   ├── create-booking.action.ts
  │   └── cancel-booking.action.ts
  ├── services/             # KEEP - Pure services (Supabase, API calls)
  │   └── booking.service.ts
  └── utils/                # KEEP - Pure functions
      └── booking.utils.ts
```

**Why this is better**:
- Server Actions are the **recommended Next.js 15 pattern**
- Removes manual caching (React Query handles client-side)
- Moves complex orchestration out of API routes
- Type-safe, progressive enhancement ready
- Easier to test

### 1.2 Service Consolidation - **MOSTLY GOOD**

#### Auth Services: From 6 → 3 ✅

**Current State (CONFIRMED OVER-ENGINEERED)**:
```
auth/api/services/
  ├── aimharder-auth.service.ts (308 lines)
  ├── aimharder-refresh.service.ts (204 lines)
  ├── auth.service.ts (130 lines - WRAPPER)
  ├── supabase-session.service.ts (361 lines)
  ├── cookie.service.ts
  └── html-parser.service.ts
```

**Proposed Consolidation ✅**:
```
auth/
  ├── services/
  │   ├── aimharder-client.service.ts  # Auth + refresh + HTML parsing
  │   └── session.service.ts            # Supabase session CRUD
  └── utils/
      └── auth.utils.ts                 # Cookie helpers, validation
```

**I AGREE** - This is a smart consolidation. The current 6 services are unnecessarily fragmented.

#### Box Services: From 3 → 1-2 ✅

**Current**:
```
boxes/api/services/
  ├── box.service.ts (165 lines) - CRUD
  ├── box-detection.service.ts - HTML parsing
  └── box-access.service.ts - Validation
```

**Recommended**:
```
boxes/
  ├── services/
  │   └── box.service.ts  # CRUD + detection
  └── utils/
      └── box.utils.ts    # Validation, parsing helpers
```

**I AGREE** - These services are too granular. Consolidate them.

### 1.3 React Query Instead of Manual Caching - **ABSOLUTELY YES** ✅

**Current Problem (CONFIRMED)**:
```typescript
// Triple caching system:
// 1. BookingContext.cache
// 2. BookingBusiness.cache
// 3. Manual state tracking
```

**Solution**: Use React Query exclusively for client-side data fetching.

**Example Refactor**:
```typescript
// BEFORE: useBooking.hook.tsx (188 lines)
const [bookingBusiness] = useState(() => new BookingBusiness());
const stateRef = useRef(state);
// ... manual cache logic ...

// AFTER: useBookingsQuery.hook.tsx (~40 lines)
export function useBookingsQuery(date: string, boxId: string) {
  return useQuery({
    queryKey: ['bookings', date, boxId],
    queryFn: () => bookingService.getBookings({ day: date, box: boxId }),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

**Benefits**:
- Removes 300+ lines of manual cache logic
- Automatic retry, refetch, background updates
- Better TypeScript support
- Automatic loading/error states

---

## 2. NEXT.JS 15 BEST PRACTICES ALIGNMENT

### 2.1 Server Components vs Client Components - **NEEDS ATTENTION**

#### Current State Analysis:

Your codebase has **only 10 client components** (`"use client"` directives found), which suggests good Server Component usage. However, the analysis **doesn't address how to maintain this** during refactoring.

#### Critical Considerations:

**DO NOT convert Server Components to Client Components during refactoring.**

**Server Component Pattern (Keep This)**:
```typescript
// app/(app)/dashboard/page.tsx - Server Component
export default async function DashboardPage() {
  // Direct data fetching on server
  const session = await getServerSession();
  const boxes = await getBoxes(session.email);

  // Pass to client component
  return <DashboardClient initialBoxes={boxes} />;
}
```

**Client Component Pattern (Use React Query)**:
```typescript
// dashboard-client.tsx
"use client";
export function DashboardClient({ initialBoxes }) {
  // Use React Query with initialData
  const { data: boxes } = useQuery({
    queryKey: ['boxes'],
    queryFn: fetchBoxes,
    initialData: initialBoxes, // Hydrate from server
  });
}
```

#### Missing from Analysis:

The plan doesn't mention:
- How to handle Server Actions (Next.js 15 feature)
- Streaming and Suspense boundaries
- Data fetching at the component level vs route level

### 2.2 API Route Simplification - **GOOD BUT INCOMPLETE**

#### Analysis Correctly Identifies:

```typescript
// app/api/booking/route.ts - 485 lines
// Problems:
// 1. Duplicated auth logic
// 2. Business logic in route
// 3. No middleware
```

#### My Recommended Approach:

**Step 1: Extract to Server Actions** (Better than API routes for internal operations)

```typescript
// modules/booking/actions/create-booking.action.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createBookingAction(data: BookingCreateRequest) {
  const session = await getServerSession(); // Built-in auth

  if (!session) {
    return { error: 'Unauthorized' };
  }

  // Business logic orchestration
  const result = await bookingOrchestrator.createBooking(data, session);

  // Revalidate UI
  revalidatePath('/dashboard');

  return result;
}
```

**Step 2: Keep API Routes Only for External Access**

```typescript
// app/api/booking/route.ts (~50 lines)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = BookingCreateRequestSchema.parse(body);

  // Delegate to Server Action
  return NextResponse.json(
    await createBookingAction(validated)
  );
}
```

**Why This Matters**:
- Server Actions are the **Next.js 15 recommended pattern**
- Better type safety (end-to-end TypeScript)
- Progressive enhancement ready
- Automatic revalidation
- No need for API routes for internal operations

### 2.3 Middleware for Auth - **CRITICAL MISSING PIECE**

The analysis suggests:
```typescript
// Duplicated in every route:
const userEmail = request.headers.get("x-user-email") || "alexsbd1@gmail.com";
```

**Solution**: Next.js Middleware

```typescript
// middleware.ts (root level)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Auth validation
  const userEmail = request.headers.get('x-user-email');

  if (!userEmail && request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Add validated email to request
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-validated-user', userEmail);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
```

**CORS Headers Centralization**:

```typescript
// common/utils/api.utils.ts
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function withCORS<T>(data: T): NextResponse {
  return NextResponse.json(data, { headers: CORS_HEADERS });
}
```

---

## 3. POTENTIAL ISSUES & GOTCHAS

### 3.1 React Query Migration Risks

#### Issue 1: Server State vs Client State Confusion

**Problem**:
```typescript
// Current: useBookingContext manages EVERYTHING
interface BookingState {
  currentDay: BookingDay | null;      // Server state
  selectedDate: string;               // Client state
  selectedBoxId: string;              // Client state
  cache: Map<string, BookingDay>;     // Server state (duplicated)
  isLoading: boolean;                 // Server state
}
```

**Risk During Migration**: Developers might move ALL state to React Query, including UI state.

**Correct Approach**:
```typescript
// Server state (React Query)
const { data: bookingDay, isLoading } = useBookingsQuery(selectedDate, selectedBoxId);

// Client state (React useState or Zustand)
const [selectedDate, setSelectedDate] = useState<string>(today());
const [selectedBoxId, setSelectedBoxId] = useState<string>(defaultBox);
```

#### Issue 2: Loss of Optimistic Updates

**Current code doesn't have optimistic updates**, but after migration, you'll want them.

**Example**:
```typescript
const mutation = useMutation({
  mutationFn: createBooking,
  onMutate: async (newBooking) => {
    // Cancel ongoing queries
    await queryClient.cancelQueries({ queryKey: ['bookings'] });

    // Snapshot previous value
    const previousBookings = queryClient.getQueryData(['bookings']);

    // Optimistically update
    queryClient.setQueryData(['bookings'], (old) => {
      return { ...old, bookings: [...old.bookings, newBooking] };
    });

    return { previousBookings };
  },
  onError: (err, newBooking, context) => {
    // Rollback on error
    queryClient.setQueryData(['bookings'], context.previousBookings);
  },
});
```

### 3.2 Business Logic Extraction Risks

#### Issue: Moving Logic from Routes to Services Without Structure

**Bad Refactor** (Just moving code around):
```typescript
// DON'T DO THIS - Moving 200 lines from route to service
class BookingService {
  async createBooking(data) {
    // 200 lines of if/else logic pasted here
  }
}
```

**Good Refactor** (Structured orchestration):
```typescript
// modules/booking/actions/create-booking.action.ts
'use server';

export async function createBookingAction(data: BookingCreateRequest) {
  // 1. Validate session
  const session = await validateUserSession();

  // 2. Attempt booking
  const result = await bookingService.createBooking(data, session.cookies);

  // 3. Handle early booking error → create prebooking
  if (result.state === 'ERROR_EARLY_BOOKING') {
    return await handleEarlyBooking(data, result, session);
  }

  // 4. Handle other states
  return mapBookingResult(result);
}

// Separate, testable functions
async function handleEarlyBooking(data, result, session) {
  const availableAt = parseEarlyBookingError(result.error);

  await prebookingService.create({
    userId: session.userId,
    scheduledAt: availableAt,
    bookingData: data,
  });

  await queuePreBooking(availableAt);

  return { success: true, state: 'PREBOOKING_CREATED' };
}
```

### 3.3 TypeScript & Zod Validation

**Current Issue**: API routes validate, but where does validation happen after refactoring?

**Recommendation**:
```typescript
// Server Actions should validate inputs
'use server';

export async function createBookingAction(rawData: unknown) {
  // Validate at the boundary
  const data = BookingCreateRequestSchema.parse(rawData);

  // Type-safe from here on
  return orchestrator.createBooking(data);
}
```

---

## 4. MIGRATION PATH CONCERNS

### 4.1 Proposed Phase Order - **NEEDS REORDERING**

**Current Plan**:
```
Phase 1: Eliminate business layer
Phase 2: Consolidate services
Phase 3: Simplify hooks
Phase 4: Refactor API routes
```

**Problem**: Phase 1 eliminates business layer BEFORE creating the replacement (Server Actions).

**Recommended Order**:
```
Phase 1: Setup Infrastructure
  ✓ Create CORS utils
  ✓ Create middleware for auth
  ✓ Setup React Query provider

Phase 2: Create New Patterns (Parallel to old)
  ✓ Create Server Actions for complex operations
  ✓ Create React Query hooks
  ✓ Keep old business layer temporarily

Phase 3: Migrate Features Incrementally
  ✓ Migrate booking module (Server Actions + React Query)
  ✓ Test thoroughly
  ✓ Remove old booking.business.ts
  ✓ Repeat for other modules

Phase 4: Consolidate Services
  ✓ Merge auth services (6 → 3)
  ✓ Merge box services (3 → 1-2)

Phase 5: Final Cleanup
  ✓ Remove old hooks
  ✓ Remove duplicated utils
  ✓ Update tests
```

### 4.2 Testing Strategy - **MISSING FROM PLAN**

**Critical**: The analysis doesn't mention testing during refactoring.

**Required**:
1. **Write tests BEFORE refactoring** (characterization tests)
2. **Maintain 80% coverage** (your requirement)
3. **Test markers** (unit, integration) should continue

**Example Test Strategy**:
```typescript
// BEFORE refactoring - characterization test
describe('BookingBusiness.getBookingsForDay', () => {
  it('should return cached data when available', async () => {
    // Test current behavior
  });

  it('should retry 3 times on failure', async () => {
    // Test current behavior
  });
});

// AFTER refactoring - same behavior, new implementation
describe('useBookingsQuery', () => {
  it('should return cached data when available', async () => {
    // Same test, different implementation
  });

  it('should retry 3 times on failure', async () => {
    // Same test, different implementation
  });
});
```

---

## 5. RECOMMENDATIONS

### 5.1 What to CHANGE in the Plan

#### 1. Don't Eliminate Business Layer - Transform It

**Proposed Change**:
```diff
- PHASE 1: Eliminar `modules/*/business/*.business.ts`
+ PHASE 1: Transform business layer to Server Actions pattern
  - Create `actions/` directory in each module
  - Move orchestration logic to Server Actions
  - Keep pure services separate
```

#### 2. Add Server Actions Migration

**NEW Phase**:
```
PHASE 2A: Implement Server Actions Pattern
  ✓ modules/booking/actions/create-booking.action.ts
  ✓ modules/booking/actions/cancel-booking.action.ts
  ✓ modules/prebooking/actions/schedule-prebooking.action.ts
```

#### 3. Reorder Phases

**Proposed Order** (see section 4.1 above)

#### 4. Add Middleware Creation

**NEW Task**:
```
PHASE 1B: Create Next.js Middleware
  ✓ middleware.ts for auth validation
  ✓ Remove auth duplication from routes
```

#### 5. Add Testing Requirements

**NEW Phase**:
```
PHASE 0 (Before Refactoring): Create Test Safety Net
  ✓ Characterization tests for all business logic
  ✓ Integration tests for critical flows
  ✓ Maintain 80% coverage throughout
```

### 5.2 What to KEEP from the Plan ✅

These are good recommendations:

1. ✅ Consolidate auth services (6 → 3)
2. ✅ Consolidate box services (3 → 1-2)
3. ✅ Use React Query instead of manual caching
4. ✅ Extract CORS headers to utils
5. ✅ Simplify prebooking service
6. ✅ Remove console.logs (add structured logging)
7. ✅ Remove duplicate `lib/utils.ts`
8. ✅ Split mega-components (booking-dashboard: 568 → 200 lines)

### 5.3 What to ADD to the Plan

#### 1. Server Actions Pattern

**Why**: Next.js 15 best practice for data mutations

**Example Structure**:
```
modules/booking/
  ├── actions/              # NEW
  │   ├── create-booking.action.ts
  │   ├── cancel-booking.action.ts
  │   └── validate-booking.action.ts
  ├── services/             # KEEP (Pure API calls)
  │   └── booking.service.ts
  ├── utils/                # KEEP (Pure functions)
  │   └── booking.utils.ts
  └── hooks/                # NEW (React Query)
      └── useBookingsQuery.hook.tsx
```

#### 2. Middleware Layer

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // Centralized auth validation
  // CORS handling
  // Request logging
}
```

#### 3. React Query Configuration

```typescript
// app/providers.tsx
'use client';

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        cacheTime: 10 * 60 * 1000,
        retry: 3,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

#### 4. Progressive Enhancement Strategy

**Don't break JavaScript-disabled users**:

```typescript
// Server Action with form support
export async function createBookingAction(formData: FormData) {
  const data = {
    classId: formData.get('classId'),
    date: formData.get('date'),
  };

  const validated = BookingCreateRequestSchema.parse(data);
  return await createBooking(validated);
}

// Component
<form action={createBookingAction}>
  <input name="classId" />
  <input name="date" />
  <button type="submit">Book</button>
</form>
```

---

## 6. SAFEST EXECUTION ORDER

Based on Next.js 15 architecture and risk minimization:

### Phase 0: Preparation (1-2 days)
```
✓ Write characterization tests for existing behavior
✓ Document current API contracts
✓ Setup error tracking (to catch regressions)
✓ Create feature flags for gradual rollout
```

### Phase 1: Infrastructure (2-3 days)
```
✓ Create middleware.ts (auth validation)
✓ Create common/utils/api.utils.ts (CORS helpers)
✓ Setup React Query provider
✓ Create base Server Action pattern
```

### Phase 2: Booking Module Migration (3-4 days)
**Why first?**: Most complex, if this works, others are easier

```
✓ Create booking/actions/create-booking.action.ts
✓ Create booking/hooks/useBookingsQuery.hook.tsx
✓ Update booking routes to use Server Actions
✓ Test thoroughly
✓ Remove booking.business.ts (only after verification)
```

### Phase 3: Auth Services Consolidation (2 days)
```
✓ Merge 6 auth services → 3
✓ Update all imports
✓ Test auth flows
```

### Phase 4: Prebooking & Boxes Migration (2-3 days)
```
✓ Apply same pattern as booking
✓ Create Server Actions
✓ Create React Query hooks
✓ Remove old business layers
```

### Phase 5: Cleanup (1-2 days)
```
✓ Remove console.logs
✓ Remove unused code
✓ Remove duplicate utils
✓ Update documentation
```

### Phase 6: Component Refactoring (2 days)
```
✓ Split mega-components
✓ Improve component hierarchy
✓ Extract reusable pieces
```

**Total Estimated Time**: 12-18 days (with testing)

---

## 7. QUESTIONS FOR USER CLARIFICATION

Before proceeding with refactoring, clarify:

### 7.1 Architecture Decisions

**Q1**: Are you planning to use Next.js Server Actions for mutations, or stick with API routes?
- **Recommendation**: Server Actions for internal operations, API routes for external access only

**Q2**: Do you need to maintain backwards compatibility with current API endpoints?
- If YES: Keep API routes as thin wrappers around Server Actions
- If NO: Can migrate directly to Server Actions

**Q3**: What's your authentication strategy moving forward?
- Current: Custom header `x-user-email`
- Next.js 15 pattern: `getServerSession()` from `next-auth` or similar
- **Recommendation**: Migrate to standard auth library

### 7.2 Feature Requirements

**Q4**: Do you need real-time updates for bookings?
- If YES: Consider Supabase real-time subscriptions + React Query
- If NO: Standard React Query refetch strategies are sufficient

**Q5**: Do you need offline support (PWA is configured)?
- If YES: Keep some client-side caching strategy
- If NO: React Query's default cache is sufficient

### 7.3 Migration Strategy

**Q6**: Can you afford downtime during migration?
- If YES: Big-bang migration possible
- If NO: Need feature flags and gradual rollout

**Q7**: What's your testing coverage goal during refactoring?
- Current requirement: 80%
- Should we maintain coverage at each phase?

---

## 8. FINAL VERDICT

### Overall Plan Assessment: **60/100** - Needs Significant Modifications

#### What's GOOD ✅:
1. ✅ Correctly identifies over-engineering (manual caching, triple state)
2. ✅ Service consolidation makes sense
3. ✅ React Query migration is the right call
4. ✅ CORS/auth centralization is needed
5. ✅ Console.log cleanup is important

#### What's CONCERNING ⚠️:
1. ⚠️ Complete elimination of business layer is too aggressive
2. ⚠️ Doesn't consider Next.js 15 Server Actions pattern
3. ⚠️ Missing middleware layer for auth/CORS
4. ⚠️ No testing strategy during migration
5. ⚠️ Phase order could cause breakage
6. ⚠️ Doesn't address Server Component vs Client Component patterns

#### What's MISSING ❌:
1. ❌ Server Actions implementation plan
2. ❌ Middleware creation
3. ❌ Testing safety net before refactoring
4. ❌ Progressive enhancement considerations
5. ❌ Type safety improvements with Zod + Server Actions
6. ❌ Monitoring/observability during migration

### Recommended Action:

**DO NOT proceed with the plan as-is.** Instead:

1. ✅ **Use my modified plan** (sections 5 and 6 above)
2. ✅ **Start with Phase 0** (testing safety net)
3. ✅ **Implement Server Actions** before removing business layer
4. ✅ **Migrate incrementally** (one module at a time)
5. ✅ **Measure before/after** (bundle size, performance, coverage)

### Expected Outcomes with Modified Plan:

**Code Reduction**:
- Before: ~11,702 lines
- After: ~7,000 lines (-40% instead of -36%)

**Architecture Improvements**:
- ✅ Next.js 15 best practices (Server Actions)
- ✅ Better separation of concerns
- ✅ Type-safe end-to-end
- ✅ Easier to test
- ✅ Better developer experience

**Risk Mitigation**:
- ✅ Incremental migration (less risk)
- ✅ Tests before refactoring (safety net)
- ✅ Feature parity maintained
- ✅ No breaking changes to users

---

## APPENDIX: Code Examples

### A. Server Action Pattern Example

```typescript
// modules/booking/actions/create-booking.action.ts
'use server';

import { revalidatePath } from 'next/cache';
import { BookingCreateRequestSchema } from '../api/models/booking.api';
import { bookingService } from '../api/services/booking.service';
import { getServerSession } from '@/modules/auth/utils/session.utils';

export async function createBookingAction(formData: FormData | unknown) {
  // 1. Parse and validate input
  const rawData = formData instanceof FormData
    ? Object.fromEntries(formData)
    : formData;

  const data = BookingCreateRequestSchema.parse(rawData);

  // 2. Authenticate
  const session = await getServerSession();
  if (!session) {
    return { error: 'Unauthorized', success: false };
  }

  // 3. Execute booking
  try {
    const result = await bookingService.createBooking(data, session.cookies);

    // 4. Handle business logic based on result
    if (result.state === 'ERROR_EARLY_BOOKING') {
      return await handleEarlyBookingError(data, result, session);
    }

    // 5. Revalidate affected UI
    revalidatePath('/dashboard');

    return { success: true, booking: result };
  } catch (error) {
    return { error: error.message, success: false };
  }
}

async function handleEarlyBookingError(data, result, session) {
  const availableAt = parseEarlyBookingError(result.error);

  // Create prebooking
  await prebookingService.create({
    userId: session.userId,
    scheduledAt: availableAt,
    bookingData: data,
  });

  // Schedule execution
  await queuePreBooking(availableAt);

  return {
    success: true,
    state: 'PREBOOKING_CREATED',
    availableAt
  };
}
```

### B. React Query Hook Example

```typescript
// modules/booking/hooks/useBookingsQuery.hook.tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../api/services/booking.service';
import { createBookingAction } from '../actions/create-booking.action';

export function useBookingsQuery(date: string, boxId: string) {
  return useQuery({
    queryKey: ['bookings', date, boxId],
    queryFn: async () => {
      const response = await bookingService.getBookings({
        day: date,
        box: boxId,
        _: Date.now()
      });
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!date && !!boxId, // Only fetch when params are ready
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBookingAction,
    onSuccess: () => {
      // Invalidate and refetch bookings
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (error) => {
      console.error('Booking creation failed:', error);
    },
  });
}
```

### C. Middleware Example

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-email',
};

export async function middleware(request: NextRequest) {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  }

  // Validate authentication for protected routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const userEmail = request.headers.get('x-user-email');

    // Exempt public routes
    if (!request.nextUrl.pathname.startsWith('/api/auth/')) {
      if (!userEmail) {
        return NextResponse.json(
          { error: 'Unauthorized: Missing x-user-email header' },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }

    // Add validated email to request for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-validated-user', userEmail || '');

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Add CORS headers to response
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### D. Simplified API Route Example

```typescript
// app/api/booking/route.ts (~50 lines vs 485 lines)
import { NextRequest, NextResponse } from 'next/server';
import { createBookingAction } from '@/modules/booking/actions/create-booking.action';
import { BookingCreateRequestSchema } from '@/modules/booking/api/models/booking.api';

// GET remains for external access
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params = {
    day: searchParams.get('day'),
    box: searchParams.get('box'),
    _: searchParams.get('_'),
  };

  // Validation
  if (!params.day || !params.box) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // Delegate to service (auth handled by middleware)
  const data = await bookingService.getBookings(params);
  return NextResponse.json(data);
}

// POST delegates to Server Action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = BookingCreateRequestSchema.parse(body);

    // Delegate to Server Action (reuses business logic)
    const result = await createBookingAction(validated);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## NEXT STEPS

1. **Read this analysis** and discuss with your team
2. **Answer clarification questions** (section 7)
3. **Get approval** for modified plan
4. **Start with Phase 0** (testing safety net)
5. **Iterate incrementally** (one module at a time)

---

**End of Analysis**
