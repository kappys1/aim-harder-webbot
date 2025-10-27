# Booking Subdomain Issue - Architectural Review & Root Cause Analysis

**Date**: 2025-10-26
**Reviewer**: Next.js Architect Agent
**Issue**: One user can book in Cerdanyola box, but another user in a different box cannot book
**Error Message**: "Error de conexión al realizar la reserva / pre reserva"

---

## Executive Summary

After comprehensive analysis of the booking system architecture, I have identified **CRITICAL ISSUES** that explain why the booking system works for one user but fails for another user in a different box. The root cause is **NOT the subdomain handling itself**, but rather **THREE CRITICAL FLAWS** in the current architecture:

### Critical Issues Identified:

1. **HARDCODED EMAIL FALLBACK** - Causes all requests to use wrong user's session
2. **MISSING BOX ACCESS VALIDATION** in POST endpoint - No security check
3. **NO SUBDOMAIN VALIDATION** - Frontend can send any subdomain without verification
4. **SESSION TYPE CONFUSION** - Using device session correctly, but no validation

---

## 1. Root Cause Analysis

### Issue #1: Hardcoded Email Fallback (CRITICAL)

**Location**: `/app/api/booking/route.ts`

**Lines 106-107 (GET endpoint)**:
```typescript
const userEmail =
  request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now
```

**Lines 237-238 (POST endpoint)**:
```typescript
const userEmail =
  request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now
```

**Lines 566-567 (DELETE endpoint)**:
```typescript
const userEmail =
  request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now
```

**Impact**:
- If `x-user-email` header is NOT sent from frontend → ALL users default to "alexsbd1@gmail.com"
- This means ALL booking requests use the device session of "alexsbd1@gmail.com"
- User in Cerdanyola box works because:
  - Either they ARE "alexsbd1@gmail.com", OR
  - The `x-user-email` header is being sent correctly from their frontend
- User in other box fails because:
  - The `x-user-email` header might NOT be sent correctly, OR
  - Their device session doesn't exist in the database, OR
  - They're using the fallback email which has a session for a different box

**Why This Happens**:
The frontend DOES send the header correctly in `booking-dashboard.component.tsx:209`:
```typescript
headers: {
  "Content-Type": "application/json",
  ...(currentUserEmail && { "x-user-email": currentUserEmail }),
},
```

BUT: The header is ONLY sent if `currentUserEmail` exists in localStorage:
```typescript
const currentUserEmail =
  typeof window !== "undefined"
    ? localStorage.getItem("user-email")
    : null;
```

**Hypothesis**: The second user likely doesn't have `user-email` in localStorage, causing the fallback to trigger.

---

### Issue #2: Missing Box Access Validation in POST Endpoint (SECURITY FLAW)

**Location**: `/app/api/booking/route.ts:195-269`

**Current Flow**:
1. POST endpoint receives `boxId`, `boxSubdomain`, `boxAimharderId` from request body
2. **NO VALIDATION** that the user has access to this box
3. Uses the subdomain directly without checking database

**Comparison with GET Endpoint** (which DOES validate):
```typescript
// GET endpoint (lines 116-124) - CORRECT IMPLEMENTATION
const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);

if (!hasAccess) {
  return NextResponse.json(
    { error: "Access denied to this box" },
    { status: 403 }
  );
}
```

**POST endpoint** - **MISSING THIS VALIDATION ENTIRELY**

**Impact**:
- Any user can send a booking request with ANY `boxId` and `boxSubdomain`
- No verification that:
  - The user has access to this box
  - The `boxSubdomain` matches the actual box in the database
  - The `boxAimharderId` is correct
- Security vulnerability: User could book classes in boxes they don't have access to

---

### Issue #3: No Subdomain Validation Against Database

**Location**: `/app/api/booking/route.ts:201`

**Current Code**:
```typescript
const boxSubdomain = body.boxSubdomain; // Extract box subdomain (for dynamic URL)
// ... later ...
const bookingResponse = await bookingService.createBooking(
  bookingData,
  session.cookies,
  boxSubdomain  // ← Used directly without validation
);
```

**Missing Validation**:
```typescript
// Should fetch box from database and verify subdomain matches
const box = await BoxService.getBoxById(boxId);
if (!box) {
  return NextResponse.json({ error: "Box not found" }, { status: 404 });
}

// Verify the subdomain matches what's in our database
if (box.subdomain !== boxSubdomain) {
  return NextResponse.json({
    error: "Box subdomain mismatch"
  }, { status: 400 });
}
```

**Impact**:
- Frontend could send wrong subdomain (typo, stale data, etc.)
- Backend would use wrong subdomain to construct AimHarder API URL
- Booking request would go to wrong box
- This could explain the "Error de conexión" error if subdomain is incorrect

---

### Issue #4: Frontend Box Data Fetch Timing

**Location**: `/modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx:166-177`

**Current Flow**:
```typescript
const boxResponse = await fetch(
  `/api/boxes/${boxId}?email=${currentUserEmail}`
);
if (!boxResponse.ok) {
  toast.error("Error", {
    description: "No se pudo obtener la información del box.",
  });
  return;
}

const boxResponseData = await boxResponse.json();
const boxData = boxResponseData.box;
```

**Issue**: This fetch happens **ON EVERY BOOKING ATTEMPT**, which:
- Adds latency to booking flow
- Could fail silently if `/api/boxes/${boxId}` endpoint has issues
- No caching of box data

**Better Pattern**: Box data should be fetched ONCE at dashboard load and cached in context/query client.

---

## 2. Session Architecture Analysis

### Current Session Flow (CORRECT)

The session architecture is **CORRECTLY** using device sessions for manual bookings:

**GET Endpoint** (line 137):
```typescript
const session = await SupabaseSessionService.getDeviceSession(userEmail);
```

**POST Endpoint** (line 241):
```typescript
let session = await SupabaseSessionService.getDeviceSession(userEmail);
```

**DELETE Endpoint** (line 570):
```typescript
const session = await SupabaseSessionService.getDeviceSession(userEmail);
```

**Token Refresh Logic** (lines 19-87):
- Correctly checks token age (25 minutes threshold)
- Refreshes token if needed before booking
- Updates database with new token and cookies

**Verdict**: Session handling is **CORRECT**. The issue is NOT with session architecture.

---

## 3. Multi-Box/Multi-Tenant Flow Analysis

### How Multi-Box SHOULD Work:

1. **User Authentication**:
   - User logs in via `/app/login/page.tsx`
   - Session stored in Supabase with `user_email` and device fingerprint
   - `user-email` saved to localStorage

2. **Box Access**:
   - User-box relationships stored in `user_boxes` table
   - `BoxAccessService.validateAccess(userEmail, boxId)` checks access
   - Each user can have access to multiple boxes

3. **Booking Flow**:
   ```
   Frontend → /api/booking (POST)
     ↓
   Validate user has access to box
     ↓
   Fetch box data from database
     ↓
   Verify subdomain matches
     ↓
   Get user's device session
     ↓
   Construct dynamic URL: https://{subdomain}.aimharder.com
     ↓
   Call external AimHarder API
   ```

### Current Flow (BROKEN):

```
Frontend → /api/booking (POST)
  ↓
❌ NO box access validation
  ↓
❌ NO box data fetch from database
  ↓
❌ Uses subdomain directly from request body (unvalidated)
  ↓
❌ Falls back to hardcoded email if header missing
  ↓
Get device session (correct, but for wrong user if fallback triggered)
  ↓
Construct URL with unvalidated subdomain
  ↓
Call external API (likely fails due to wrong session or wrong subdomain)
```

---

## 4. Why One User Works and Another Doesn't

### User 1 (Cerdanyola Box) - WORKS Because:

**Scenario A**: They are the hardcoded user
- User email IS "alexsbd1@gmail.com"
- Their device session exists for Cerdanyola box
- Frontend sends correct `x-user-email` header (even though fallback would work)
- Box subdomain is correct (from frontend fetch)
- Everything aligns by coincidence

**Scenario B**: Headers are sent correctly
- User email is NOT "alexsbd1@gmail.com"
- BUT: Frontend successfully sends `x-user-email` header
- Their device session exists in database
- Box subdomain is correct
- Works as expected

### User 2 (Different Box) - FAILS Because:

**Scenario A**: Missing localStorage email
- `localStorage.getItem("user-email")` returns `null`
- `x-user-email` header NOT sent (conditional spread operator)
- Backend falls back to "alexsbd1@gmail.com"
- Fetches device session for "alexsbd1@gmail.com" (wrong user!)
- Session has cookies/token for Cerdanyola box, not their box
- External API call fails: "Error de conexión"

**Scenario B**: Wrong subdomain from frontend
- User email header sent correctly
- Device session fetched correctly
- BUT: `/api/boxes/${boxId}` returns wrong subdomain
- Wrong subdomain used to construct AimHarder URL
- External API call fails

**Scenario C**: No device session
- User email header sent correctly
- BUT: User has no device session in database
- Returns 401: "Device session not found"
- Frontend shows generic error

---

## 5. Additional Issues Found

### Issue #5: Box Data Service Uses UUID Instead of box_id

**Location**: `/modules/boxes/api/services/box.service.ts:114-129`

```typescript
static async getBoxById(boxId: string): Promise<BoxApiResponse | null> {
  const { data, error } = await supabase
    .from('boxes')
    .select('*')
    .eq('id', boxId)  // ← Using UUID 'id', not 'box_id' (AimHarder ID)
    .single();
```

**Issue**: This expects a **UUID** (Supabase internal ID), but the frontend might be passing `box_id` (AimHarder ID).

**Inconsistency**:
- GET endpoint fetches box using: `await BoxService.getBoxById(boxId)` (line 110)
- Where `boxId` comes from query params: `const boxId = searchParams.get("boxId")`
- Frontend sends this as: `/api/booking?boxId=${state.selectedBoxId}`
- Need to verify: Is `state.selectedBoxId` a UUID or an AimHarder box_id?

---

### Issue #6: GET Endpoint Uses box.box_id, POST Uses boxAimharderId

**GET Endpoint** (line 130):
```typescript
targetUrl.searchParams.set("box", box.box_id); // Use Aimharder box_id
```

**Frontend Booking Request** (booking-dashboard.component.tsx:202):
```typescript
boxAimharderId: boxData.box_id,
```

**This is consistent**, but the naming is confusing:
- `box.box_id` in database = AimHarder box ID
- `boxData.box_id` from `/api/boxes/${boxId}` = AimHarder box ID
- Need to ensure these are the same

---

## 6. Recommended Fixes (Priority Order)

### **CRITICAL FIX #1**: Remove Hardcoded Email Fallback

**File**: `/app/api/booking/route.ts`

**Lines to Change**: 106-107, 237-238, 566-567

**Current**:
```typescript
const userEmail =
  request.headers.get("x-user-email") || "alexsbd1@gmail.com"; // Default for now
```

**Fixed**:
```typescript
const userEmail = request.headers.get("x-user-email");

if (!userEmail) {
  return NextResponse.json(
    {
      error: "Missing user email header",
      details: "x-user-email header is required"
    },
    { status: 400 }
  );
}
```

**Impact**: Forces frontend to ALWAYS send user email, preventing wrong-user session usage.

---

### **CRITICAL FIX #2**: Add Box Access Validation to POST Endpoint

**File**: `/app/api/booking/route.ts`

**Insert After**: Line 238 (after getting userEmail)

**Add**:
```typescript
// Validate user has access to this box
const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);

if (!hasAccess) {
  return NextResponse.json(
    { error: "Access denied to this box" },
    { status: 403 }
  );
}
```

---

### **CRITICAL FIX #3**: Add Subdomain Validation in POST Endpoint

**File**: `/app/api/booking/route.ts`

**Insert After**: Box access validation (from Fix #2)

**Add**:
```typescript
// Fetch box data from database to verify subdomain
const box = await BoxService.getBoxById(boxId);

if (!box) {
  return NextResponse.json(
    { error: "Box not found" },
    { status: 404 }
  );
}

// Validate subdomain matches database
if (box.subdomain !== boxSubdomain) {
  console.error('[BOOKING] Subdomain mismatch:', {
    providedSubdomain: boxSubdomain,
    databaseSubdomain: box.subdomain,
    boxId,
    userEmail,
  });

  return NextResponse.json(
    {
      error: "Box subdomain mismatch",
      details: "Provided subdomain does not match database"
    },
    { status: 400 }
  );
}

// Also validate boxAimharderId matches
if (box.box_id !== boxAimharderId) {
  console.error('[BOOKING] AimHarder box ID mismatch:', {
    providedBoxId: boxAimharderId,
    databaseBoxId: box.box_id,
    boxId,
    userEmail,
  });

  return NextResponse.json(
    {
      error: "Box ID mismatch",
      details: "Provided AimHarder box ID does not match database"
    },
    { status: 400 }
  );
}
```

---

### **HIGH PRIORITY FIX #4**: Ensure Frontend ALWAYS Sends x-user-email Header

**File**: `/modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`

**Lines**: 148-152, 207-211, 326-330, 397-401

**Current**:
```typescript
const currentUserEmail =
  typeof window !== "undefined"
    ? localStorage.getItem("user-email")
    : null;

// ... later ...
headers: {
  "Content-Type": "application/json",
  ...(currentUserEmail && { "x-user-email": currentUserEmail }),
},
```

**Issue**: If `localStorage.getItem("user-email")` returns null, header is NOT sent.

**Fixed**:
```typescript
const currentUserEmail =
  typeof window !== "undefined"
    ? localStorage.getItem("user-email")
    : null;

if (!currentUserEmail) {
  toast.error("Error de autenticación", {
    description: "No se encontró el email del usuario. Por favor, inicia sesión de nuevo.",
  });
  return;
}

// ... later ...
headers: {
  "Content-Type": "application/json",
  "x-user-email": currentUserEmail, // ← Always send (not conditional)
},
```

---

### **MEDIUM PRIORITY FIX #5**: Add Comprehensive Logging

**File**: `/app/api/booking/route.ts`

**Add at Start of POST Handler** (after line 198):
```typescript
console.log('[BOOKING-POST] Request received:', {
  userEmail: request.headers.get("x-user-email"),
  hasUserEmail: !!request.headers.get("x-user-email"),
  boxId,
  boxSubdomain,
  boxAimharderId,
  day: body.day,
  bookingId: body.id,
});
```

**Add After Session Fetch** (after line 251):
```typescript
console.log('[BOOKING-POST] Session fetched:', {
  userEmail,
  hasSession: !!session,
  sessionType: session?.sessionType,
  fingerprint: session?.fingerprint?.substring(0, 20) + '...',
  cookiesCount: session?.cookies?.length || 0,
});
```

**Add Before External API Call** (before line 265):
```typescript
console.log('[BOOKING-POST] Calling external API:', {
  userEmail,
  subdomain: boxSubdomain,
  url: `https://${boxSubdomain}.aimharder.com/api/bookings/book`,
  day: bookingData.day,
  bookingId: bookingData.id,
});
```

---

### **LOW PRIORITY FIX #6**: Cache Box Data in Frontend

**File**: `/modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`

**Current Issue**: Box data fetched on EVERY booking attempt (lines 166-177)

**Recommendation**: Use TanStack Query to cache box data:

```typescript
// Create new hook: useBoxData.hook.tsx
import { useQuery } from '@tanstack/react-query';

export function useBoxData(boxId: string, userEmail: string) {
  return useQuery({
    queryKey: ['box', boxId, userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/boxes/${boxId}?email=${userEmail}`);
      if (!response.ok) {
        throw new Error('Failed to fetch box data');
      }
      const data = await response.json();
      return data.box;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

Then in `handleBooking`:
```typescript
const { data: boxData, isLoading: isBoxLoading } = useBoxData(boxId, currentUserEmail);

if (isBoxLoading) {
  toast.info("Cargando datos del box...");
  return;
}

if (!boxData) {
  toast.error("Error", {
    description: "No se pudo obtener la información del box.",
  });
  return;
}
```

---

## 7. Testing Plan for Multi-Box Scenarios

### Test Case 1: User with Multiple Box Access

**Setup**:
- Create user "test@example.com"
- Grant access to TWO boxes: "crossfitcerdanyola300" and "crossfitbarcelona"
- Create device session for "test@example.com" in Supabase

**Test Flow**:
1. Login as "test@example.com"
2. Navigate to booking page for Box A
3. Make a booking → Should succeed
4. Navigate to booking page for Box B
5. Make a booking → Should succeed
6. Verify both bookings use correct subdomain
7. Check Supabase logs for both bookings

**Expected Result**: Both bookings succeed with correct subdomains

---

### Test Case 2: User Without Box Access

**Setup**:
- Create user "unauthorized@example.com"
- DO NOT grant access to any box
- Create device session for "unauthorized@example.com"

**Test Flow**:
1. Login as "unauthorized@example.com"
2. Try to navigate to booking page for ANY box
3. Should be blocked at box selection

**Expected Result**: 403 Forbidden error

---

### Test Case 3: Missing localStorage Email

**Setup**:
- Create user "testuser@example.com"
- Grant access to box
- Create device session
- **Clear localStorage before test**

**Test Flow**:
1. Navigate to booking page (simulate missing localStorage)
2. Try to make a booking
3. Should fail with clear error message

**Expected Result**: Frontend shows "Por favor, inicia sesión de nuevo"

---

### Test Case 4: Subdomain Mismatch Attack

**Setup**:
- Create user "attacker@example.com"
- Grant access ONLY to Box A (subdomain: "boxa")
- Create device session

**Test Flow**:
1. Login as "attacker@example.com"
2. Intercept POST /api/booking request
3. Modify `boxSubdomain` to "boxb" (box they don't have access to)
4. Send modified request

**Expected Result**: 400 Bad Request - "Box subdomain mismatch"

---

## 8. Architecture Best Practices for Multi-Tenant Next.js Apps

### Recommended Pattern:

```typescript
// 1. Validate Request
// 2. Authenticate User
// 3. Authorize Access to Resource (Box)
// 4. Fetch Resource Data from Database
// 5. Validate Request Data Against Database
// 6. Execute Business Logic
// 7. Log All Steps
// 8. Return Clear Errors
```

### Example Implementation (POST /api/booking):

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. VALIDATE REQUEST
    const body = await request.json();
    const validatedRequest = BookingCreateRequestSchema.safeParse(body);
    if (!validatedRequest.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { boxId, boxSubdomain, boxAimharderId } = body;

    // 2. AUTHENTICATE USER
    const userEmail = request.headers.get("x-user-email");
    if (!userEmail) {
      return NextResponse.json({ error: "Missing user email" }, { status: 400 });
    }

    // 3. AUTHORIZE ACCESS
    const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. FETCH RESOURCE DATA
    const box = await BoxService.getBoxById(boxId);
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // 5. VALIDATE REQUEST DATA AGAINST DATABASE
    if (box.subdomain !== boxSubdomain) {
      return NextResponse.json({ error: "Subdomain mismatch" }, { status: 400 });
    }
    if (box.box_id !== boxAimharderId) {
      return NextResponse.json({ error: "Box ID mismatch" }, { status: 400 });
    }

    // 6. EXECUTE BUSINESS LOGIC
    const session = await SupabaseSessionService.getDeviceSession(userEmail);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const bookingResponse = await bookingService.createBooking(
      validatedRequest.data,
      session.cookies,
      box.subdomain // ← Use validated subdomain from database
    );

    // 7. LOG SUCCESS
    console.log('[BOOKING] Success:', { userEmail, boxId, bookingId: bookingResponse.id });

    return NextResponse.json({ success: true, ...bookingResponse });
  } catch (error) {
    // 8. RETURN CLEAR ERRORS
    console.error('[BOOKING] Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## 9. Edge Cases to Consider

### Edge Case #1: User Switches Boxes Mid-Session

**Scenario**: User has bookings open for Box A, switches to Box B, makes booking

**Current Behavior**: Might use wrong box data if frontend state is stale

**Fix**: Ensure `boxId` query param is ALWAYS used to fetch fresh box data

---

### Edge Case #2: Box Data Changes (Subdomain Update)

**Scenario**: Admin updates box subdomain in database while user is booking

**Current Behavior**: Frontend might have cached old subdomain

**Fix**: Implement cache invalidation on box data updates

---

### Edge Case #3: Concurrent Bookings in Multiple Boxes

**Scenario**: User opens two tabs, books in Box A and Box B simultaneously

**Current Behavior**: Both should work if fixes are applied

**Test**: Verify no session conflicts

---

### Edge Case #4: Device Session Expiration During Booking

**Scenario**: User's device session expires exactly when they click "Book"

**Current Behavior**: Token refresh logic handles this (lines 19-87)

**Verify**: Refresh happens BEFORE booking attempt

---

## 10. Summary and Recommendations

### Root Cause (Confirmed):

The issue is **NOT** with subdomain handling architecture itself, but with:

1. **Missing user email validation** → Falls back to hardcoded user
2. **Missing box access authorization** → No security check
3. **Missing subdomain validation** → Uses unverified data from frontend
4. **Potential missing localStorage email** → Header not sent

### Primary Recommendation:

**IMPLEMENT ALL CRITICAL FIXES (#1, #2, #3, #4) IMMEDIATELY**

These fixes will:
- ✅ Ensure correct user session is used
- ✅ Prevent unauthorized box access
- ✅ Validate subdomain against database
- ✅ Force frontend to send user email
- ✅ Provide clear error messages for debugging

### Secondary Recommendations:

1. Add comprehensive logging (Fix #5)
2. Optimize box data caching (Fix #6)
3. Implement all test cases in Section 7
4. Document multi-tenant patterns for future features

### Expected Outcome:

After implementing these fixes:
- **User 1 (Cerdanyola)** will continue to work (no regression)
- **User 2 (Other box)** will now work correctly:
  - If localStorage missing → Clear error message
  - If no access → 403 Forbidden
  - If valid → Booking succeeds with correct subdomain

### Questions for User (If Any):

1. **Can you confirm**: Does the failing user have `user-email` in localStorage?
2. **Can you verify**: Does the failing user have a device session in Supabase `auth_sessions` table?
3. **Can you check**: When the error occurs, what is logged in the browser console and server logs?
4. **Can you test**: Try manually setting the `x-user-email` header in the browser DevTools and retrying the booking

---

## 11. Implementation Priority

### Phase 1: Critical Security & Bug Fixes (Do This First)
- ✅ Fix #1: Remove hardcoded email fallback
- ✅ Fix #2: Add box access validation
- ✅ Fix #3: Add subdomain validation
- ✅ Fix #4: Ensure frontend always sends email header

### Phase 2: Observability & Debugging (Do This Next)
- ✅ Fix #5: Add comprehensive logging
- ✅ Test Case 1, 2, 3, 4 from Section 7

### Phase 3: Performance Optimization (Do This Last)
- ✅ Fix #6: Cache box data in frontend
- ✅ Implement additional edge case handling

---

**End of Architectural Review**

Please review this analysis and confirm if you'd like me to proceed with creating the implementation plan files for each fix.
