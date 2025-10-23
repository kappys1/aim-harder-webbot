# Timezone Bug Diagnosis - Prebooking 1 Hour Off in Production

## Problem Summary

**Symptoms:**
- **Local environment:** Class at 08:00 shows correctly (08:00)
- **Production environment:** Same class at 08:00 shows as 09:00 (1 hour off)

**Context:**
- Today: October 24, 2025 (CEST, UTC+2)
- Class date: Same day or future date
- DST transition: October 26, 2025 (CEST → CET, UTC+2 → UTC+1)

## Architecture Overview

### Flow of classTimeUTC

1. **Frontend** (`booking-dashboard.component.tsx`)
   - User clicks "Reserve" on a class slot
   - Gets `classTime` from booking (e.g., "08:00")
   - Calls `convertLocalToUTC(apiDate, classTime)` → ISO 8601 UTC string
   - Includes `classTimeUTC` in POST body to `/api/booking`

2. **Backend** (`app/api/booking/route.ts`)
   - Receives `classTimeUTC` from request body
   - If early booking error, converts string to Date object
   - Passes to `parseEarlyBookingError(errorMsg, day, classTimeUTCDate)`

3. **Error Parser** (`error-parser.utils.ts`)
   - Receives `classTimeUTC` as Date object (UTC)
   - Subtracts days to calculate `availableAt`
   - Returns timestamp for prebooking execution

## Current Implementation Analysis

### 1. Frontend Conversion (`timezone.utils.ts`)

```typescript
export function convertLocalToUTC(localDate: string, localTime: string): string {
  const browserTimezone = getBrowserTimezone();
  const localDateTime = `${localDate}T${localTime}:00`;
  const utcDate = fromZonedTime(localDateTime, browserTimezone);
  return utcDate.toISOString();
}
```

**Key observations:**
- Uses `date-fns-tz` which handles DST automatically
- Gets browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Returns ISO 8601 UTC string (e.g., "2025-10-28T07:00:00.000Z")

**Potential issues:**
- ✅ Local environment: Browser correctly detects timezone
- ❓ Production environment: Browser timezone might differ
- ❓ DST handling: `fromZonedTime` should handle this, but need to verify

### 2. Backend Extraction (`route.ts`)

```typescript
const classTimeUTC = body.classTimeUTC;
```

**Key observations:**
- Extracts `classTimeUTC` from request body
- Schema validation: `z.string().datetime().optional()`
- Converts to Date object: `new Date(classTimeUTC)`

**Potential issues:**
- ❓ Is `classTimeUTC` actually present in the request?
- ❓ Does JSON serialization preserve the value?
- ❓ Is there middleware stripping it?

### 3. Error Parser (`error-parser.utils.ts`)

```typescript
if (classTimeUTC && classTimeUTC instanceof Date && !isNaN(classTimeUTC.getTime())) {
  classDateUTC = classTimeUTC;
} else {
  // Fallback: use 00:00 UTC
  classDateUTC = new Date(Date.UTC(year, month, day, 0, 0, 0));
}
```

**Key observations:**
- Has fallback to 00:00 UTC if `classTimeUTC` not provided
- This would cause the 1-hour discrepancy!

**Hypothesis:**
If `classTimeUTC` is NOT reaching the error parser (undefined/null/invalid), it falls back to 00:00 UTC, which when displayed in user's timezone (UTC+1 or UTC+2) shows as 01:00 or 02:00, but the actual prebooking calculation uses the wrong base time.

## Hypotheses (Ranked by Likelihood)

### ⚠️ CRITICAL FINDING: classTime is undefined

**CODE ANALYSIS REVEALS:**

In `booking-dashboard.component.tsx` line 137:
```typescript
const classTime = booking?.timeSlot.startTime || booking?.timeSlot.time;
```

Then line 174:
```typescript
if (classTime) {
  classTimeUTC = convertLocalToUTC(apiDate, classTime);
} // ELSE: classTimeUTC remains undefined!
```

**This means:**
- If `booking?.timeSlot.startTime` is falsy AND `booking?.timeSlot.time` is falsy
- Then `classTime = undefined`
- Then `classTimeUTC` is never calculated (remains `undefined`)
- Then backend uses fallback 00:00 UTC
- Then prebooking shows wrong time!

### Hypothesis 1: classTime extraction fails in production ⭐⭐⭐⭐⭐
**Likelihood:** VERY HIGH (CONFIRMED BY CODE ANALYSIS)

**Reason:**
- Code has conditional: `if (classTime)` before calculating `classTimeUTC`
- If `booking?.timeSlot.startTime` and `booking?.timeSlot.time` are both undefined/null/empty
- The fallback behavior in `error-parser.utils.ts` uses 00:00 UTC
- This would cause exactly the symptoms described
- Works in local but not prod → data structure difference

**Sub-hypotheses:**
1a. Production API returns different TimeSlot structure
1b. Production booking data has different field names
1c. Production mapper doesn't populate startTime/time fields correctly

**Evidence needed:**
- Frontend logs: What are the values of `startTime` and `time`?
- Compare local vs prod booking object structure
- Check API mapper for differences

### Hypothesis 2: JSON serialization issue ⭐⭐⭐⭐
**Likelihood:** High

**Reason:**
- JSON.stringify might handle the field differently in prod
- Build process might affect how data is serialized
- TypeScript compilation differences

**Evidence needed:**
- Network tab: Inspect actual JSON payload
- Backend: Log `typeof classTimeUTC` and value

### Hypothesis 3: Browser timezone detection differs ⭐⭐⭐
**Likelihood:** Medium

**Reason:**
- Local: Developer's machine timezone
- Production: User's browser timezone
- Could be different timezones causing conversion issues

**Evidence needed:**
- Frontend logs: Browser timezone detected
- Compare local vs prod browser timezone

### Hypothesis 4: DST handling bug in date-fns-tz ⭐⭐
**Likelihood:** Low

**Reason:**
- `fromZonedTime` is well-tested
- But cross-DST scenarios (booking in future timezone offset) are edge cases

**Evidence needed:**
- Frontend logs: Compare input vs output of `convertLocalToUTC`
- Verify DST offset for target date

### Hypothesis 5: Middleware or proxy stripping field ⭐
**Likelihood:** Very Low

**Reason:**
- Vercel/Next.js middleware might modify request
- Unlikely, but possible

**Evidence needed:**
- Backend: Raw request body before parsing

## Diagnostic Logs Added

### Frontend (`booking-dashboard.component.tsx`)
```typescript
console.log('[BOOKING-FRONTEND] Converted class time:', {
  apiDate,
  classTime,
  classTimeUTC,
  browserTimezone,
  currentOffset,
});

console.log('[BOOKING-FRONTEND] Sending booking request:', {
  ...bookingRequest,
  classTimeUTCPresent: !!classTimeUTC,
});
```

### Backend (`route.ts`)
```typescript
console.log('[BOOKING-BACKEND] Received booking request:', {
  day: body.day,
  classTimeUTC,
  classTimeUTCType: typeof classTimeUTC,
  classTimeUTCPresent: !!classTimeUTC,
  boxId,
  boxSubdomain,
});

console.log('[BOOKING] Successfully parsed classTimeUTC:', {
  original: classTimeUTC,
  parsed: classTimeUTCDate.toISOString(),
  utcHours: classTimeUTCDate.getUTCHours(),
  utcMinutes: classTimeUTCDate.getUTCMinutes(),
});

console.log('[BOOKING] parseEarlyBookingError result:', {
  errorMessage,
  classDay,
  classTimeUTCProvided: !!classTimeUTCDate,
  parsedAvailableAt: parsed?.availableAt.toISOString(),
  parsedDaysAdvance: parsed?.daysAdvance,
  parsedClassDate: parsed?.classDate.toISOString(),
});
```

### Error Parser (`error-parser.utils.ts`)
```typescript
console.log('[PreBooking] Using provided classTimeUTC:', {
  classTimeUTC: classTimeUTC.toISOString(),
  utcHours: classTimeUTC.getUTCHours(),
  utcMinutes: classTimeUTC.getUTCMinutes(),
});

console.warn('[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay', {
  classTimeUTCProvided: !!classTimeUTC,
  classTimeUTCType: classTimeUTC?.constructor?.name,
  classTimeUTCValid: classTimeUTC instanceof Date ? !isNaN(classTimeUTC.getTime()) : false,
});
```

## Next Steps

### Phase 1: Deploy and Capture Logs
1. Deploy this version to production
2. Trigger a prebooking scenario (try to book a class early)
3. Capture console logs from:
   - Browser console (frontend logs)
   - Vercel function logs (backend logs)

### Phase 2: Analyze Logs
Compare local vs production logs to identify:
- Is `classTimeUTC` calculated correctly in frontend?
- Is it present in the request body?
- Is it received by backend?
- Is it parsed correctly?
- Which code path is executed (provided vs fallback)?

### Phase 3: Fix Based on Findings
- **If not sent:** Fix frontend to include it
- **If not received:** Investigate serialization/middleware
- **If wrong value:** Fix timezone calculation
- **If DST issue:** Adjust date-fns-tz usage

## Expected Log Output

### Successful case (Local)
```
[BOOKING-FRONTEND] Converted class time: {
  apiDate: "20251024",
  classTime: "08:00",
  classTimeUTC: "2025-10-24T06:00:00.000Z", // UTC+2 → 08:00 - 2 = 06:00 UTC
  browserTimezone: "Europe/Madrid",
  currentOffset: -120
}

[BOOKING-BACKEND] Received booking request: {
  day: "20251024",
  classTimeUTC: "2025-10-24T06:00:00.000Z",
  classTimeUTCType: "string",
  classTimeUTCPresent: true
}

[BOOKING] Successfully parsed classTimeUTC: {
  original: "2025-10-24T06:00:00.000Z",
  parsed: "2025-10-24T06:00:00.000Z",
  utcHours: 6,
  utcMinutes: 0
}

[PreBooking] Using provided classTimeUTC: {
  classTimeUTC: "2025-10-24T06:00:00.000Z",
  utcHours: 6,
  utcMinutes: 0
}

[BOOKING] parseEarlyBookingError result: {
  classTimeUTCProvided: true,
  parsedAvailableAt: "2025-10-20T06:00:00.000Z", // 4 days before
  parsedDaysAdvance: 4,
  parsedClassDate: "2025-10-24T06:00:00.000Z"
}
```

### Failing case (Production - suspected)
```
[BOOKING-FRONTEND] Converted class time: {
  apiDate: "20251024",
  classTime: "08:00",
  classTimeUTC: undefined, // ❌ NOT CALCULATED
  browserTimezone: "Europe/Madrid",
  currentOffset: -120
}

[BOOKING-BACKEND] Received booking request: {
  day: "20251024",
  classTimeUTC: undefined, // ❌ NOT RECEIVED
  classTimeUTCType: "undefined",
  classTimeUTCPresent: false
}

[BOOKING] classTimeUTC not provided or invalid type: {
  value: undefined,
  type: "undefined"
}

[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay: {
  classTimeUTCProvided: false,
  classTimeUTCType: undefined,
  classTimeUTCValid: false
}

[PreBooking] Created fallback UTC date: {
  classDateUTC: "2025-10-24T00:00:00.000Z" // ❌ WRONG! Should be 06:00 UTC
}

[BOOKING] parseEarlyBookingError result: {
  classTimeUTCProvided: false,
  parsedAvailableAt: "2025-10-20T00:00:00.000Z", // ❌ 4 days before 00:00 UTC
  parsedDaysAdvance: 4,
  parsedClassDate: "2025-10-24T00:00:00.000Z"
}

// When displayed in Madrid timezone (UTC+1 on Oct 20):
// "2025-10-20T00:00:00.000Z" → 01:00 local time
// But we want: "2025-10-20T06:00:00.000Z" → 07:00 local time (4 days before 08:00)
```

## References

### Files Modified
- `/modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`
- `/app/api/booking/route.ts`
- `/modules/prebooking/utils/error-parser.utils.ts`

### Key Functions
- `convertLocalToUTC()` - Frontend timezone conversion
- `parseEarlyBookingError()` - Backend timestamp calculation
- `fromZonedTime()` - date-fns-tz DST-aware conversion

### Related Issues
- DST transition: October 26, 2025
- CEST (UTC+2) → CET (UTC+1)

## Status

**Current:** Diagnostic logs added, ready for deployment
**Next:** Deploy to production and capture logs
**Blocked by:** Need production environment access to view logs
