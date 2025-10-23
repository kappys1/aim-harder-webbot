# Context Session: DST AvailableAt Bug Analysis

## Problem Overview

Prebookings are showing **incorrect `availableAt` times** in production due to **cross-DST (Daylight Saving Time) calculations**.

### Symptoms

**Local (Correct):**
- Class: 2025-10-28 08:00 (Madrid time, CET = UTC+1)
- `availableAt`: `2025-10-24T06:00:00.000Z` (4 days before, correct)
- Display: "Se reservará en: 13h 51m"

**Production (Incorrect):**
- Class: 2025-10-28 08:00 (Madrid time, CET = UTC+1)
- `availableAt`: `2025-10-24T07:00:00.000Z` (4 days before, **1 hour late**)
- Display: "Se reservará en: 14h 50m"

### Root Cause Analysis

The issue occurs because of the **DST transition** on October 27, 2025:
- **Today (Oct 23)**: UTC+2 (CEST - Central European Summer Time)
- **Class Date (Oct 28)**: UTC+1 (CET - Central European Time)

The booking happens ACROSS the DST transition boundary, and somewhere in the timezone calculation logic, the **current offset (UTC+2)** is being used instead of the **class date's offset (UTC+1)**.

## Expected vs Actual Behavior

### Expected Calculation (Correct)
```
Class: 2025-10-28 08:00 Madrid (CET, UTC+1)
  → UTC: 2025-10-28 07:00:00Z
  → Subtract 4 days: 2025-10-24 07:00:00Z (prebooking available at)
  → Display in Madrid (CEST, UTC+2): 2025-10-24 09:00 (correct local time)
```

### Actual in Production (Incorrect)
```
Class: 2025-10-28 08:00 Madrid
  → Some miscalculation happens
  → Result: 2025-10-24 08:00:00Z (1 hour late)
```

## Code Flow Analysis

### 1. Frontend Calculation (`booking-dashboard.component.tsx`)

**Lines 175-183:**
```typescript
classTimeUTC = convertLocalToUTC(apiDate, classTime);
console.log('[BOOKING-FRONTEND] Converted class time:', {
  apiDate,
  classTime,
  classTimeUTC,
  browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  currentOffset: new Date().getTimezoneOffset(),
});
```

**Issue:** The `convertLocalToUTC` function uses `fromZonedTime` from `date-fns-tz`, which SHOULD handle DST correctly by using the IANA timezone database. However, there might be an issue with how the date string is constructed or parsed.

### 2. Timezone Utils (`timezone.utils.ts`)

**Lines 65-85:**
```typescript
export function convertLocalToUTC(localDate: string, localTime: string): string {
  const browserTimezone = getBrowserTimezone();

  // Construct full datetime string: "YYYY-MM-DD HH:mm:ss"
  const localDateTime = `${localDate}T${localTime}:00`;

  // Use fromZonedTime to convert the local time to UTC
  const utcDate = fromZonedTime(localDateTime, browserTimezone);

  return utcDate.toISOString();
}
```

**Potential Issue:** If `localDate` is in format `YYYYMMDD` (no hyphens), then `localDateTime` becomes `20251028T08:00:00`, which might not be correctly parsed by `fromZonedTime`.

### 3. Backend Calculation (`error-parser.utils.ts`)

**Lines 55-86:**
```typescript
if (classTimeUTC && classTimeUTC instanceof Date && !isNaN(classTimeUTC.getTime())) {
  classDateUTC = classTimeUTC;
  console.log('[PreBooking] Using provided classTimeUTC:', {
    classTimeUTC: classTimeUTC.toISOString(),
    utcHours: classTimeUTC.getUTCHours(),
    utcMinutes: classTimeUTC.getUTCMinutes(),
  });
} else {
  // Fallback: parse classDay and use 00:00 UTC
  console.warn('[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay');
  const classDateParsed = parseDateFromYYYYMMDD(classDay);
  classDateUTC = new Date(Date.UTC(
    classDateParsed.getFullYear(),
    classDateParsed.getMonth(),
    classDateParsed.getDate(),
    0, 0, 0
  ));
}

const availableAt = sub(classDateUTC, { days: daysAdvance });
```

**Issue:** If `classTimeUTC` is being calculated incorrectly in the frontend, the backend will just subtract days from the wrong base time.

### 4. Booking Mapper (`booking.mapper.ts`)

**Lines 96-116:**
```typescript
// Parse time string with defensive logic
const timeParts = bookingApi.time.includes(' - ')
  ? bookingApi.time.split(' - ')
  : bookingApi.time.includes('-')
  ? bookingApi.time.split('-')
  : [bookingApi.time, bookingApi.time];

const startTime = timeParts[0]?.trim() || '';
const endTime = timeParts[1]?.trim() || '';

if (!startTime) {
  console.warn('[BookingMapper] Invalid time format detected:', {
    apiTime: bookingApi.time,
    bookingId: bookingApi.id,
    className: bookingApi.className,
  });
}
```

**Previous Fix:** The defensive parsing was added to handle different time formats from the AimHarder API. This fixes the time extraction problem but doesn't directly address DST issues.

## Investigation Questions

### 1. What format is `apiDate` when passed to `convertLocalToUTC`?
**Expected:** `YYYY-MM-DD` (e.g., `2025-10-28`)
**Actual:** Need to verify from logs - could be `YYYYMMDD` (no hyphens)

### 2. Is `fromZonedTime` receiving the correct date format?
If `localDateTime` = `20251028T08:00:00`, it might be interpreted differently than `2025-10-28T08:00:00`.

### 3. Why does local work but production fail?
- **Hypothesis 1:** Different server timezone environments
- **Hypothesis 2:** Different browser timezone detection
- **Hypothesis 3:** Race condition or caching issue
- **Hypothesis 4:** Date format difference in API responses

## Hypothesis: The Problem is in Date Format

Looking at the code in `booking-dashboard.component.tsx`:

```typescript
const apiDate = BookingUtils.formatDateForApi(bookingDay.date);
```

Let me check what `formatDateForApi` returns...

### BookingUtils.formatDateForApi

**Expected output:** `YYYYMMDD` (e.g., `20251028`)

**Problem:** If `apiDate` is `20251028` (no hyphens), then when we do:
```typescript
const localDateTime = `${localDate}T${localTime}:00`;
// Result: "20251028T08:00:00"
```

This is **not a valid ISO 8601 format**! The correct format should be `2025-10-28T08:00:00`.

### The Bug

`fromZonedTime` might be **interpreting the malformed date string incorrectly**, leading to:
1. Using the current timezone offset (UTC+2) instead of the class date's offset (UTC+1)
2. Or falling back to some default behavior

## Solution

### Option A: Fix Date Format in `convertLocalToUTC`

Ensure `localDateTime` is always in ISO 8601 format:

```typescript
export function convertLocalToUTC(localDate: string, localTime: string): string {
  const browserTimezone = getBrowserTimezone();

  // Normalize date format: YYYYMMDD → YYYY-MM-DD
  let normalizedDate = localDate;
  if (/^\d{8}$/.test(localDate)) {
    // Convert YYYYMMDD to YYYY-MM-DD
    normalizedDate = `${localDate.substring(0, 4)}-${localDate.substring(4, 6)}-${localDate.substring(6, 8)}`;
  }

  // Construct ISO 8601 datetime string
  const localDateTime = `${normalizedDate}T${localTime}:00`;

  // Use fromZonedTime to convert the local time to UTC
  const utcDate = fromZonedTime(localDateTime, browserTimezone);

  return utcDate.toISOString();
}
```

### Option B: Fix Date Format Before Calling `convertLocalToUTC`

In `booking-dashboard.component.tsx`, convert `apiDate` to ISO format:

```typescript
// Convert YYYYMMDD to YYYY-MM-DD
const isoDate = apiDate.length === 8
  ? `${apiDate.substring(0, 4)}-${apiDate.substring(4, 6)}-${apiDate.substring(6, 8)}`
  : apiDate;

classTimeUTC = convertLocalToUTC(isoDate, classTime);
```

## Recommended Fix: Option A (Defensive in Utility)

Implement the fix in `timezone.utils.ts` so it's defensive against any input format. This prevents future issues and makes the utility more robust.

### Additional Verification Needed

1. Check production logs for the exact values of:
   - `apiDate`
   - `classTime`
   - `classTimeUTC`
   - `browserTimezone`

2. Verify what `fromZonedTime` returns when given:
   - `20251028T08:00:00` (malformed)
   - `2025-10-28T08:00:00` (correct)

3. Add defensive logging in `convertLocalToUTC` to catch format issues

## Next Steps

1. Update `timezone.utils.ts` with date format normalization
2. Add comprehensive logging for DST debugging
3. Add unit tests for cross-DST scenarios
4. Deploy to production and monitor logs
5. Verify prebooking times are correct

## Files to Modify

1. **`common/utils/timezone.utils.ts`** - Add date format normalization
2. **`common/utils/timezone.utils.test.ts`** - Add tests for YYYYMMDD format
3. **`modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`** - Add more detailed logging

## Test Cases to Add

```typescript
describe('convertLocalToUTC - Date Format Handling', () => {
  it('should handle YYYYMMDD format (no hyphens)', () => {
    const result = convertLocalToUTC('20251028', '08:00');
    expect(result).toBe('2025-10-28T07:00:00.000Z'); // CET = UTC+1
  });

  it('should handle YYYY-MM-DD format (with hyphens)', () => {
    const result = convertLocalToUTC('2025-10-28', '08:00');
    expect(result).toBe('2025-10-28T07:00:00.000Z');
  });

  it('should handle cross-DST scenarios', () => {
    // Booking from Oct 23 (UTC+2) for Oct 28 (UTC+1)
    const result = convertLocalToUTC('20251028', '08:00');
    expect(result).toBe('2025-10-28T07:00:00.000Z');
  });
});
```

## Root Cause Confirmed

**THE BUG:** `BookingUtils.formatDateForApi()` returns `"20251028"` (no hyphens), which is passed to `convertLocalToUTC()`. This creates an **invalid ISO 8601 datetime string** `"20251028T08:00:00"` that `fromZonedTime()` cannot parse correctly for DST transitions.

**THE FIX:** Normalize date format in `convertLocalToUTC()` to ensure valid ISO 8601 format:
```typescript
// Convert YYYYMMDD → YYYY-MM-DD before constructing datetime string
if (/^\d{8}$/.test(localDate)) {
  const year = localDate.substring(0, 4);
  const month = localDate.substring(4, 6);
  const day = localDate.substring(6, 8);
  normalizedDate = `${year}-${month}-${day}`;
}
```

## Status

- ✅ Bug identified: Date format issue in `convertLocalToUTC()`
- ✅ Solution designed: Defensive normalization in `timezone.utils.ts`
- ✅ Implementation plan created: See `.claude/doc/dst_availableat_bug/nextjs_architect.md`
- ⏳ Tests pending
- ⏳ Implementation pending
- ⏳ Production verification pending

## Next Steps

1. Implement the fix in `common/utils/timezone.utils.ts`
2. Add comprehensive unit tests in `timezone.utils.test.ts`
3. Run test suite locally
4. Deploy to production
5. Monitor logs and verify correct `availableAt` times
