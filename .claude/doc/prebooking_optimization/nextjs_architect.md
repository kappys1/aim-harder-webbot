# Next.js Architect - Prebooking Optimization Validation

**Project**: AimHarder WOD Bot 2
**Feature**: Prebooking Scheduler Optimization
**Next.js Version**: 15.5.4
**Node.js Version**: 24.8.0
**Target**: Vercel Hobby Plan (10s max execution)
**Date**: 2025-10-01

---

## Executive Summary

I've validated your proposed prebooking optimization against Next.js 15.5.4 and Vercel Hobby plan constraints. **Your approach is fundamentally sound**, but requires several critical adjustments for production safety.

**Verdict**: ✅ VIABLE with modifications detailed below.

---

## Critical Question Answers

### 1. maxDuration Configuration ✅ CORRECT

```typescript
// app/api/cron/prebooking-scheduler/route.ts
export const maxDuration = 10; // Vercel Hobby max

export async function POST(request: NextRequest) { ... }
```

**Status**: ✅ **Correct syntax for Next.js 15 App Router**

**Documentation**: [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#maxduration)

**Important Notes**:
- `maxDuration` is a **route segment config** export (not a function-level annotation)
- Vercel Hobby plan: **10 seconds max** (correct)
- Must be exported at the **top level** of route.ts (not inside function)
- Also available: `dynamic`, `revalidate`, `runtime`

**Vercel Hobby Gotchas**:
```typescript
// ✅ CORRECT
export const maxDuration = 10;
export const dynamic = 'force-dynamic'; // Disable caching for cron

// ❌ WRONG - Will be ignored
function POST() {
  const maxDuration = 10; // This does nothing
}
```

**Recommendation**: Add `dynamic = 'force-dynamic'` to ensure cron always executes fresh:

```typescript
export const maxDuration = 10;
export const dynamic = 'force-dynamic'; // Prevent caching
```

---

### 2. Supabase Client Per Invocation ⚠️ SAFE BUT NEEDS OPTIMIZATION

```typescript
export function createIsolatedSupabaseAdmin(config?: { instanceId?: string }) {
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

**Status**: ⚠️ **Safe but connection management needs attention**

**Analysis**:

#### Will connections be properly cleaned up?
**YES** - Supabase JS client uses `fetch()` under the hood, which:
- In Node.js 18+: Uses native `fetch()` with automatic connection pooling
- In Vercel serverless: Edge Runtime handles cleanup after function execution
- Connections are released when function terminates

#### Memory leaks risk in serverless?
**VERY LOW** - Vercel serverless functions:
- Are **stateless** by design
- Memory is cleared after execution
- Each invocation gets a **fresh process** (mostly)

#### Current Problem You're Facing
Your current `supabaseAdmin` proxy (line 43-50 in `core/database/supabase.ts`) creates a **shared singleton**:

```typescript
// ❌ CURRENT: Shared singleton (causes connection pool exhaustion)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!_supabaseAdmin) {
      initializeClients();
    }
    return (_supabaseAdmin as any)[prop];
  }
});
```

This singleton **persists across multiple cron invocations** when Vercel reuses the same serverless instance, leading to:
- Connection pool exhaustion (15 connections max in Supabase free tier)
- `TypeError: fetch failed` errors

#### Recommended Solution

**Option A: Per-Invocation Client (Your Proposal)** ✅ **RECOMMENDED**

```typescript
// core/database/supabase.ts - ADD THIS

interface IsolatedSupabaseConfig {
  instanceId?: string;
  timeout?: number;
}

/**
 * Create an isolated Supabase admin client for cron jobs
 * Each invocation gets a fresh client to prevent connection pool exhaustion
 */
export function createIsolatedSupabaseAdmin(config?: IsolatedSupabaseConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-instance-id': config?.instanceId || crypto.randomUUID(),
      },
    },
    auth: {
      persistSession: false, // ✅ Don't persist across invocations
      autoRefreshToken: false, // ✅ No background token refresh
    },
  });
}
```

**Why this works**:
1. **No shared state**: Fresh client per API call
2. **Auto cleanup**: Connections released when function ends
3. **Instance tracking**: `x-instance-id` header for debugging
4. **No background tasks**: No token refresh keeping connections alive

**Option B: Connection Timeout Config** (Additional Safety Layer)

Add retry logic with abort controller:

```typescript
export function createIsolatedSupabaseAdmin(config?: IsolatedSupabaseConfig) {
  const timeout = config?.timeout || 8000; // 8s default (2s buffer from 10s limit)

  // Custom fetch with timeout
  const fetchWithTimeout: typeof fetch = async (input, init?) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
    global: {
      headers: { 'x-instance-id': config?.instanceId || crypto.randomUUID() },
      fetch: fetchWithTimeout, // ✅ Custom fetch with timeout
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

---

### 3. FIFO Async with Stagger ⚠️ NETWORK ORDERING NOT GUARANTEED

```typescript
const promises = prebookings.map((prebooking, index) =>
  delay(index * 50).then(() => executeOne(prebooking))
);
await Promise.allSettled(promises);
```

**Status**: ⚠️ **50ms stagger does NOT guarantee FIFO at network level**

**Analysis**:

#### Will Node.js event loop respect this ordering?
**PARTIALLY** - The event loop will:
- ✅ **Schedule** requests in order (50ms apart)
- ❌ **NOT guarantee** they arrive in order at AimHarder API

**Why?**
1. **Network latency**: Variable latency between requests (0-500ms jitter)
2. **DNS resolution**: Different requests may resolve differently
3. **TCP handshake**: Varies per connection
4. **Server processing**: AimHarder may receive out of order

#### Is 50ms stagger enough?
**NO** for guaranteed ordering. Here's what happens:

```
Timeline (Your Approach):
15:00:03.000 - Send User A request (created_at: 15:00:00.123)
15:00:03.050 - Send User B request (created_at: 15:00:00.456)
15:00:03.100 - Send User C request (created_at: 15:00:00.789)

Network Reality:
15:00:03.080 - User B arrives (50ms network latency)
15:00:03.085 - User C arrives (15ms network latency) ← FASTER NETWORK
15:00:03.120 - User A arrives (120ms network latency)

Result: C, B, A order at AimHarder (WRONG)
```

#### Better Approach: Sequential Execution with Timeout

If **true FIFO ordering is critical**, use sequential await:

```typescript
async function executePrebookingsFIFO(
  prebookings: PreBooking[],
  instanceId: string
): Promise<ExecutionResults> {
  console.log(`[Cron ${instanceId}] Executing ${prebookings.length} prebookings FIFO...`);

  const results = { total: prebookings.length, completed: 0, failed: 0 };

  // ✅ TRUE FIFO: Sequential execution
  for (const prebooking of prebookings) {
    try {
      const session = await SupabaseSessionService.getSession(prebooking.userEmail);

      if (!session) {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'failed',
          errorMessage: 'Session not found',
          executedAt: new Date(),
        });
        results.failed++;
        continue;
      }

      // Execute booking (wait for response to ensure FIFO)
      const bookingResponse = await bookingService.createBooking(
        prebooking.bookingData,
        session.cookies
      );

      const success = bookingResponse.bookState === 1 || bookingResponse.id;

      if (success) {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'completed',
          result: { success: true, bookingId: bookingResponse.id },
          executedAt: new Date(),
        });
        results.completed++;
      } else {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'failed',
          errorMessage: bookingResponse.errorMssg || 'Booking failed',
          executedAt: new Date(),
        });
        results.failed++;
      }
    } catch (error) {
      await preBookingService.updateStatus({
        id: prebooking.id,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date(),
      });
      results.failed++;
    }
  }

  return results;
}
```

**Trade-off Analysis**:

| Approach | FIFO Guarantee | Speed | 10s Limit Risk |
|----------|---------------|-------|----------------|
| **Parallel (Promise.all)** | ❌ No | ✅ Fast (1-2s for 10 requests) | ✅ Low risk |
| **Staggered (50ms delay)** | ⚠️ Partial | ✅ Fast (1.5-3s) | ✅ Low risk |
| **Sequential (await loop)** | ✅ Yes | ⚠️ Slow (0.5s per request = 5s for 10) | ⚠️ Medium risk |

**Recommendation**:
- If **priority matters** (first created = first reserved): Use **sequential**
- If **speed matters** (maximize bookings): Use **parallel**
- **Hybrid approach** (best of both):

```typescript
// Batch processing: 3 requests at a time
const BATCH_SIZE = 3;
for (let i = 0; i < prebookings.length; i += BATCH_SIZE) {
  const batch = prebookings.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(batch.map(pb => executeOne(pb)));

  // Small delay between batches
  if (i + BATCH_SIZE < prebookings.length) {
    await delay(100);
  }
}
```

---

### 4. Stateless vs Singleton ✅ STATELESS IS CORRECT

```typescript
// NEW: Instance per call
const scheduler = new PreBookingScheduler(instanceId);
await scheduler.execute();
```

**Status**: ✅ **Stateless approach is REQUIRED for Vercel**

**Analysis**:

#### Can instances be reused and cause state corruption?
**YES** - Vercel serverless functions:
- **Reuse the same container** across multiple invocations (warm starts)
- Singleton state **persists** between requests
- Your current singleton (line 19-39 in `prebooking-scheduler.business.ts`) is **DANGEROUS**

**Current Problem**:
```typescript
// ❌ CURRENT: Singleton with shared state
export class PreBookingScheduler {
  private static instance: PreBookingScheduler;
  private loadedBookings: Map<number, LoadedPreBooking[]> = new Map();
  private activeIntervals: Map<number, NodeJS.Timeout> = new Map();
}
```

**Race Condition Scenario**:
```
15:00:03 - Cron #1 executes (warm start)
         - Loads 5 prebookings into loadedBookings Map
         - setInterval starts checking every 1s
         - Container stays warm

15:00:10 - Cron #2 executes (reuses same container)
         - Singleton.getInstance() returns SAME instance
         - loadedBookings Map STILL has 5 prebookings from Cron #1
         - Loads 3 NEW prebookings into SAME Map
         - Now has 8 prebookings (5 old + 3 new) ← DATA CORRUPTION

15:00:15 - Cron #1 interval fires
         - Executes all 8 prebookings (5 duplicates!) ← DOUBLE EXECUTION
```

#### Stateless Solution (Your Proposal) ✅

```typescript
// ✅ NEW: Stateless (no singleton, no shared maps)
export class PreBookingScheduler {
  private readonly instanceId: string;

  constructor(instanceId?: string) {
    this.instanceId = instanceId || crypto.randomUUID();
  }

  async execute(): Promise<ExecutionResult> {
    // Query prebookings ready NOW
    const readyPrebookings = await preBookingService.findReadyToExecute(
      new Date()
    );

    if (readyPrebookings.length === 0) {
      return { success: true, message: 'No prebookings ready' };
    }

    // Execute immediately (no state, no setInterval)
    const results = await executePrebookingsFIFO(readyPrebookings, this.instanceId);

    return {
      success: true,
      message: `Processed ${results.total}`,
      details: results,
    };
  }
}
```

**Why this works**:
1. **No singleton**: New instance per API call
2. **No shared state**: No Maps, no intervals
3. **Query NOW**: Only ready prebookings (not future)
4. **Immediate execution**: No setInterval waiting
5. **Fast completion**: Returns in 2-5s

#### Vercel-Specific Caching Concerns

**Module-level exports** persist across invocations:

```typescript
// ❌ BAD: Shared state (persists across invocations)
let sharedState = new Map();
export function handler() {
  sharedState.set(key, value); // ← DANGEROUS
}

// ✅ GOOD: Per-invocation state
export function handler() {
  const localState = new Map(); // ← SAFE (garbage collected)
}
```

**Your proposed route handler** (correct approach):

```typescript
// app/api/cron/prebooking-scheduler/route.ts
export async function POST(request: NextRequest) {
  const instanceId = crypto.randomUUID(); // ✅ Per-invocation ID

  // ✅ Create new scheduler instance (no shared state)
  const scheduler = new PreBookingScheduler(instanceId);
  await scheduler.execute();

  return NextResponse.json({ success: true });
}
```

---

### 5. HTTP Keep-Alive ❌ NOT AVAILABLE IN VERCEL EDGE RUNTIME

```typescript
import { Agent } from 'https';
const httpsAgent = new Agent({ keepAlive: true });
```

**Status**: ❌ **NOT supported in Vercel Edge Runtime**

**Analysis**:

#### Does Vercel Edge Runtime support `https.Agent`?
**NO** - Vercel uses:
- **Edge Runtime**: Web-standard APIs only (no Node.js `http`/`https` modules)
- **Node.js Runtime**: Has `https.Agent` BUT connection pooling is automatic

**Your current configuration** (doesn't specify runtime):
```typescript
// app/api/cron/prebooking-scheduler/route.ts
// No runtime config = defaults to Node.js runtime ✅
```

#### Is this Node.js specific?
**YES** - `https.Agent` is a Node.js API

**Better approach for connection reuse**:

**Option 1: Use Native Fetch (Recommended)** ✅

```typescript
// Node.js 18+ native fetch has automatic connection pooling
// No need for custom Agent

// ✅ Just use fetch directly
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

**Option 2: Configure Supabase Client** (If you need custom pooling)

```typescript
// Note: Supabase JS client doesn't expose connection pooling config
// It uses fetch() under the hood, which auto-pools connections

// If you REALLY need custom pooling, use Supabase server-side client:
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  global: {
    fetch: customFetchWithPooling, // Custom fetch implementation
  },
});
```

**Recommendation**:
- **Don't use `https.Agent`** - not needed and breaks Edge Runtime compatibility
- **Trust native fetch()** - Node.js 18+ has built-in connection pooling
- **Focus on timeout handling** - More important than keep-alive

---

### 6. External Cron (cron-job.org) ✅ RECOMMENDED FOR VERCEL HOBBY

**Status**: ✅ **This is the correct approach for Vercel Hobby**

**Analysis**:

#### Is this the recommended approach?
**YES** - Vercel Hobby plan does NOT support Vercel Cron:
- Vercel Cron requires **Pro plan** ($20/month)
- External cron services (cron-job.org, EasyCron, etc.) are **free alternatives**

#### Rate limiting or throttling concerns?

**Vercel Hobby Limits**:
- **100GB bandwidth/month** (outbound)
- **1000 serverless function invocations/day** ✅ **1440 minutes/day = OK**
- **10s max execution time**

**cron-job.org Configuration**:
```
URL: https://your-app.vercel.app/api/cron/prebooking-scheduler
Method: POST
Headers:
  Authorization: Bearer <CRON_SECRET>
  Content-Type: application/json
Schedule: Every 60 seconds (*/1 * * * *)
Timeout: 15 seconds (allows 10s execution + 5s network)
Retry: 0 times (prevent duplicate execution)
Notifications: Email on 3+ consecutive failures
```

**Security Best Practices**:

```typescript
// ✅ MUST verify cron secret
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!expectedAuth || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... rest of handler
}
```

**Generate strong CRON_SECRET**:
```bash
# Add to .env.local and Vercel environment variables
openssl rand -hex 32
```

**Alternative Cron Services**:
1. **cron-job.org** (free, reliable, EU-based)
2. **EasyCron** (free tier: 5 cron jobs)
3. **GitHub Actions** (free, but slower - 5min minimum interval)
4. **Render Cron Jobs** (free tier available)

---

### 7. Error Handling Near Timeout ⚠️ NEEDS TIMEOUT GUARD

**Status**: ⚠️ **Need graceful degradation near 10s limit**

**Current Risk**:
```typescript
// Your function runs for ~5-8 seconds
// If it reaches 9.8s, Vercel kills it mid-execution
// Result: Partial updates, inconsistent state
```

**Recommended Solution**:

**Option A: Timeout Guard with Remaining Time Check** ✅

```typescript
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const TIMEOUT_BUFFER = 2000; // 2s buffer
  const MAX_EXECUTION = (maxDuration * 1000) - TIMEOUT_BUFFER; // 8s

  const instanceId = crypto.randomUUID();

  try {
    const now = new Date();
    const readyPrebookings = await preBookingService.findReadyToExecute(now);

    if (readyPrebookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prebookings ready',
        instanceId,
      });
    }

    // ✅ Check remaining time before execution
    const elapsed = Date.now() - startTime;
    const remaining = MAX_EXECUTION - elapsed;

    if (remaining < 1000) {
      console.warn(`[Cron ${instanceId}] Insufficient time remaining: ${remaining}ms`);
      return NextResponse.json({
        success: false,
        message: 'Insufficient time to execute prebookings',
        instanceId,
        prebookingsFound: readyPrebookings.length,
      }, { status: 504 }); // Gateway Timeout
    }

    // Execute with timeout awareness
    const results = await executePrebookingsWithTimeout(
      readyPrebookings,
      instanceId,
      remaining
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} prebookings`,
      results,
      instanceId,
      executionTimeMs: Date.now() - startTime,
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[Cron ${instanceId}] Error after ${executionTime}ms:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      instanceId,
      executionTimeMs: executionTime,
    }, { status: 500 });
  }
}
```

**Option B: Batch Processing with Time Checks** ✅

```typescript
async function executePrebookingsWithTimeout(
  prebookings: PreBooking[],
  instanceId: string,
  maxTimeMs: number
): Promise<ExecutionResults> {
  const startTime = Date.now();
  const results = { total: prebookings.length, completed: 0, failed: 0, skipped: 0 };

  console.log(`[Cron ${instanceId}] Executing up to ${prebookings.length} prebookings with ${maxTimeMs}ms timeout...`);

  for (const prebooking of prebookings) {
    // ✅ Check time before each execution
    const elapsed = Date.now() - startTime;
    const remaining = maxTimeMs - elapsed;

    if (remaining < 500) {
      console.warn(`[Cron ${instanceId}] Timeout approaching, skipping remaining ${prebookings.length - results.completed - results.failed} prebookings`);
      results.skipped = prebookings.length - results.completed - results.failed;
      break;
    }

    try {
      const session = await SupabaseSessionService.getSession(prebooking.userEmail);

      if (!session) {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'failed',
          errorMessage: 'Session not found',
          executedAt: new Date(),
        });
        results.failed++;
        continue;
      }

      const bookingResponse = await bookingService.createBooking(
        prebooking.bookingData,
        session.cookies
      );

      const success = bookingResponse.bookState === 1 || bookingResponse.id;

      if (success) {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'completed',
          executedAt: new Date(),
        });
        results.completed++;
      } else {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'failed',
          errorMessage: bookingResponse.errorMssg || 'Booking failed',
          executedAt: new Date(),
        });
        results.failed++;
      }

    } catch (error) {
      await preBookingService.updateStatus({
        id: prebooking.id,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date(),
      });
      results.failed++;
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[Cron ${instanceId}] Execution complete in ${totalTime}ms - Completed: ${results.completed}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

  return results;
}
```

**Best Practices**:
1. **2-3s buffer**: Keep 2-3s margin before timeout
2. **Graceful degradation**: Skip remaining work if time runs out
3. **Partial success**: Return what was completed
4. **Retry on next run**: Skipped prebookings will be picked up by next cron

---

## Architecture Validation

### Overall Approach ✅ SOUND

Your stateless execution strategy is **fundamentally correct** for Vercel Hobby:

✅ **Strengths**:
1. Query ready prebookings NOW (not future window)
2. Immediate execution (no setInterval)
3. Stateless scheduler (no shared state)
4. Per-invocation Supabase client (prevents pool exhaustion)
5. Fast execution (2-5s within 10s limit)
6. External cron (Hobby plan compatible)

⚠️ **Areas for Improvement**:
1. FIFO ordering needs sequential execution OR acceptance of partial ordering
2. Timeout guard needed for graceful degradation
3. Add retry logic for failed DB operations
4. Add monitoring/alerting for execution times

---

## Implementation Recommendations

### Priority 1: Core Changes (MUST HAVE)

#### 1.1 Update Route Handler

```typescript
// app/api/cron/prebooking-scheduler/route.ts

export const maxDuration = 10; // Vercel Hobby max
export const dynamic = 'force-dynamic'; // Prevent caching

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const instanceId = crypto.randomUUID();
  const TIMEOUT_BUFFER = 2000; // 2s safety margin
  const MAX_EXECUTION = (maxDuration * 1000) - TIMEOUT_BUFFER;

  // Auth check
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!expectedAuth || authHeader !== expectedAuth) {
    console.error(`[Cron ${instanceId}] Unauthorized access attempt`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[Cron ${instanceId}] Starting execution at ${new Date().toISOString()}`);

    // Query prebookings ready NOW
    const now = new Date();
    const readyPrebookings = await preBookingService.findReadyToExecute(now);

    if (readyPrebookings.length === 0) {
      console.log(`[Cron ${instanceId}] No prebookings ready`);
      return NextResponse.json({
        success: true,
        message: 'No prebookings ready',
        instanceId,
        timestamp: now.toISOString(),
      });
    }

    console.log(`[Cron ${instanceId}] Found ${readyPrebookings.length} ready prebookings`);

    // Check remaining time
    const elapsed = Date.now() - startTime;
    const remaining = MAX_EXECUTION - elapsed;

    if (remaining < 1000) {
      console.warn(`[Cron ${instanceId}] Insufficient time: ${remaining}ms`);
      return NextResponse.json({
        success: false,
        message: 'Insufficient time to execute',
        instanceId,
        prebookingsFound: readyPrebookings.length,
      }, { status: 504 });
    }

    // Execute with timeout awareness
    const results = await executePrebookingsWithTimeout(
      readyPrebookings,
      instanceId,
      remaining
    );

    const totalTime = Date.now() - startTime;
    console.log(`[Cron ${instanceId}] Completed in ${totalTime}ms:`, results);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} prebookings`,
      results,
      instanceId,
      executionTimeMs: totalTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Cron ${instanceId}] Error after ${totalTime}ms:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      instanceId,
      executionTimeMs: totalTime,
    }, { status: 500 });
  }
}
```

#### 1.2 Add findReadyToExecute Service Method

```typescript
// modules/prebooking/api/services/prebooking.service.ts

/**
 * Find prebookings ready to execute NOW
 * Only returns prebookings with available_at <= current time
 */
async findReadyToExecute(now: Date): Promise<PreBooking[]> {
  console.log('[PreBookingService] Querying ready prebookings:', {
    status: 'pending',
    availableAt: `<= ${now.toISOString()}`,
  });

  const { data, error } = await this.supabase
    .from('prebookings')
    .select('*')
    .eq('status', 'pending')
    .lte('available_at', now.toISOString()) // ✅ Ready NOW (not future)
    .order('created_at', { ascending: true }) // FIFO
    .limit(50); // Safety limit (adjust based on avg execution time)

  if (error) {
    console.error('[PreBookingService] Error finding ready prebookings:', error);
    throw new Error(`Failed to find ready prebookings: ${error.message}`);
  }

  console.log('[PreBookingService] Found ready prebookings:', {
    count: data?.length || 0,
    prebookings: data?.map(p => ({
      id: p.id,
      email: p.user_email,
      availableAt: p.available_at,
    })),
  });

  if (!data || data.length === 0) {
    return [];
  }

  const validated = data.map(item => PreBookingApiSchema.parse(item));
  return PreBookingMapper.toDomainList(validated);
}
```

#### 1.3 Create Isolated Supabase Client

```typescript
// core/database/supabase.ts - ADD

interface IsolatedSupabaseConfig {
  instanceId?: string;
  timeout?: number;
}

/**
 * Create an isolated Supabase admin client for cron jobs
 * Each invocation gets a fresh client to prevent connection pool exhaustion
 */
export function createIsolatedSupabaseAdmin(config?: IsolatedSupabaseConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const timeout = config?.timeout || 8000; // 8s default

  // Custom fetch with timeout
  const fetchWithTimeout: typeof fetch = async (input, init?) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Supabase request timeout after ${timeout}ms`);
      }
      throw error;
    }
  };

  return createClient(supabaseUrl, supabaseServiceKey, {
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-instance-id': config?.instanceId || crypto.randomUUID(),
      },
      fetch: fetchWithTimeout,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

#### 1.4 Remove Singleton Pattern

```typescript
// modules/prebooking/business/prebooking-scheduler.business.ts

import { AuthCookie } from "@/modules/auth/api/services/cookie.service";
import { SupabaseSessionService } from "@/modules/auth/api/services/supabase-session.service";
import { bookingService } from "@/modules/booking/api/services/booking.service";
import { preBookingService } from "../api/services/prebooking.service";
import { PreBooking } from "../models/prebooking.model";

interface ExecutionResult {
  success: boolean;
  message: string;
  details: any;
}

interface ExecutionResults {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
}

/**
 * PreBooking Scheduler - Stateless
 *
 * Executes prebookings ready NOW (no pre-loading, no setInterval)
 * Designed for Vercel Hobby plan (10s max execution)
 */
export class PreBookingScheduler {
  private readonly instanceId: string;

  constructor(instanceId?: string) {
    this.instanceId = instanceId || crypto.randomUUID();
    console.log(`[PreBookingScheduler ${this.instanceId}] Initialized`);
  }

  /**
   * Execute prebookings ready NOW
   * Returns within 10s timeout
   */
  async execute(): Promise<ExecutionResult> {
    const startTime = Date.now();
    console.log(`[PreBookingScheduler ${this.instanceId}] Starting execution...`);

    try {
      // Query prebookings ready NOW
      const now = new Date();
      const readyPrebookings = await preBookingService.findReadyToExecute(now);

      if (readyPrebookings.length === 0) {
        console.log(`[PreBookingScheduler ${this.instanceId}] No prebookings ready`);
        return {
          success: true,
          message: 'No prebookings ready',
          details: { count: 0 },
        };
      }

      console.log(`[PreBookingScheduler ${this.instanceId}] Found ${readyPrebookings.length} ready prebooking(s)`);

      // Execute immediately (no waiting)
      const results = await this.executePrebookingsFIFO(readyPrebookings);

      const totalTime = Date.now() - startTime;
      console.log(`[PreBookingScheduler ${this.instanceId}] Completed in ${totalTime}ms:`, results);

      return {
        success: true,
        message: `Processed ${results.total} prebooking(s)`,
        details: {
          ...results,
          executionTimeMs: totalTime,
        },
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[PreBookingScheduler ${this.instanceId}] Error after ${totalTime}ms:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error, executionTimeMs: totalTime },
      };
    }
  }

  /**
   * Execute prebookings in FIFO order (sequential for guaranteed ordering)
   */
  private async executePrebookingsFIFO(
    prebookings: PreBooking[]
  ): Promise<ExecutionResults> {
    const results = { total: prebookings.length, completed: 0, failed: 0, skipped: 0 };

    console.log(`[PreBookingScheduler ${this.instanceId}] Executing ${prebookings.length} prebooking(s) in FIFO order...`);

    // Sequential execution for guaranteed FIFO ordering
    for (const prebooking of prebookings) {
      try {
        await this.executeOne(prebooking);
        results.completed++;
      } catch (error) {
        console.error(`[PreBookingScheduler ${this.instanceId}] Error executing prebooking ${prebooking.id}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Execute a single prebooking
   */
  private async executeOne(prebooking: PreBooking): Promise<void> {
    console.log(`[PreBookingScheduler ${this.instanceId}] Executing prebooking ${prebooking.id} for ${prebooking.userEmail}...`);

    try {
      // Get user session
      const session = await SupabaseSessionService.getSession(prebooking.userEmail);

      if (!session) {
        console.error(`[PreBookingScheduler ${this.instanceId}] No session found for ${prebooking.userEmail}`);
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'failed',
          errorMessage: 'User session not found',
          executedAt: new Date(),
        });
        return;
      }

      // Execute booking
      const executionStart = Date.now();
      const bookingResponse = await bookingService.createBooking(
        prebooking.bookingData,
        session.cookies
      );
      const executionTime = Date.now() - executionStart;

      console.log(`[PreBookingScheduler ${this.instanceId}] Booking execution took ${executionTime}ms - bookState: ${bookingResponse.bookState}, bookingId: ${bookingResponse.id || 'N/A'}`);

      // Update with result
      const bookingCreated = bookingResponse.bookState === 1 || (bookingResponse.id && +bookingResponse.id > 0);

      if (bookingCreated) {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'completed',
          executedAt: new Date(),
          result: {
            success: true,
            bookingId: bookingResponse.id,
            bookState: bookingResponse.bookState,
            message: 'Booking created successfully',
            executedAt: new Date(),
          },
        });
        console.log(`[PreBookingScheduler ${this.instanceId}] ✅ Prebooking ${prebooking.id} completed successfully`);
      } else {
        await preBookingService.updateStatus({
          id: prebooking.id,
          status: 'failed',
          executedAt: new Date(),
          result: {
            success: false,
            bookState: bookingResponse.bookState,
            message: bookingResponse.errorMssg || 'Booking failed',
            executedAt: new Date(),
          },
          errorMessage: bookingResponse.errorMssg,
        });
        console.log(`[PreBookingScheduler ${this.instanceId}] ❌ Prebooking ${prebooking.id} failed - bookState: ${bookingResponse.bookState}`);
      }

    } catch (error) {
      console.error(`[PreBookingScheduler ${this.instanceId}] Error executing prebooking ${prebooking.id}:`, error);
      await preBookingService.updateStatus({
        id: prebooking.id,
        status: 'failed',
        executedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Execution error',
      });
    }
  }
}

// ❌ REMOVE: Singleton export
// export const preBookingScheduler = PreBookingScheduler.getInstance();
```

### Priority 2: Optional Enhancements (NICE TO HAVE)

#### 2.1 Monitoring & Alerting

```typescript
// Add execution time tracking
interface ExecutionMetrics {
  instanceId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  prebookingsProcessed: number;
  completed: number;
  failed: number;
  status: 'success' | 'timeout' | 'error';
}

// Log to external service (e.g., Sentry, Datadog)
async function logMetrics(metrics: ExecutionMetrics) {
  // Send to monitoring service
  console.log('[Metrics]', JSON.stringify(metrics));
}
```

#### 2.2 Retry Logic for Transient Failures

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after error:`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError!;
}

// Usage
const bookingResponse = await executeWithRetry(
  () => bookingService.createBooking(prebooking.bookingData, session.cookies),
  2, // max retries
  200 // initial delay
);
```

#### 2.3 Graceful Shutdown Handler

```typescript
// Handle SIGTERM for graceful shutdown
let isShuttingDown = false;

process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, marking for shutdown');
  isShuttingDown = true;
});

async function executePrebookingsWithShutdown(...) {
  for (const prebooking of prebookings) {
    if (isShuttingDown) {
      console.log('[Shutdown] Gracefully stopping execution');
      results.skipped = prebookings.length - results.completed - results.failed;
      break;
    }

    // ... execute prebooking
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/prebooking-scheduler.test.ts

describe('PreBookingScheduler', () => {
  describe('stateless execution', () => {
    it('should create new instance per execution', () => {
      const scheduler1 = new PreBookingScheduler('instance-1');
      const scheduler2 = new PreBookingScheduler('instance-2');

      expect(scheduler1).not.toBe(scheduler2);
    });

    it('should execute prebookings ready NOW only', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 60000);

      // Mock service
      jest.spyOn(preBookingService, 'findReadyToExecute')
        .mockResolvedValue([/* ready prebookings */]);

      const scheduler = new PreBookingScheduler();
      await scheduler.execute();

      expect(preBookingService.findReadyToExecute).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });
  });

  describe('FIFO ordering', () => {
    it('should execute prebookings in created_at order', async () => {
      const executionOrder: string[] = [];

      // Track execution order
      jest.spyOn(bookingService, 'createBooking')
        .mockImplementation((data) => {
          executionOrder.push(data.userId);
          return Promise.resolve({ bookState: 1, id: '123' });
        });

      const scheduler = new PreBookingScheduler();
      await scheduler.execute();

      expect(executionOrder).toEqual(['user1', 'user2', 'user3']);
    });
  });

  describe('timeout handling', () => {
    it('should complete within 8s with buffer', async () => {
      const startTime = Date.now();

      const scheduler = new PreBookingScheduler();
      await scheduler.execute();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(8000);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/api/cron/prebooking-scheduler.test.ts

describe('POST /api/cron/prebooking-scheduler', () => {
  it('should require authentication', async () => {
    const response = await fetch('/api/cron/prebooking-scheduler', {
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  it('should execute prebookings ready NOW', async () => {
    const response = await fetch('/api/cron/prebooking-scheduler', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.instanceId).toBeDefined();
  });

  it('should complete within 10s timeout', async () => {
    const startTime = Date.now();

    const response = await fetch('/api/cron/prebooking-scheduler', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000);
  });
});
```

### Load Tests

```bash
# Test concurrent cron invocations
for i in {1..5}; do
  curl -X POST https://your-app.vercel.app/api/cron/prebooking-scheduler \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" &
done
wait

# Verify no race conditions or duplicate executions
```

---

## Deployment Checklist

### Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
CRON_SECRET=<generate with: openssl rand -hex 32>

# Vercel Environment Variables (production)
# Add all above variables in Vercel Dashboard
# Environment: Production
# Scope: All Environments
```

### Vercel Configuration

```json
// vercel.json (if needed)
{
  "functions": {
    "app/api/cron/prebooking-scheduler/route.ts": {
      "maxDuration": 10
    }
  }
}
```

### cron-job.org Setup

1. Sign up at https://console.cron-job.org
2. Create new cron job:
   - **Title**: Prebooking Scheduler
   - **URL**: `https://your-app.vercel.app/api/cron/prebooking-scheduler`
   - **Schedule**: Every minute (`* * * * *`)
   - **Request method**: POST
   - **Request headers**:
     ```
     Authorization: Bearer <CRON_SECRET>
     Content-Type: application/json
     ```
   - **Timeout**: 15 seconds
   - **Retry**: Disabled (prevent duplicate execution)
   - **Notifications**: Email on 3+ consecutive failures

### Monitoring Setup

1. **Vercel Logs**: Monitor execution times and errors
2. **Supabase Logs**: Track DB query performance
3. **cron-job.org Notifications**: Alert on failures

---

## Migration Plan

### Phase 1: Preparation (Low Risk)

1. ✅ Add `findReadyToExecute()` method to `PreBookingService`
2. ✅ Add `createIsolatedSupabaseAdmin()` to `core/database/supabase.ts`
3. ✅ Deploy to production (not used yet, zero impact)

### Phase 2: New Implementation (Medium Risk)

4. ✅ Create new `PreBookingSchedulerV2` class (stateless)
5. ✅ Update route handler to use V2
6. ✅ Add `maxDuration` and `dynamic` exports
7. ✅ Deploy to production
8. ⚠️ Test with cron-job.org on staging environment first

### Phase 3: Cutover (High Risk)

9. ✅ Update cron-job.org to call new endpoint
10. ✅ Monitor logs for first 24 hours
11. ✅ Verify no duplicate executions
12. ✅ Check execution times < 10s

### Phase 4: Cleanup (Low Risk)

13. ✅ Remove old `PreBookingScheduler` singleton
14. ✅ Remove `findPendingInTimeRange()` method (if not used elsewhere)
15. ✅ Update documentation

---

## Performance Benchmarks

### Expected Metrics (10 prebookings)

| Operation | Time (ms) | Notes |
|-----------|----------|-------|
| **Auth check** | 5-10 | Header verification |
| **Query ready prebookings** | 50-100 | Supabase SELECT query |
| **Get user session** (per user) | 30-50 | Supabase SELECT query |
| **Execute booking** (per user) | 200-500 | External API call to AimHarder |
| **Update status** (per user) | 30-50 | Supabase UPDATE query |
| **Total (sequential)** | 3000-6000 | ~300-600ms per prebooking |
| **Total (parallel)** | 800-1500 | All bookings sent simultaneously |

### Scaling Limits

| Prebookings | Sequential Time | Parallel Time | Recommendation |
|-------------|----------------|---------------|----------------|
| **1-10** | 0.5-3s | 0.5-1s | ✅ Safe (both approaches) |
| **11-20** | 3-6s | 1-2s | ✅ Safe (prefer parallel) |
| **21-30** | 6-9s | 2-3s | ⚠️ Risky (use timeout guard) |
| **31+** | 9s+ | 3s+ | ❌ Exceeds limit (batch across multiple cron runs) |

### Recommended Approach

For **FIFO ordering + safety**:
- Use **sequential execution** for <= 15 prebookings
- Use **batch processing** (5 at a time) for > 15 prebookings
- Add **timeout guard** to skip remaining if approaching 8s

```typescript
// Hybrid approach
const BATCH_SIZE = 5;
const MAX_BATCH_TIME = 1500; // 1.5s per batch

for (let i = 0; i < prebookings.length; i += BATCH_SIZE) {
  const remaining = (maxDuration * 1000) - TIMEOUT_BUFFER - (Date.now() - startTime);

  if (remaining < MAX_BATCH_TIME) {
    console.warn('Timeout approaching, skipping remaining batches');
    break;
  }

  const batch = prebookings.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(batch.map(pb => executeOne(pb)));
}
```

---

## Risk Assessment

### High Risk Areas ⚠️

1. **Race Conditions**: Multiple cron instances executing same prebooking
   - **Mitigation**: Atomic `claimPrebooking()` with status check (already implemented)

2. **Timeout Exceeded**: Function killed mid-execution
   - **Mitigation**: Timeout guard with 2s buffer + partial success handling

3. **Connection Pool Exhaustion**: Too many concurrent DB connections
   - **Mitigation**: Isolated Supabase client per invocation

### Medium Risk Areas ⚠️

4. **FIFO Ordering**: Network jitter breaks order
   - **Mitigation**: Use sequential execution OR accept partial ordering

5. **External API Failures**: AimHarder API down or slow
   - **Mitigation**: Add retry logic + timeout per request

### Low Risk Areas ✅

6. **Authentication**: Unauthorized cron calls
   - **Mitigation**: Strong `CRON_SECRET` + request header validation

7. **Rate Limiting**: Vercel function invocation limits
   - **Mitigation**: Hobby plan allows 1440 calls/day (sufficient for 1/minute)

---

## Comparison: Old vs New

| Aspect | OLD (setInterval) | NEW (Execute NOW) |
|--------|-------------------|-------------------|
| **Execution time** | 118s ❌ | 2-5s ✅ |
| **Vercel Hobby compatible** | ❌ No (exceeds 10s) | ✅ Yes (within limit) |
| **Code complexity** | ~400 lines | ~150 lines |
| **Shared state** | ❌ Singleton + Maps | ✅ Stateless |
| **Race conditions** | ⚠️ Possible | ✅ None |
| **Connection errors** | ❌ fetch failed | ✅ Retry logic |
| **FIFO precision** | ±1s (setInterval) | ±3s (cron jitter) |
| **Maintainability** | ⚠️ Complex | ✅ Simple |
| **Scalability** | ❌ Limited | ✅ Good |

---

## Final Recommendations

### ✅ DO

1. **Implement stateless execution** (your proposal is correct)
2. **Add timeout guard** with 2s buffer
3. **Use sequential execution** for guaranteed FIFO (if critical)
4. **Create isolated Supabase client** per invocation
5. **Add `maxDuration = 10` and `dynamic = 'force-dynamic'`**
6. **Use cron-job.org** for external cron trigger
7. **Monitor execution times** closely for first week
8. **Add retry logic** for transient failures

### ❌ DON'T

1. **Don't use `https.Agent`** (not needed, breaks Edge Runtime)
2. **Don't rely on 50ms stagger** for FIFO (use sequential instead)
3. **Don't use shared singleton** (causes race conditions)
4. **Don't query future prebookings** (query NOW only)
5. **Don't exceed 8s execution** (leave 2s buffer)
6. **Don't skip authentication** (verify CRON_SECRET always)

### 🎯 Critical Success Factors

1. **Timeout management**: Most important for Vercel Hobby
2. **Stateless design**: Prevents race conditions
3. **FIFO ordering**: Decide if strict ordering is worth performance trade-off
4. **Monitoring**: Track execution times and failure rates
5. **Graceful degradation**: Handle partial success scenarios

---

## Questions to Clarify with User

### 1. FIFO Ordering Priority

**Question**: Is strict FIFO ordering (first created = first reserved) **absolutely critical**?

**Context**:
- Sequential execution guarantees FIFO but is slower (5-6s for 10 users)
- Parallel execution is faster (1-2s) but may have 50-100ms ordering variance due to network jitter

**Options**:
- **A**: Strict FIFO required → Use sequential execution
- **B**: Best-effort FIFO acceptable → Use parallel with stagger
- **C**: Speed priority → Use full parallel (no stagger)

### 2. Batch Size Limit

**Question**: What's the maximum expected number of prebookings per minute?

**Context**:
- Current limit: 50 (in `findReadyToExecute()`)
- Sequential execution: ~600ms per prebooking
- 10 prebookings = 6s (safe), 15 = 9s (risky), 20+ = exceeds timeout

**Recommendation**: Set realistic limit based on expected load

### 3. Failure Handling

**Question**: If timeout is approaching and 5/10 prebookings are complete, what should happen?

**Options**:
- **A**: Return success with partial results (5 completed, 5 skipped → next run picks them up)
- **B**: Return error (all or nothing)
- **C**: Extend to multiple cron runs (execute 10 per run, queue overflow)

### 4. Monitoring Requirements

**Question**: Do you need real-time alerting for failures, or is manual log checking sufficient?

**Options**:
- **A**: Manual (free) - Check Vercel logs + cron-job.org dashboard
- **B**: Email alerts (free) - cron-job.org email notifications
- **C**: Advanced monitoring (paid) - Sentry, Datadog, etc.

---

## Conclusion

Your proposed architecture is **sound and production-ready** with the following adjustments:

1. ✅ Add `maxDuration = 10` and `dynamic = 'force-dynamic'`
2. ✅ Implement `findReadyToExecute()` (query NOW only)
3. ✅ Create `createIsolatedSupabaseAdmin()` (per-invocation client)
4. ✅ Remove singleton pattern (stateless scheduler)
5. ⚠️ Choose execution strategy: sequential (strict FIFO) vs parallel (speed)
6. ⚠️ Add timeout guard with 2s buffer
7. ⚠️ Implement retry logic for transient failures

**Expected outcome**:
- ✅ No more `TypeError: fetch failed`
- ✅ No more 118s execution (2-5s instead)
- ✅ No more race conditions (stateless)
- ✅ Vercel Hobby compatible (within 10s limit)
- ✅ Simpler codebase (62% less code)

**Next steps**:
1. Clarify FIFO ordering requirements (see questions above)
2. Implement changes in staging environment
3. Test with production-like load
4. Deploy to production with monitoring
5. Monitor for 24-48 hours before full rollout

---

**Document version**: 1.0
**Last updated**: 2025-10-01
**Author**: Next.js Architect Agent
**Status**: Ready for implementation
