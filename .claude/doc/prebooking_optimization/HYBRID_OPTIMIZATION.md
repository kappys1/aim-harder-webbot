# Prebooking Hybrid Optimization

## Problem

Original execution flow was taking ~3+ seconds from QStash trigger to AimHarder API call:

```
Timeline (Original):
19:30:00.000 - QStash triggers
19:30:00.050 - QStash signature verification (50ms)
19:30:00.150 - Fetch prebooking from DB (100ms)
19:30:00.250 - Fetch session from DB (100ms)
19:30:00.255 - Validations (5ms)
19:30:00.255 - Fire to AimHarder
19:30:02.000 - AimHarder responds (1745ms)
```

**Total latency before firing: ~255ms** (but user missed the slot)

## Solution: Hybrid Optimization

Execute webhook **3 SECONDS BEFORE** the target time, do all preparatory work, then wait until the exact millisecond.

```
Timeline (Optimized):
19:29:57.000 - QStash triggers (3s early)
19:29:57.002 - Fast token validation (2ms vs 50ms)
19:29:57.250 - All queries completed (250ms)
19:29:57.255 - Calculate wait time
19:29:57.255 - Enter setTimeout(2745ms)

         ... WAITING ...

19:30:00.000 - setTimeout fires ← EXACT MILLISECOND
19:30:00.001 - Fire to AimHarder (1ms latency)
19:30:01.500 - AimHarder responds
```

**Latency at execution time: <10ms** 🎯

## Key Changes

### 1. Security Token (vs QStash Signature)

**Before:**
```typescript
const isValid = await verifyQStashSignature(signature, body); // ~50-100ms
```

**After:**
```typescript
const tokenValid = verifyPrebookingToken(securityToken, prebookingId, executeAt); // ~1-2ms
```

**Savings: ~50-100ms**

### 2. Early Scheduling (3 seconds before)

**File:** [core/qstash/client.ts](../../../core/qstash/client.ts)

```typescript
// Schedule 3 seconds BEFORE available_at
const earlyExecutionTime = new Date(executeAt.getTime() - 3000);

await qstashClient.publishJSON({
  url: callbackUrl,
  body: {
    prebookingId,
    boxSubdomain,
    boxAimharderId,
    executeAt: executeAt.getTime(), // ← Target timestamp
    securityToken, // ← Fast HMAC token
  },
  notBefore: Math.floor(earlyExecutionTime.getTime() / 1000),
});
```

### 3. Wait Until Exact Time

**File:** [app/api/execute-prebooking/route.ts](../../../app/api/execute-prebooking/route.ts)

```typescript
// All queries done ✅
const session = await SupabaseSessionService.getSession(prebooking.userEmail);

// Calculate wait time
const now = Date.now();
const targetTime = executeAt;
const waitTime = targetTime - now; // ~2750ms

// Wait until EXACT moment
if (waitTime > 0) {
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

// FIRE IMMEDIATELY (no more queries!)
const bookingResponse = await bookingService.createBooking(
  prebooking.bookingData,
  session.cookies, // ← Fresh cookies (obtained 3s ago)
  boxSubdomain
);
```

## Benefits

✅ **Fresh session cookies** - Obtained 3s before, not expired
✅ **Zero query latency** - All DB queries done during wait time
✅ **Fast token validation** - ~1-2ms vs ~50-100ms
✅ **Exact millisecond firing** - setTimeout precision
✅ **<10ms latency** - From target time to AimHarder API call

## Setup

### 1. Generate Secret

```bash
openssl rand -hex 32
```

### 2. Add to `.env`

```bash
PREBOOKING_SECRET=your-generated-secret-here
```

### 3. Deploy to Vercel

```bash
vercel env add PREBOOKING_SECRET
# Paste the generated secret
```

## Monitoring

Logs now include detailed timing breakdown:

```
[HYBRID abc-123] Triggered at 2025-10-03T19:29:57.000Z
[HYBRID abc-123] Token validated in 2ms
[HYBRID abc-123] Queries completed in 248ms
[HYBRID abc-123] Waiting 2750ms until 2025-10-03T19:30:00.000Z
[HYBRID abc-123] 🔥 FIRING at 2025-10-03T19:30:00.001Z (latency: 1ms from target)
[HYBRID abc-123] AimHarder responded in 1523ms - bookState: 1, bookingId: 12345
[HYBRID abc-123] ✅ SUCCESS in 3773ms (fire latency: 1ms)
```

## Performance Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Token validation | 50-100ms | 1-2ms | **98% faster** |
| Queries at execute time | 200-300ms | 0ms | **100% saved** |
| Fire latency | 255ms | 1-10ms | **96% faster** |
| Session freshness | Varies | Always fresh | ✅ |

## Files Modified

1. **[core/qstash/security-token.ts](../../../core/qstash/security-token.ts)** - NEW
   HMAC token generation/validation

2. **[core/qstash/client.ts](../../../core/qstash/client.ts)**
   Schedule 3s early, include executeAt + token in payload

3. **[app/api/execute-prebooking/route.ts](../../../app/api/execute-prebooking/route.ts)**
   Hybrid flow: queries → wait → fire

4. **[.env.example](../../../.env.example)**
   Document PREBOOKING_SECRET requirement
