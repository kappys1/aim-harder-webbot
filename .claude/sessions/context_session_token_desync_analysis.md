# Token Desynchronization Analysis - Critical Production Issue

## Executive Summary

**CRITICAL ACKNOWLEDGMENT:** My previous architectural analysis was fundamentally incorrect. I claimed the cron job only updates background sessions, but the code clearly shows it updates **BOTH background AND device sessions**. This causes the exact desynchronization problem the user reported.

## Verified Error in Previous Analysis

### What I Said (INCORRECT)
> "Your desynchronization problem doesn't exist because:
> 1. Each session has its own token (background vs device)
> 2. Cron updates background, frontend updates device
> 3. They never interfere with each other"

### What Actually Happens (VERIFIED)

```typescript
// Line 478-489: supabase-session.service.ts
static async getAllActiveSessions(): Promise<SessionData[]> {
  const { data, error } = await supabaseAdmin
    .from("auth_sessions")
    .select("*")
    .or(
      `session_type.eq.background,` +                            // Background sessions
      `and(session_type.eq.device,created_at.gte.${oneWeekAgo})` // DEVICE SESSIONS TOO!
    );
}

// Line 54: cron/refresh-tokens/route.ts
const sessions = await SupabaseSessionService.getAllActiveSessions();
// ↑ Returns BOTH background AND device sessions

// Line 66-112: cron/refresh-tokens/route.ts
for (const session of sessions) {  // Iterates ALL sessions including device
  const updateResult = await AimharderRefreshService.updateToken({
    token: session.token,
    fingerprint: session.fingerprint,  // Updates EACH session
    cookies: session.cookies,
  });

  // Line 181-184: Updates DB token for THIS specific session (device or background)
  await SupabaseSessionService.updateRefreshToken(
    session.email,
    updateResult.newToken,
    session.fingerprint // Targets specific session via fingerprint
  );
}
```

## Root Cause Analysis

### The Actual Flow (Verified)

```
T0: User login
    ├─ localStorage: tokenA (device)
    └─ Supabase DB: tokenA (device session)

T1: User closes app
    └─ localStorage: tokenA (stale)

T2: Cron runs (every 20 minutes)
    ├─ Fetches ALL active sessions (background + device)
    ├─ Updates AimHarder API with tokenA → receives tokenB
    ├─ Saves tokenB to DB (device session)
    └─ localStorage: tokenA (now stale)

T3: User reopens app (~1 hour later)
    ├─ localStorage: tokenA (stale)
    ├─ DB: tokenB (updated by cron)
    └─ DESYNC DETECTED

T4: VIEW Classes API call
    ├─ Backend: GET /api/booking/route.ts:64
    ├─ Uses: getSession(userEmail) → tokenB from DB ✅
    └─ Result: SUCCESS (shows classes)

T5: BOOK Class API call
    ├─ Frontend: booking.service.ts:128
    ├─ Uses: localStorage cookies → tokenA (stale) ❌
    └─ Result: FAIL (booking disabled, silent error)
```

## The Critical Difference: Why VIEW Works but BOOK Fails

### VIEW Classes (GET /api/booking)
- **Flow:** Frontend → Next.js API Route → Supabase DB
- **Location:** `/app/api/booking/route.ts:64`
- **Token Source:** `SupabaseSessionService.getSession(userEmail)` → **DB (tokenB)** ✅
- **Result:** SUCCESS - always uses latest token from DB

```typescript
// Line 64: app/api/booking/route.ts
const session = await SupabaseSessionService.getSession(userEmail);
// ↑ Fetches from DB (tokenB) - always fresh

const cookieString = session.cookies
  .map((cookie) => `${cookie.name}=${cookie.value}`)
  .join("; ");
// ↑ Uses DB cookies for external API call
```

### BOOK Class (POST via booking.service.ts)
- **Flow:** Frontend → booking.service.ts → AimHarder API
- **Location:** `/modules/booking/api/services/booking.service.ts:128`
- **Token Source:** `cookies` parameter (from localStorage context) → **localStorage (tokenA)** ❌
- **Result:** FAIL - uses stale token from localStorage

```typescript
// Line 154-156: booking.service.ts
if (cookies && cookies.length > 0) {
  headers["Cookie"] = CookieService.formatForRequest(cookies);
  // ↑ Uses cookies passed from frontend context (localStorage)
}
```

## Architecture Issue Summary

| Aspect | Current Behavior | Expected Behavior |
|--------|------------------|-------------------|
| **Cron Updates** | Updates BOTH device + background sessions | Should ONLY update background sessions |
| **Frontend Token** | Stored in localStorage | Should sync with DB on app open |
| **VIEW API** | Uses DB session (correct) | ✅ Working as expected |
| **BOOK API** | Uses localStorage cookies (stale) | Should use DB session like VIEW |

## Production Impact

**User Report (Confirmed):**
> "When I haven't entered for around an hour and the token has been updated in background, I can see the classes but I CANNOT BOOK because the token is not correct."

**Symptoms:**
- ✅ User can VIEW classes (uses DB token)
- ❌ User CANNOT BOOK classes (uses localStorage token)
- ⏰ Happens after ~1 hour (cron updates DB 3 times in that period)
- 🔐 No 401 error returned - AimHarder silently disables booking option

**Why No 401 Error:**
- AimHarder API detects token mismatch
- Instead of returning 401, it returns success with booking option disabled
- User sees classes but cannot book (silent failure)

## Solution Options

### Option 1: Stop Cron from Updating Device Sessions (RECOMMENDED)
**Pros:**
- Minimal code changes
- Preserves original design intent
- No frontend changes needed
- Clear separation: cron = background, frontend = device

**Implementation:**
```typescript
// supabase-session.service.ts:487-488
static async getAllActiveSessions(): Promise<SessionData[]> {
  const { data, error } = await supabaseAdmin
    .from("auth_sessions")
    .select("*")
    .eq("session_type", "background"); // ONLY background sessions
    // Remove device session query entirely
}
```

**Rationale:**
- Device sessions should ONLY be updated by active frontend
- Background sessions for prebookings should be managed by cron
- Clear ownership: device = user, background = system

### Option 2: Sync localStorage with DB on App Open
**Pros:**
- Handles all desync scenarios
- Works with current cron logic
- Provides offline resilience

**Cons:**
- More complex implementation
- Requires frontend changes
- Adds latency to app startup

**Implementation:**
```typescript
// useAuth.hook.tsx - on app open
useEffect(() => {
  async function syncSession() {
    const dbSession = await fetchSessionFromDB();
    if (dbSession.token !== localStorageToken) {
      localStorage.setItem('token', dbSession.token);
      localStorage.setItem('cookies', JSON.stringify(dbSession.cookies));
    }
  }
  syncSession();
}, []);
```

### Option 3: Booking API Should Use DB Session (IMMEDIATE FIX)
**Pros:**
- Immediate fix for production
- Aligns BOOK API with VIEW API pattern
- No cron changes needed

**Cons:**
- Doesn't address root cause
- All booking calls go through backend
- Increases backend load

**Implementation:**
```typescript
// booking.service.ts:128
async createBooking(request: BookingCreateRequest, boxSubdomain?: string) {
  // Remove cookies parameter - fetch from DB instead
  const userEmail = localStorage.getItem("user-email");
  const session = await fetch(`/api/auth/session?email=${userEmail}`);

  headers["Cookie"] = CookieService.formatForRequest(session.cookies);
  // ↑ Always use fresh cookies from DB
}
```

## Recommended Solution: Hybrid Approach

### Immediate Fix (Production - Today)
**Step 1:** Make booking API use DB session (Option 3)
- Changes: 1 file (`booking.service.ts`)
- Risk: Low
- Impact: Immediate fix for users

### Long-term Fix (Next Sprint)
**Step 2:** Stop cron from updating device sessions (Option 1)
- Changes: 1 line (`supabase-session.service.ts:487`)
- Risk: Low
- Impact: Prevents future desync

**Step 3:** Add localStorage sync on app open (Option 2 - Optional)
- Changes: `useAuth.hook.tsx`
- Risk: Medium
- Impact: Handles edge cases (multiple devices, manual DB updates)

## Questions for User

### 1. Architectural Intent
**Q:** Should cron update device sessions at all?
- **Original Design:** Unclear from code
- **Current Behavior:** Updates both device + background
- **Recommendation:** Only background sessions

### 2. Immediate Fix Priority
**Q:** Which fix should we implement first?
- **Option A:** Stop cron from updating device (prevents future issues)
- **Option B:** Make booking use DB session (fixes current issue)
- **Option C:** Both simultaneously

### 3. Frontend Token Storage
**Q:** Should localStorage be the source of truth for device sessions?
- **Current:** Yes (but gets out of sync)
- **Alternative:** DB is source of truth, localStorage is cache
- **Recommendation:** DB as source of truth

### 4. Background Session Usage
**Q:** What are background sessions used for?
- **Verified:** Prebooking automation via QStash
- **Question:** Any other use cases?
- **Impact:** Determines if cron should ONLY update background

## Files to Review

### Core Issue Files
1. `/modules/auth/api/services/supabase-session.service.ts:478-503`
   - `getAllActiveSessions()` - Returns BOTH session types

2. `/app/api/cron/refresh-tokens/route.ts:54-204`
   - Cron logic - Updates all returned sessions

3. `/app/api/booking/route.ts:64-65`
   - VIEW API - Uses DB session (works)

4. `/modules/booking/api/services/booking.service.ts:128-156`
   - BOOK API - Uses localStorage cookies (fails)

### Testing Files
5. `/modules/auth/api/services/supabase-session.service.test.ts`
   - Verify session update behavior

6. `/modules/booking/api/services/booking.service.test.ts`
   - Verify booking with stale tokens

## Next Steps

1. **User Decision Required:**
   - Which solution to implement first?
   - Should cron update device sessions?
   - Timeline for fix (immediate vs. planned)?

2. **Implementation Plan:**
   - Create detailed implementation plan for chosen solution
   - Define test cases for regression prevention
   - Plan rollout strategy (feature flag, gradual rollout, etc.)

3. **Monitoring:**
   - Add logging for token mismatches
   - Track booking failures by error type
   - Monitor cron token update frequency

## Acknowledgment

I made a critical error in my previous analysis by not verifying the actual code behavior. The desynchronization issue is real and is caused by the cron job updating device sessions that the frontend manages through localStorage.

The user's production issue is valid and needs immediate attention. I apologize for the incorrect analysis and appreciate the detailed correction with code references.
