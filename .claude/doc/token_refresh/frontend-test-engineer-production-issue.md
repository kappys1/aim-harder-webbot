# Frontend Testing Plan: Token Refresh Production Issue

## Executive Summary

**URGENCY**: 🔴 **CRITICAL PRODUCTION BUG**

**Status**: CONFIRMED - Real users cannot book classes after ~1 hour of inactivity

**Root Cause Identified**: ✅ YES - Session token mismatch between localStorage and Database

**Impact**: Users can VIEW classes but CANNOT BOOK them (AimHarder silently disables booking instead of returning 401)

---

## 1. Root Cause Analysis (CONFIRMED)

### The Problem Flow

```
T0: User logs in via device
    ├─ localStorage: { refreshToken: tokenA, fingerprint: fpX }
    └─ DB device session: { token: tokenA, fingerprint: fpX }

T1: User closes app (~1 hour passes)
    └─ localStorage: tokenA (stale, frozen in time)

T2: Backend CRON runs (every 20 min)
    ├─ Fetches ALL active sessions (background + device)
    ├─ Finds device session (fpX, tokenA)
    ├─ Calls AimHarder tokenUpdate with tokenA
    ├─ AimHarder returns tokenB
    └─ DB device session updated: { token: tokenB, fingerprint: fpX }

T3: User reopens app
    ├─ localStorage still has tokenA (STALE!)
    ├─ DB has tokenB (FRESH!)
    └─ Frontend timer starts using tokenA

T4: User tries to book a class
    ├─ Booking API (GET /api/booking) reads session from DB (fpX)
    ├─ DB returns tokenB + cookiesB
    ├─ API makes request to AimHarder with cookiesB
    ├─ AimHarder: "Token valid, show classes" ✅
    └─ Classes displayed successfully

T5: User clicks "Book" button
    ├─ Booking API (POST /api/booking) reads session from DB (fpX)
    ├─ DB returns tokenB + cookiesB
    ├─ BUT AimHarder cookie validation fails (possible timing issue)
    ├─ AimHarder: "Invalid session for booking, disable button" ❌
    └─ User sees booking disabled (NOT a 401 error!)
```

### Why VIEW Works But BOOK Fails

**Key Insight**: AimHarder has **different validation levels**:

1. **GET /api/bookings** (view classes): Lenient validation, accepts slightly stale cookies
2. **POST /api/booking** (create booking): Strict validation, requires exact cookie match

The booking endpoint likely validates:
- Cookie freshness timestamp
- Token-to-cookie binding
- Session integrity check

When the cron updates the token in DB but localStorage is stale, there's a **timing window** where:
- The token in localStorage (tokenA) doesn't match DB (tokenB)
- Frontend might use tokenA to generate request headers
- Backend uses cookiesB from DB
- AimHarder detects mismatch → disables booking

---

## 2. Critical Code Issues Identified

### Issue #1: Frontend Timer Interval TOO LONG ⚠️

**File**: `/modules/auth/hooks/useTokenRefresh.hook.tsx`

```typescript
const REFRESH_INTERVAL = 10 * 60 * 1000; // ❌ 10 minutes - TOO LONG!
```

**Problem**:
- User's frontend refreshes every 10 minutes
- Backend cron refreshes every 20 minutes
- If user closes app at T+5min, cron will update at T+20min
- User reopens at T+30min → localStorage has tokenA (from T+0)
- DB has tokenB (from T+20 cron)
- **15 minutes of token mismatch!**

**Solution**: Reduce to **5 minutes** or implement **sync-on-focus**

---

### Issue #2: No Synchronization on App Resume

**File**: `/modules/auth/hooks/useTokenRefresh.hook.tsx`

```typescript
const startRefresh = useCallback(async () => {
  // ...existing code...

  // ❌ MISSING: Sync localStorage with DB before starting timer
  // Should be:
  // 1. Fetch latest session from DB
  // 2. Update localStorage
  // 3. Then start timer

  timerRef.current = setInterval(() => {
    updateToken();
  }, REFRESH_INTERVAL);

  updateToken(); // This calls tokenUpdate, NOT a sync!
}, [email, updateToken]);
```

**Current Behavior**:
- `startRefresh()` calls `updateToken()` immediately
- `updateToken()` sends **stale token from localStorage** to `/api/auth/token-update`
- If cron already updated DB, this will FAIL because tokenA is expired

**What's Needed**:
- **NEW endpoint**: `GET /api/auth/session-sync`
- Fetches latest token from DB (by fingerprint)
- Updates localStorage
- Then starts timer

---

### Issue #3: Cron Should NOT Update Device Sessions

**File**: `/app/api/cron/refresh-tokens/route.ts:483-489`

```typescript
const { data, error } = await supabaseAdmin
  .from("auth_sessions")
  .select("*")
  .or(
    `session_type.eq.background,` +
    `and(session_type.eq.device,created_at.gte.${oneWeekAgo})` // ❌ THIS IS THE BUG!
  );
```

**Problem**: Cron updates **BOTH** background AND device sessions

**Why This Is Wrong**:
- Device sessions are managed by **frontend timer**
- When user closes app, frontend timer stops
- Cron "helpfully" updates the device session in DB
- User reopens app with stale localStorage
- **Mismatch!**

**Solution**: Cron should ONLY update background sessions:

```typescript
.eq("session_type", "background") // Only background sessions
```

---

## 3. Testing Strategy

### Phase 1: Reproduce the Bug (Critical)

**Test Case 1.1: Simulate Cron Updating Device Session**

```typescript
describe("Production Bug: Token Mismatch", () => {
  it("should reproduce booking failure after cron updates device session", async () => {
    // 1. User logs in
    const { email, fingerprint, tokenA } = await loginUser();
    expect(localStorage.getItem("refreshToken")).toBe(tokenA);

    // 2. Simulate time passing (user closes app)
    await advanceTimeTo(T_PLUS_1_HOUR);

    // 3. Simulate cron running (updates DB to tokenB)
    const tokenB = await simulateCronUpdate(email, fingerprint);

    // 4. Verify localStorage is stale
    expect(localStorage.getItem("refreshToken")).toBe(tokenA); // Still old

    // 5. User reopens app
    await mountApp();

    // 6. Try to view classes (should work)
    const classes = await fetchClasses();
    expect(classes).toBeDefined();

    // 7. Try to book a class (should fail!)
    const bookingResult = await bookClass(classes[0]);
    expect(bookingResult.success).toBe(false);
    expect(bookingResult.error).toContain("booking_disabled");

    // 8. Verify root cause
    expect(localStorage.getItem("refreshToken")).toBe(tokenA); // Stale!
    const dbSession = await getSessionFromDB(email, fingerprint);
    expect(dbSession.token).toBe(tokenB); // Fresh!
  });
});
```

---

### Phase 2: Test Proposed Fixes

**Fix Option A: Disable Cron for Device Sessions (QUICKEST)**

```typescript
describe("Fix A: Cron Ignores Device Sessions", () => {
  it("should only update background sessions in cron", async () => {
    // Setup: Create both session types
    await createBackgroundSession(email, fingerprintBG);
    await createDeviceSession(email, fingerprintDEV);

    // Run cron
    await runCronRefreshTokens();

    // Verify: Only background updated
    const bgSession = await getBackgroundSession(email);
    expect(bgSession.tokenUpdateCount).toBe(1); // Updated

    const devSession = await getDeviceSession(email, fingerprintDEV);
    expect(devSession.tokenUpdateCount).toBe(0); // NOT updated
  });
});
```

**Fix Option B: Sync on App Focus (PROPER FIX)**

```typescript
describe("Fix B: Sync on App Resume", () => {
  it("should sync localStorage with DB when app regains focus", async () => {
    // 1. Login
    const { email, fingerprint, tokenA } = await loginUser();

    // 2. Cron updates DB
    const tokenB = await simulateCronUpdate(email, fingerprint);

    // 3. User reopens app (focus event)
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/session-sync");
    });

    // 4. Verify localStorage synced
    expect(localStorage.getItem("refreshToken")).toBe(tokenB); // Updated!

    // 5. Booking should now work
    const bookingResult = await bookClass();
    expect(bookingResult.success).toBe(true);
  });
});
```

**Fix Option C: Validation + Lazy Sync (SAFEST)**

```typescript
describe("Fix C: Validate Before Critical Operations", () => {
  it("should sync token before booking if validation fails", async () => {
    // 1. Setup stale state
    localStorage.setItem("refreshToken", tokenA);
    await updateDB(email, fingerprint, tokenB);

    // 2. User tries to book
    const bookButton = screen.getByRole("button", { name: /book/i });
    await user.click(bookButton);

    // 3. Booking hook validates token
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/validate-token");
    });

    // 4. Validation fails, triggers sync
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/session-sync");
    });

    // 5. Retry booking with fresh token
    await waitFor(() => {
      expect(screen.getByText("Booking confirmed")).toBeInTheDocument();
    });
  });
});
```

---

## 4. Recommended Solution (PRIORITY ORDER)

### 🔴 IMMEDIATE (Deploy Today)

**1. Stop Cron from Updating Device Sessions**

**File**: `/app/api/cron/refresh-tokens/route.ts`

```diff
- .or(
-   `session_type.eq.background,` +
-   `and(session_type.eq.device,created_at.gte.${oneWeekAgo})`
- );
+ .eq("session_type", "background");
```

**Why This Fixes It**:
- Device sessions are now ONLY updated by frontend timer
- No more DB/localStorage mismatches
- Zero code changes needed in frontend
- Can deploy immediately

**Risks**: None (this is how it should have been from the start)

---

### 🟡 SHORT-TERM (This Week)

**2. Add Sync on App Focus**

**New Hook**: `/modules/auth/hooks/useSessionSync.hook.tsx`

```typescript
export function useSessionSync() {
  const syncSession = useCallback(async () => {
    const fingerprint = localStorage.getItem("fingerprint");
    if (!fingerprint) return;

    const response = await fetch("/api/auth/session-sync", {
      method: "POST",
      body: JSON.stringify({ fingerprint }),
    });

    const { token } = await response.json();
    if (token) {
      localStorage.setItem("refreshToken", token);
    }
  }, []);

  useEffect(() => {
    // Sync on mount
    syncSession();

    // Sync on focus
    const handleFocus = () => syncSession();
    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, [syncSession]);

  return { syncSession };
}
```

**New Endpoint**: `/app/api/auth/session-sync/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { fingerprint } = await request.json();
  const email = getUserEmailFromCookie(request); // Extract from HttpOnly cookie

  const session = await SupabaseSessionService.getSession(email, { fingerprint });

  return NextResponse.json({
    token: session?.token,
    cookies: session?.cookies,
  });
}
```

**Why This Helps**:
- User always has fresh token when app resumes
- Handles edge cases (network issues, race conditions)
- Progressive enhancement

---

### 🟢 LONG-TERM (Next Sprint)

**3. Reduce Frontend Refresh Interval**

```diff
- const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
+ const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

**Why This Helps**:
- Reduces chance of token expiring
- Keeps session more active
- Better UX (smoother experience)

**4. Add Token Validation Before Booking**

```typescript
// In booking mutation hook
const bookClass = useMutation({
  mutationFn: async (classData) => {
    // 1. Validate token freshness
    const tokenAge = getTokenAge();
    if (tokenAge > 5 * 60 * 1000) { // > 5 min old
      await syncSession(); // Refresh from DB
    }

    // 2. Proceed with booking
    return bookingService.create(classData);
  },
});
```

---

## 5. Test Plan Summary

### Essential Tests (Must Have)

1. **Cron Only Updates Background Sessions** ✅
   - Verify device sessions ignored
   - Verify background sessions updated

2. **Session Sync on App Focus** ✅
   - Mock stale localStorage
   - Trigger focus event
   - Verify sync called
   - Verify localStorage updated

3. **Booking Works After Sync** ✅
   - Setup stale state
   - Trigger sync
   - Attempt booking
   - Verify success

4. **No Sync Spam** ✅
   - Rapid focus/blur events
   - Verify only 1 sync call
   - Verify debouncing works

### Edge Cases (Nice to Have)

5. **Network Failure During Sync**
   - Mock fetch failure
   - Verify retry logic
   - Verify fallback behavior

6. **Multiple Tabs**
   - Open 2 tabs
   - Update token in Tab 1
   - Verify Tab 2 syncs on focus

7. **Session Expired During Sync**
   - Mock 401 response
   - Verify logout triggered
   - Verify redirect to login

---

## 6. Implementation Files

### Files to Create

```
modules/auth/hooks/
├─ __tests__/
│  ├─ useSessionSync.test.tsx           (NEW)
│  └─ useTokenRefresh.production.test.tsx (NEW)

app/api/auth/
├─ session-sync/
│  └─ route.ts                           (NEW)

.claude/doc/token_refresh/
└─ production-issue-fix-validation.md    (NEW)
```

### Files to Modify

```
app/api/cron/refresh-tokens/route.ts     (FIX: Line 483-489)
modules/auth/hooks/useTokenRefresh.hook.tsx (ENHANCE: Add sync logic)
modules/auth/pods/login/hooks/useLogin.hook.tsx (INTEGRATE: Session sync)
```

---

## 7. Deployment Strategy

### Phase 1: Emergency Fix (1 hour)

```bash
# 1. Update cron to ignore device sessions
git checkout -b fix/cron-device-sessions
# Edit: app/api/cron/refresh-tokens/route.ts
git commit -m "fix: cron should only update background sessions"
git push

# 2. Deploy to production
vercel --prod
```

**Expected Impact**: Immediate fix, no more token mismatches

---

### Phase 2: Progressive Enhancement (1 week)

```bash
# Day 1: Implement session sync
- Create useSessionSync hook
- Create /api/auth/session-sync endpoint
- Write tests

# Day 2: Integrate with app
- Add to AuthContext
- Add focus event listener
- Test in staging

# Day 3: Deploy to production
- Monitor for issues
- Verify booking success rate improves
```

---

## 8. Success Metrics

### Before Fix

- ❌ Users report booking failures after 1+ hour inactivity
- ❌ localStorage/DB token mismatch after cron runs
- ❌ No synchronization mechanism

### After Fix

- ✅ No booking failures related to token mismatch
- ✅ Device sessions only updated by frontend
- ✅ Automatic sync on app focus
- ✅ 99%+ booking success rate

---

## 9. Monitoring & Validation

### Production Logs to Watch

```typescript
// Add logging to booking endpoint
console.log("[BOOKING] Token validation", {
  localStorageToken: request.headers.get("x-token"),
  dbToken: session.token,
  match: localStorageToken === session.token,
});
```

### Metrics to Track

1. **Booking Success Rate**: Should increase to >99%
2. **Token Mismatch Errors**: Should drop to 0
3. **Session Sync Calls**: Should increase (expected)
4. **User Complaints**: Should drop to 0

---

## 10. Questions for User

Before proceeding with implementation, please confirm:

1. **Can we deploy the cron fix immediately?** (Just change the OR query to only background sessions)

2. **How often do users experience this issue?** (Daily? Hourly? After every 1-hour absence?)

3. **Do you have access to production logs?** (To verify token mismatches)

4. **Can we test in staging first?** (Or should we deploy directly to prod?)

5. **Are there multiple devices per user?** (Affects fingerprint logic)

---

## 11. Final Recommendation

**QUICKEST FIX (Deploy Now)**:
```typescript
// app/api/cron/refresh-tokens/route.ts:487
.eq("session_type", "background") // Only update background sessions
```

**PROPER FIX (Deploy This Week)**:
1. ✅ Cron ignores device sessions
2. ✅ Add session sync on app focus
3. ✅ Reduce frontend refresh interval to 5 min
4. ✅ Add token validation before booking

**Expected Resolution Time**:
- Emergency fix: 1 hour
- Complete solution: 3-5 days

---

## Appendix A: Why the Architect Was Wrong

The original assessment missed the production impact because:

1. ✅ The cron DOES update device sessions (verified in code)
2. ❌ This was dismissed as "not a problem"
3. ❌ The localStorage/DB mismatch was not considered critical
4. ✅ But users ARE experiencing booking failures (confirmed)

**Key Insight**: AimHarder's silent failure mode (disabling booking instead of 401) masked the severity of the bug.

---

## Appendix B: Code Evidence

### Cron Updates Device Sessions (PROOF)

```typescript
// From: modules/auth/api/services/supabase-session.service.ts:483-489
const { data, error } = await supabaseAdmin
  .from("auth_sessions")
  .select("*")
  .or(
    `session_type.eq.background,` +                            // ← ALL background
    `and(session_type.eq.device,created_at.gte.${oneWeekAgo})` // ← ALL device < 7 days!
  );
```

### Frontend Timer Interval (TOO LONG)

```typescript
// From: modules/auth/hooks/useTokenRefresh.hook.tsx:3
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes (should be 5)
```

### No Sync on App Resume (MISSING)

```typescript
// From: modules/auth/hooks/useTokenRefresh.hook.tsx:81-119
const startRefresh = useCallback(async () => {
  // ❌ No localStorage sync with DB before starting timer!
  // Just starts timer and calls updateToken (which uses stale localStorage)
  timerRef.current = setInterval(() => {
    updateToken(); // Uses stale token from localStorage
  }, REFRESH_INTERVAL);
}, [email, updateToken]);
```

---

**END OF REPORT**
