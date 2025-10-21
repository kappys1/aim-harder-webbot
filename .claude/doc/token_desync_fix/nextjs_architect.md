# Token Desynchronization Fix - Implementation Plan

**Agent**: nextjs-architect
**Date**: 2025-10-20
**Status**: Ready for Implementation
**Context File**: `.claude/sessions/context_session_token_desync_bug.md`

## Executive Summary

The token desynchronization bug is caused by **three separate cookie sources** being used inconsistently across different code paths:

1. **Browser cookies** (for viewing classes) - Never updated, go stale
2. **Background DB session** (incorrectly used for manual bookings) - Updated by cron
3. **Device DB session** (should be used for manual bookings) - Updated on login

This causes users to see classes but fail to book them, and prevents them from seeing class attendees.

## Root Cause Analysis

### The Three Execution Paths

#### Path 1: View Classes (STALE BROWSER COOKIES)
```
Browser → Container (Next.js cookies()) → Component → Hook → Business → Service
  → DIRECT fetch to AimHarder API with browser cookies
```
**Problem**: Browser cookies never refresh, so user sees limited data (no attendees)

#### Path 2: Manual Bookings (WRONG SESSION TYPE)
```
Browser → POST /api/booking → getSession(userEmail) → Background Session (DEFAULT)
  → bookingService.createBooking with DB cookies
```
**Problem**: Uses background session by default, which may have stale tokens

#### Path 3: Prebookings (CORRECT - Uses Background Session)
```
QStash → POST /api/execute-prebooking → getBackgroundSession(userEmail)
  → Token refresh logic → bookingService.createBooking
```
**Problem**: Background session token not refreshed frequently enough by cron

## Implementation Solutions

### Solution 1: Fix Manual Bookings (PRIORITY 1 - CRITICAL)

**Objective**: Make manual bookings use device session instead of background session

**Files to Modify**:
- `/app/api/booking/route.ts` (Line 159, 431)

**Changes**:

```typescript
// BEFORE (Line 159):
const session = await SupabaseSessionService.getSession(userEmail);

// AFTER:
const session = await SupabaseSessionService.getSession(userEmail, {
  sessionType: 'device'
});
```

**Also update DELETE handler** (Line 431):
```typescript
// BEFORE (Line 431):
const session = await SupabaseSessionService.getSession(userEmail);

// AFTER:
const session = await SupabaseSessionService.getSession(userEmail, {
  sessionType: 'device'
});
```

**Rationale**:
- Manual bookings are user-initiated actions from browser
- Device sessions are created on login and updated when user refreshes
- Background sessions are meant for cron jobs and scheduled tasks
- Using device session ensures fresh tokens from user's actual session

**Testing**:
1. Login as user
2. Try to book a class
3. Should succeed with device session
4. Check logs to confirm device session is used

### Solution 2: Add Token Refresh Logic (PRIORITY 1 - CRITICAL)

**Objective**: Refresh token before booking if it's stale (similar to execute-prebooking logic)

**Files to Modify**:
- `/app/api/booking/route.ts` (After Line 166, before Line 172)

**Changes**:

```typescript
// Add after session check (Line 166)
// CRITICAL: Refresh token if stale (similar to execute-prebooking)
const shouldRefreshToken = () => {
  if (!session.lastTokenUpdateDate) return true;

  const lastUpdate = new Date(session.lastTokenUpdateDate);
  const now = new Date();
  const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

  return minutesSinceUpdate > 25; // Refresh if older than 25 minutes
};

if (shouldRefreshToken()) {
  console.log(`[BOOKING API] Token is stale, refreshing for ${userEmail}...`);

  try {
    const { AimharderRefreshService } = await import(
      "@/modules/auth/api/services/aimharder-refresh.service"
    );

    const refreshResult = await AimharderRefreshService.updateToken({
      token: session.token,
      fingerprint: session.fingerprint,
      cookies: session.cookies,
    });

    if (refreshResult.logout) {
      return NextResponse.json(
        { error: "Session expired - please login again" },
        { status: 401 }
      );
    }

    if (!refreshResult.success || !refreshResult.newToken) {
      return NextResponse.json(
        { error: "Failed to refresh authentication" },
        { status: 500 }
      );
    }

    // Update session with new token
    await SupabaseSessionService.updateRefreshToken(
      userEmail,
      refreshResult.newToken,
      session.fingerprint
    );

    if (refreshResult.cookies && refreshResult.cookies.length > 0) {
      await SupabaseSessionService.updateCookies(
        userEmail,
        refreshResult.cookies,
        session.fingerprint
      );
    }

    await SupabaseSessionService.updateTokenUpdateData(
      userEmail,
      true,
      undefined,
      session.fingerprint
    );

    // Update local session object for booking
    session.token = refreshResult.newToken;
    if (refreshResult.cookies && refreshResult.cookies.length > 0) {
      session.cookies = refreshResult.cookies;
    }

    console.log(`[BOOKING API] Token refreshed successfully for ${userEmail}`);
  } catch (error) {
    console.error(`[BOOKING API] Token refresh failed:`, error);
    // Continue with existing token
  }
}

// Continue with existing booking logic (Line 172)
```

**Rationale**:
- Ensures token is fresh before booking
- Reduces `{ logout: 1 }` errors from AimHarder
- Works as backup even if cron job is delayed
- Matches the pattern used in execute-prebooking

**Testing**:
1. Wait for token to be stale (>25 minutes)
2. Try to book a class
3. Should auto-refresh and succeed
4. Check logs for refresh activity

### Solution 3: Fix View Classes to Use API Route (PRIORITY 2 - IMPORTANT)

**Objective**: Make viewing classes consistent with bookings by using API route

**Files to Modify**:
- `/modules/booking/api/services/booking.service.ts` (Line 33-126 - getBookings method)
- Remove cookies parameter from entire client-side flow chain

**Changes**:

```typescript
// BEFORE (Line 33-126):
async getBookings(
  params: BookingRequestParams,
  cookies?: AuthCookie[]
): Promise<BookingResponseApi> {
  const url = this.buildUrl(BOOKING_CONSTANTS.API.ENDPOINTS.BOOKINGS, params);

  const headers: Record<string, string> = {
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const userEmail = localStorage.getItem("user-email");
    if (userEmail) {
      headers["x-user-email"] = userEmail;
    }
  }

  if (cookies && cookies.length > 0) {
    headers["Cookie"] = CookieService.formatForRequest(cookies);
  }

  const response = await fetch(url, { // DIRECT to AimHarder
    method: "GET",
    headers,
    signal: controller.signal,
    credentials: "include",
    mode: "cors",
  });

  // ... rest of method
}

// AFTER:
async getBookings(
  params: BookingRequestParams,
  cookies?: AuthCookie[] // Keep for backwards compatibility but ignore
): Promise<BookingResponseApi> {
  // NEW: Use our API route instead of direct AimHarder call
  const url = `/api/booking?day=${params.day}&boxId=${params.boxId}&_=${params._}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add user email for session lookup
  if (typeof window !== "undefined") {
    const userEmail = localStorage.getItem("user-email");
    if (userEmail) {
      headers["x-user-email"] = userEmail;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new BookingApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        "HTTP_ERROR"
      );
    }

    const data = await response.json();

    // Validate response
    const validatedData = BookingResponseApiSchema.safeParse(data);
    if (!validatedData.success) {
      console.error('[BOOKING_API] Validation failed for getBookings:', JSON.stringify({
        zodError: validatedData.error.issues,
        rawResponse: data,
        url,
      }, null, 2));
      throw new BookingApiError(
        "Invalid API response format",
        400,
        "VALIDATION_ERROR",
        {
          zodIssues: validatedData.error.issues,
          rawResponse: data,
        }
      );
    }

    return validatedData.data;
  } catch (error) {
    // ... existing error handling
  }
}
```

**Benefits**:
- Consistent cookie source (always DB session)
- Users can see attendees (fresh tokens return full data)
- No browser cookie staleness issues
- Centralizes session management in API routes

**Testing**:
1. Login as user
2. View classes for today
3. Should see all attendees
4. Check network tab - should call `/api/booking` not AimHarder directly

### Solution 4: Add Convenience Method (PRIORITY 3 - NICE TO HAVE)

**Objective**: Make session type selection explicit and prevent future confusion

**Files to Modify**:
- `/modules/auth/api/services/supabase-session.service.ts`

**Changes**:

```typescript
// Add after getBackgroundSession method (Line 200):

/**
 * Get a device session for a user by fingerprint
 * Convenience wrapper for getSession with device type filter
 *
 * @param email - User email
 * @param fingerprint - Optional device fingerprint (returns first device if not provided)
 * @returns Device session or null
 */
static async getDeviceSession(
  email: string,
  fingerprint?: string
): Promise<SessionData | null> {
  const options: SessionQueryOptions = { sessionType: 'device' };
  if (fingerprint) {
    options.fingerprint = fingerprint;
  }
  return this.getSession(email, options);
}
```

**Then update all manual booking routes**:

```typescript
// app/api/booking/route.ts - Line 159
// INSTEAD OF:
const session = await SupabaseSessionService.getSession(userEmail, { sessionType: 'device' });

// USE:
const session = await SupabaseSessionService.getDeviceSession(userEmail);
```

**Benefits**:
- Self-documenting code
- Prevents confusion about session types
- Easier to grep for device vs background usage
- Consistent API with getBackgroundSession()

### Solution 5: Update GET Route to Use Device Session (PRIORITY 1 - CRITICAL)

**Objective**: Ensure GET /api/booking also uses device session for consistency

**Files to Modify**:
- `/app/api/booking/route.ts` (Line 64)

**Changes**:

```typescript
// BEFORE (Line 64):
const session = await SupabaseSessionService.getSession(userEmail);

// AFTER:
const session = await SupabaseSessionService.getSession(userEmail, {
  sessionType: 'device'
});
```

**Rationale**:
- GET route should use same session type as POST/DELETE for consistency
- Device session contains user's actual login state
- Prevents confusion about which session is used

## Implementation Order

### Phase 1: Critical Fixes (Do First)
1. Update POST /api/booking to use device session (Solution 1)
2. Update DELETE /api/booking to use device session (Solution 1)
3. Update GET /api/booking to use device session (Solution 5)
4. Add token refresh logic to POST /api/booking (Solution 2)

**Estimated Time**: 2-3 hours
**Risk**: Low (only changes session type selection)
**Impact**: High (fixes manual bookings immediately)

### Phase 2: View Classes Fix (Do After Phase 1 Works)
1. Update booking.service.ts getBookings() to use API route (Solution 3)
2. Remove cookies parameter from client-side flow
3. Test attendee visibility

**Estimated Time**: 3-4 hours
**Risk**: Medium (changes network call pattern)
**Impact**: High (fixes attendee visibility)

### Phase 3: Code Quality (Do After Phase 2 Works)
1. Add getDeviceSession() convenience method (Solution 4)
2. Update all routes to use explicit session methods
3. Add documentation

**Estimated Time**: 1-2 hours
**Risk**: Low (refactoring only)
**Impact**: Medium (prevents future bugs)

## Testing Plan

### Manual Testing

#### Test Case 1: Manual Booking with Fresh Session
1. Login to application
2. Navigate to bookings page
3. Select a class
4. Click "Book"
5. **Expected**: Booking succeeds immediately
6. **Verify**: Check logs show "Using device session"

#### Test Case 2: Manual Booking with Stale Session
1. Login to application
2. Wait 30 minutes (or manually set lastTokenUpdateDate to 30 minutes ago)
3. Try to book a class
4. **Expected**: Token auto-refreshes, then booking succeeds
5. **Verify**: Check logs show "Token is stale, refreshing" and "Token refreshed successfully"

#### Test Case 3: View Classes with Attendees
1. Login to application
2. Navigate to a class with existing bookings
3. **Expected**: See all attendees in the class
4. **Verify**: Check network tab shows call to `/api/booking` not direct AimHarder

#### Test Case 4: Prebooking Execution
1. Create a prebooking
2. Wait for QStash to trigger execution
3. **Expected**: Prebooking executes successfully
4. **Verify**: Check logs show "Using background session" for prebooking

### Automated Testing

```typescript
// Add to booking.service.test.ts
describe('getBookings with API route', () => {
  it('should call /api/booking instead of AimHarder directly', async () => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockBookingResponse),
      })
    );

    const service = new BookingService();
    await service.getBookings({
      day: '2025-10-20',
      boxId: 'test-box-id',
      _: '123456',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/booking'),
      expect.any(Object)
    );
  });
});
```

## Rollback Plan

If any phase causes issues:

### Phase 1 Rollback
```typescript
// Revert to background session default
const session = await SupabaseSessionService.getSession(userEmail);
```

### Phase 2 Rollback
```typescript
// Revert to direct AimHarder call
const response = await fetch(aimharderUrl, { headers: { Cookie: cookies } });
```

### Phase 3 Rollback
```typescript
// Keep using getSession with explicit options
const session = await SupabaseSessionService.getSession(userEmail, { sessionType: 'device' });
```

## Success Criteria

1. **Manual bookings work consistently** - Users can book classes without `{ logout: 1 }` errors
2. **Attendees visible** - Users can see who has booked each class
3. **Prebookings execute** - Background sessions work for scheduled bookings
4. **No token errors** - Tokens refresh automatically when stale
5. **Clear session types** - Code explicitly shows device vs background usage

## Additional Notes

### Why Device Session for Manual Bookings?

Device sessions represent the user's actual browser login:
- Created when user logs in through browser
- Updated when user refreshes their session
- Tied to specific device fingerprint
- Expire after 7 days of inactivity

Background sessions are for automation:
- Created during setup (not user-initiated)
- Updated by cron jobs
- Deterministic fingerprint (not device-specific)
- Never expire (protected from deletion)

Manual bookings are user-initiated actions, so they should use the user's actual device session.

### Why Not Fix Cron to Update Device Sessions?

The multi-session architecture is intentional:
- Background sessions for automation (cron, prebookings)
- Device sessions for user actions (manual bookings)
- Prevents race conditions between user and cron
- Allows user to logout without breaking prebookings

The bug is not in the architecture, but in the session selection logic.

### Performance Implications

**Phase 1**: No performance impact (just changes which DB row is queried)

**Phase 2**: Slight change in network topology:
- Before: Browser → AimHarder (direct, faster)
- After: Browser → API Route → AimHarder (one extra hop, ~50ms overhead)
- Benefit: Consistent session management, worth the tradeoff

## Questions to Clarify with User

1. **Deployment Strategy**: Should we deploy all phases at once, or incrementally?
2. **Monitoring**: Do you want to add metrics/alerts for token refresh failures?
3. **Backward Compatibility**: Any external systems calling booking.service.ts that need updating?
4. **Cron Job Frequency**: Should we increase cron job frequency (currently 20 minutes) to keep background sessions fresher?

## References

- Context Session: `.claude/sessions/context_session_token_desync_bug.md`
- Supabase Session Service: `/modules/auth/api/services/supabase-session.service.ts`
- Booking API Route: `/app/api/booking/route.ts`
- Booking Service: `/modules/booking/api/services/booking.service.ts`
- Execute Prebooking Route: `/app/api/execute-prebooking/route.ts`
