# DST Local Time Fix - Implementation Plan

## Executive Summary

**Problem:** Prebookings show incorrect `availableAt` times when booking crosses DST boundaries because the system maintains UTC hour instead of local (box) hour.

**Root Cause:** Backend calculates `availableAt = classTimeUTC - 4 days` in UTC, which keeps the same UTC hour but changes the local hour when crossing DST.

**Solution:** Calculate in box's LOCAL time, then convert to UTC using the correct offset for each specific date.

**User Requirement:** "Tenemos que reservar en la hora del box" - Availability must be at the SAME LOCAL HOUR as the class, regardless of DST transitions.

## Problem Deep Dive

### Concrete Example

**Setup:**
- Today: Oct 23, 2025 (Madrid UTC+2 - summer time)
- Class: Oct 28, 2025 at 08:00 Madrid time (UTC+1 - winter time, after DST on Oct 26-27)
- Box location: Madrid (Europe/Madrid timezone)

**Current Behavior (WRONG):**
```
Class: Oct 28, 08:00 Madrid (UTC+1) = 07:00 UTC
Backend: availableAt = 07:00 UTC - 4 days = Oct 24, 07:00 UTC
Display: Oct 24, 07:00 UTC = 09:00 Madrid (UTC+2) ❌
```

User sees: "Se reservará en: Oct 24, 09:00" (WRONG - should be 08:00)

**Expected Behavior (CORRECT):**
```
Class: Oct 28, 08:00 Madrid time
Subtract 4 days IN LOCAL TIME: Oct 24, 08:00 Madrid time
Convert to UTC FOR OCT 24: 08:00 Madrid (UTC+2) = 06:00 UTC ✅
```

User sees: "Se reservará en: Oct 24, 08:00" (CORRECT)

### Why This Matters

The DST transition on Oct 26-27 means:
- **Oct 24-26:** Clocks show UTC+2 (summer time)
- **Oct 27-28:** Clocks show UTC+1 (winter time)

When we subtract 4 days in UTC:
- We go from 07:00 UTC (08:00 local on Oct 28)
- To 07:00 UTC (09:00 local on Oct 24)
- **The UTC hour stayed the same, but the LOCAL hour changed by 1 hour** ❌

What we need:
- Go from 08:00 Madrid time (Oct 28)
- To 08:00 Madrid time (Oct 24)
- **The LOCAL hour stays the same, UTC hour changes to match** ✅

## Architectural Solution

### Core Principle

**Work in LOCAL TIME (box timezone), then convert to UTC for storage/scheduling**

This ensures:
1. Prebooking always at same LOCAL hour as class
2. Correct behavior across DST boundaries
3. Timezone-independent (works for users in any timezone)

### Implementation Strategy: Phased Approach

#### Phase 1: Hardcoded Box Timezone (IMMEDIATE FIX)

**Timeline:** 1 day
**Complexity:** Low
**Database changes:** None

**Approach:**
- Hardcode `BOX_TIMEZONE = 'Europe/Madrid'` in backend
- Change backend to receive `classTime` string instead of `classTimeUTC`
- Calculate in local time, convert to UTC per date
- Update frontend to send local time string

**Pros:**
- Quick deployment
- No database migration
- Fixes current bug immediately

**Cons:**
- Only works for Spain boxes
- Not scalable to multi-timezone

#### Phase 2: Box Timezone in Database (PROPER SOLUTION)

**Timeline:** 1 week
**Complexity:** Medium
**Database changes:** Yes (add timezone column to boxes)

**Approach:**
- Add `timezone` field to Box model
- Detect timezone on box creation
- Pass timezone from frontend to backend
- Use box timezone in calculations

**Pros:**
- Supports multi-timezone boxes
- Scalable architecture
- Single source of truth

**Cons:**
- Requires migration
- More complex implementation
- Need to handle timezone detection

### Recommended Path

**Start with Phase 1** (immediate fix), then implement Phase 2 if/when needed for multi-timezone support.

## Phase 1: Detailed Implementation Plan

### 1. Backend Changes

#### File: `modules/prebooking/utils/error-parser.utils.ts`

**Current signature:**
```typescript
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTimeUTC?: Date
): ParsedEarlyBookingError | null
```

**New signature:**
```typescript
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTime: string  // Changed from Date to string (local time "HH:mm")
): ParsedEarlyBookingError | null
```

**Implementation:**
```typescript
import { parseISO, sub } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

// Hardcoded for Phase 1 - will be replaced with box.timezone in Phase 2
const BOX_TIMEZONE = 'Europe/Madrid';

export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTime: string,
): ParsedEarlyBookingError | null {
  if (!errorMessage) return null;

  // Extract days advance from error message
  const daysMatch = errorMessage.match(/(\d+)\s+días?\s+de\s+antelación/i);
  if (!daysMatch) {
    console.warn('[PreBooking] Could not extract days from error message:', errorMessage);
    return null;
  }
  const daysAdvance = parseInt(daysMatch[1], 10);

  // Normalize date format: YYYYMMDD → YYYY-MM-DD
  let normalizedDate = classDay;
  if (/^\d{8}$/.test(classDay)) {
    normalizedDate = `${classDay.substring(0, 4)}-${classDay.substring(4, 6)}-${classDay.substring(6, 8)}`;
  }

  // Create local datetime string (no timezone yet)
  const classLocalDateTime = `${normalizedDate}T${classTime}:00`;

  console.log('[PreBooking] Starting calculation:', {
    input: {
      classDay,
      classTime,
      daysAdvance,
    },
    normalized: {
      classLocalDateTime,
      boxTimezone: BOX_TIMEZONE,
    },
  });

  // Parse as date object (local time, no timezone conversion yet)
  const classLocal = parseISO(classLocalDateTime);

  // CRITICAL: Subtract days in LOCAL time
  // This maintains the clock hour (08:00 stays 08:00)
  const availableLocal = sub(classLocal, { days: daysAdvance });

  console.log('[PreBooking] Local time calculation:', {
    classLocal: {
      dateTime: classLocal.toISOString(),
      explanation: 'Class time in local (parsed, not yet timezone-converted)',
    },
    availableLocal: {
      dateTime: availableLocal.toISOString(),
      explanation: `Subtracted ${daysAdvance} days in local time - clock hour maintained`,
    },
  });

  // Convert to UTC using box timezone
  // CRITICAL: Uses the SPECIFIC DATE's offset (not current date's offset)
  const classUTC = fromZonedTime(classLocal, BOX_TIMEZONE);
  const availableUTC = fromZonedTime(availableLocal, BOX_TIMEZONE);

  console.log('[PreBooking] UTC conversion:', {
    class: {
      local: classLocal.toISOString(),
      utc: classUTC.toISOString(),
      explanation: `Converted using ${BOX_TIMEZONE} offset for ${normalizedDate}`,
    },
    available: {
      local: availableLocal.toISOString(),
      utc: availableUTC.toISOString(),
      explanation: `Converted using ${BOX_TIMEZONE} offset for that specific date`,
    },
    result: {
      availableAt: availableUTC.toISOString(),
      daysAdvance,
      classDate: classUTC.toISOString(),
    },
  });

  return {
    availableAt: availableUTC,
    daysAdvance,
    classDate: classUTC,
  };
}
```

**Key changes:**
1. Changed `classTimeUTC?: Date` to `classTime: string`
2. Added `BOX_TIMEZONE` constant
3. Calculate in local time using `sub()` from `date-fns`
4. Convert to UTC using `fromZonedTime()` with box timezone
5. Comprehensive logging for debugging

**Dependencies to add:**
```typescript
import { parseISO, sub } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
```

#### File: `app/api/booking/route.ts` (or wherever backend receives booking request)

**Change API endpoint to accept `classTime` string:**

**Before:**
```typescript
const { classDay, classTimeUTC, ...otherParams } = requestBody;

const classTimeDate = classTimeUTC ? new Date(classTimeUTC) : undefined;

const result = parseEarlyBookingError(errorMessage, classDay, classTimeDate);
```

**After:**
```typescript
const { classDay, classTime, ...otherParams } = requestBody;

const result = parseEarlyBookingError(errorMessage, classDay, classTime);
```

**Notes:**
- Remove UTC conversion
- Pass `classTime` directly as string
- Backend will handle timezone conversion

### 2. Frontend Changes

#### File: `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`

**Location:** Around line 170-190

**Before:**
```typescript
// Convert local time to UTC for backend prebooking calculation
let classTimeUTC: string | undefined;
if (classTime) {
  try {
    classTimeUTC = convertLocalToUTC(apiDate, classTime);
    console.log('[BOOKING-FRONTEND] Converted class time:', {
      apiDate,
      classTime,
      classTimeUTC,
      browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currentOffset: new Date().getTimezoneOffset(),
    });
  } catch (error) {
    console.error("Error converting class time to UTC:", error);
    toast.error("Error", {
      description: "No se pudo procesar la hora de la clase.",
    });
    return;
  }
}
```

**After:**
```typescript
// Send local time to backend - backend will handle timezone conversion
// This ensures prebooking is at same LOCAL hour as class (user requirement)
if (classTime) {
  console.log('[BOOKING-FRONTEND] Sending class time to backend:', {
    apiDate,
    classTime,
    note: 'Backend will calculate timezone using box timezone (Europe/Madrid)',
    explanation: 'Ensures prebooking at same local hour across DST boundaries',
  });
}
```

**Update API call (wherever booking request is sent):**

**Before:**
```typescript
const response = await createBooking({
  classDay: apiDate,
  classTimeUTC: classTimeUTC, // UTC ISO string
  // ... other params
});
```

**After:**
```typescript
const response = await createBooking({
  classDay: apiDate,
  classTime: classTime, // Local time string "HH:mm"
  // ... other params
});
```

**Notes:**
- Remove `convertLocalToUTC()` call entirely
- Send `classTime` as-is (local time string)
- Backend will handle all timezone logic

#### Optional: Keep convertLocalToUTC for other use cases

If `convertLocalToUTC()` is used elsewhere in the codebase, keep the function but don't use it for prebooking calculation.

**Check usage:**
```bash
grep -r "convertLocalToUTC" --include="*.ts" --include="*.tsx"
```

If only used for prebooking, we can remove the call. If used elsewhere, keep the utility but remove from prebooking flow.

### 3. API Model Changes

#### File: `modules/booking/api/models/booking.api.ts` (or wherever API types are defined)

**Update request type:**

**Before:**
```typescript
export interface CreateBookingRequest {
  classDay: string;      // "20251028"
  classTimeUTC?: string; // "2025-10-28T07:00:00.000Z"
  // ... other fields
}
```

**After:**
```typescript
export interface CreateBookingRequest {
  classDay: string;   // "20251028"
  classTime?: string; // "08:00" (local Madrid time)
  // ... other fields
}
```

### 4. Testing

#### File: `modules/prebooking/utils/error-parser.utils.test.ts`

**Add comprehensive cross-DST tests:**

```typescript
import { describe, it, expect } from 'vitest';
import { parseEarlyBookingError } from './error-parser.utils';

describe('parseEarlyBookingError', () => {
  describe('cross-DST scenarios', () => {
    it('should maintain local hour when crossing from winter to summer', () => {
      // Class on Oct 28 (UTC+1) at 08:00 Madrid time
      // Available on Oct 24 (UTC+2) should also be 08:00 Madrid time
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        '08:00'
      );

      expect(result).not.toBeNull();
      expect(result!.daysAdvance).toBe(4);

      // Class: Oct 28, 08:00 Madrid (UTC+1) = 07:00 UTC
      expect(result!.classDate.toISOString()).toBe('2025-10-28T07:00:00.000Z');

      // Available: Oct 24, 08:00 Madrid (UTC+2) = 06:00 UTC
      // NOTE: Local hour is same (08:00), but UTC hour differs (06:00 vs 07:00)
      expect(result!.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
    });

    it('should maintain local hour when crossing from summer to winter', () => {
      // Class on March 25 (UTC+1) at 10:00 Madrid time
      // Available on March 21 (UTC+1) at 10:00 Madrid time
      // (No DST crossing in this example, but tests the logic)
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250325',
        '10:00'
      );

      expect(result).not.toBeNull();

      // Both dates in winter time (UTC+1)
      // Class: March 25, 10:00 Madrid (UTC+1) = 09:00 UTC
      expect(result!.classDate.toISOString()).toBe('2025-03-25T09:00:00.000Z');

      // Available: March 21, 10:00 Madrid (UTC+1) = 09:00 UTC
      expect(result!.availableAt.toISOString()).toBe('2025-03-21T09:00:00.000Z');
    });

    it('should maintain local hour in summer time (no DST crossing)', () => {
      // Class on July 15 (UTC+2) at 10:00 Madrid time
      // Available on July 11 (UTC+2) at 10:00 Madrid time
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250715',
        '10:00'
      );

      expect(result).not.toBeNull();

      // Both dates in summer time (UTC+2)
      // Class: July 15, 10:00 Madrid (UTC+2) = 08:00 UTC
      expect(result!.classDate.toISOString()).toBe('2025-07-15T08:00:00.000Z');

      // Available: July 11, 10:00 Madrid (UTC+2) = 08:00 UTC
      expect(result!.availableAt.toISOString()).toBe('2025-07-11T08:00:00.000Z');
    });
  });

  describe('date format handling', () => {
    it('should handle YYYYMMDD format (no hyphens)', () => {
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        '08:00'
      );

      expect(result).not.toBeNull();
      expect(result!.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
    });

    it('should handle YYYY-MM-DD format (with hyphens)', () => {
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '2025-10-28',
        '08:00'
      );

      expect(result).not.toBeNull();
      expect(result!.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
    });
  });

  describe('error message parsing', () => {
    it('should extract days from Spanish error message', () => {
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 7 días de antelación',
        '20251028',
        '08:00'
      );

      expect(result).not.toBeNull();
      expect(result!.daysAdvance).toBe(7);
    });

    it('should return null for invalid error message', () => {
      const result = parseEarlyBookingError(
        'Invalid error message',
        '20251028',
        '08:00'
      );

      expect(result).toBeNull();
    });

    it('should return null for undefined error message', () => {
      const result = parseEarlyBookingError(
        undefined,
        '20251028',
        '08:00'
      );

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle morning times correctly', () => {
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        '06:00'
      );

      expect(result).not.toBeNull();
      // Oct 28, 06:00 Madrid (UTC+1) = 05:00 UTC
      expect(result!.classDate.toISOString()).toBe('2025-10-28T05:00:00.000Z');
      // Oct 24, 06:00 Madrid (UTC+2) = 04:00 UTC
      expect(result!.availableAt.toISOString()).toBe('2025-10-24T04:00:00.000Z');
    });

    it('should handle evening times correctly', () => {
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        '20:00'
      );

      expect(result).not.toBeNull();
      // Oct 28, 20:00 Madrid (UTC+1) = 19:00 UTC
      expect(result!.classDate.toISOString()).toBe('2025-10-28T19:00:00.000Z');
      // Oct 24, 20:00 Madrid (UTC+2) = 18:00 UTC
      expect(result!.availableAt.toISOString()).toBe('2025-10-24T18:00:00.000Z');
    });
  });
});
```

**Key test scenarios:**
1. ✅ Cross-DST (Oct 28 winter → Oct 24 summer)
2. ✅ Same DST (summer to summer, winter to winter)
3. ✅ Date format handling (YYYYMMDD vs YYYY-MM-DD)
4. ✅ Error message parsing
5. ✅ Edge cases (early morning, late evening)

### 5. Manual Testing Plan

#### Test Case 1: Cross-DST Booking (CRITICAL)

**Setup:**
- Current date: Oct 23, 2025 (Madrid UTC+2)
- Class: Oct 28, 2025 at 08:00 (Madrid UTC+1)
- Expected: Prebooking at Oct 24, 08:00 Madrid time

**Steps:**
1. Navigate to booking dashboard
2. Select Oct 28, 2025
3. Try to book class at 08:00
4. Should trigger "early booking" error
5. Check prebooking created

**Expected results:**
```
Prebooking:
  classDate: 2025-10-28T07:00:00.000Z (08:00 Madrid UTC+1)
  availableAt: 2025-10-24T06:00:00.000Z (08:00 Madrid UTC+2)
  display: "Se reservará en: Oct 24, 08:00"
```

**Verification:**
- Check backend logs for calculation breakdown
- Verify `availableAt` shows 08:00 local (not 09:00)
- Test actual booking execution at 08:00 on Oct 24

#### Test Case 2: Same DST Period

**Setup:**
- Current date: July 10, 2025 (Madrid UTC+2)
- Class: July 15, 2025 at 10:00 (Madrid UTC+2)
- Expected: Prebooking at July 11, 10:00 Madrid time

**Steps:**
1. Navigate to July 15
2. Try to book class at 10:00
3. Check prebooking

**Expected results:**
```
Prebooking:
  classDate: 2025-07-15T08:00:00.000Z (10:00 Madrid UTC+2)
  availableAt: 2025-07-11T08:00:00.000Z (10:00 Madrid UTC+2)
  display: "Se reservará en: July 11, 10:00"
```

#### Test Case 3: Different Time Slots

**Test various times across DST:**
- 06:00 (early morning)
- 12:00 (midday)
- 18:00 (evening)
- 21:00 (late evening)

**Verify:** All maintain same local hour

### 6. Deployment Plan

#### Pre-deployment Checklist

- [ ] All unit tests pass
- [ ] Manual testing completed for all scenarios
- [ ] Logs reviewed and confirmed correct
- [ ] No breaking changes in API contract
- [ ] Backend API endpoint updated to accept `classTime` string
- [ ] Frontend updated to send `classTime` instead of `classTimeUTC`

#### Deployment Steps

1. **Deploy backend first:**
   - Update `error-parser.utils.ts`
   - Update API endpoint to accept `classTime`
   - Deploy to staging
   - Test with staging frontend

2. **Deploy frontend:**
   - Update `booking-dashboard.component.tsx`
   - Update API models
   - Deploy to staging
   - End-to-end testing

3. **Production deployment:**
   - Deploy backend to production
   - Wait 5 minutes, monitor logs
   - Deploy frontend to production
   - Monitor for errors

#### Rollback Plan

If issues occur:
1. Revert frontend (removes `classTime`, restores `classTimeUTC`)
2. Revert backend (restores UTC calculation)
3. Investigate logs
4. Fix and redeploy

### 7. Monitoring and Verification

#### Production Logs to Monitor

**Backend logs:**
```
[PreBooking] Starting calculation: {...}
[PreBooking] Local time calculation: {...}
[PreBooking] UTC conversion: {...}
```

**Expected log output for Oct 28 class:**
```json
{
  "input": {
    "classDay": "20251028",
    "classTime": "08:00",
    "daysAdvance": 4
  },
  "normalized": {
    "classLocalDateTime": "2025-10-28T08:00:00",
    "boxTimezone": "Europe/Madrid"
  },
  "classLocal": {
    "dateTime": "2025-10-28T08:00:00.000Z",
    "explanation": "Class time in local (parsed)"
  },
  "availableLocal": {
    "dateTime": "2025-10-24T08:00:00.000Z",
    "explanation": "Subtracted 4 days in local time - clock hour maintained"
  },
  "class": {
    "local": "2025-10-28T08:00:00.000Z",
    "utc": "2025-10-28T07:00:00.000Z",
    "explanation": "Converted using Europe/Madrid offset for 2025-10-28"
  },
  "available": {
    "local": "2025-10-24T08:00:00.000Z",
    "utc": "2025-10-24T06:00:00.000Z",
    "explanation": "Converted using Europe/Madrid offset for that specific date"
  },
  "result": {
    "availableAt": "2025-10-24T06:00:00.000Z",
    "daysAdvance": 4,
    "classDate": "2025-10-28T07:00:00.000Z"
  }
}
```

**Verification points:**
- ✅ `classLocal` and `availableLocal` have same clock time (08:00)
- ✅ `classUTC` and `availableUTC` have different UTC times (07:00 vs 06:00)
- ✅ Frontend displays 08:00 for both dates

#### Metrics to Track

1. **Prebooking execution accuracy:**
   - Count: How many prebookings execute at correct time
   - Target: 100% execute at intended local hour

2. **User complaints:**
   - Before: Users report wrong booking time
   - After: No complaints about booking time

3. **Cross-DST bookings:**
   - Track bookings that cross DST boundaries
   - Verify all execute at correct local hour

## Phase 2: Box Timezone in Database (Future)

### Database Changes

**Migration: Add timezone column to boxes table**

```sql
-- Add timezone column to boxes table
ALTER TABLE boxes
ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Madrid';

-- Create index for faster queries
CREATE INDEX idx_boxes_timezone ON boxes(timezone);

-- Add check constraint (optional, for validation)
ALTER TABLE boxes
ADD CONSTRAINT chk_boxes_timezone
CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$');
```

### Model Changes

**File: `modules/boxes/models/box.model.ts`**

```typescript
export interface Box {
  id: string;
  name: string;
  timezone: string; // NEW: IANA timezone string (e.g., "Europe/Madrid")
  // ... other fields
}
```

### Service Changes

**File: `modules/boxes/api/services/box-detection.service.ts`**

Add timezone detection when box is discovered:

```typescript
function detectBoxTimezone(boxLocation?: string): string {
  // Option 1: Hardcode based on known boxes
  const BOX_TIMEZONES: Record<string, string> = {
    'AimHarder Madrid': 'Europe/Madrid',
    'AimHarder Barcelona': 'Europe/Madrid',
    // ... add more as needed
  };

  if (boxLocation && BOX_TIMEZONES[boxLocation]) {
    return BOX_TIMEZONES[boxLocation];
  }

  // Option 2: Use geolocation API (if lat/long available)
  // const timezone = getTimezoneFromCoordinates(lat, long);

  // Fallback: Spain default
  return 'Europe/Madrid';
}
```

### Frontend Changes

Pass box timezone to backend:

```typescript
const response = await createBooking({
  classDay: apiDate,
  classTime: classTime,
  boxTimezone: selectedBox.timezone, // NEW: from box data
  // ... other params
});
```

### Backend Changes

Use box timezone parameter instead of hardcoded:

```typescript
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTime: string,
  boxTimezone: string = 'Europe/Madrid', // NEW: parameter with default
): ParsedEarlyBookingError | null {
  // ... rest of implementation stays the same
  const classUTC = fromZonedTime(classLocal, boxTimezone);
  const availableUTC = fromZonedTime(availableLocal, boxTimezone);
  // ...
}
```

## Success Criteria

### Phase 1

- ✅ Prebookings execute at same LOCAL hour as class
- ✅ Cross-DST scenarios work correctly
- ✅ All unit tests pass
- ✅ Manual testing confirms correct behavior
- ✅ Production logs show correct calculations
- ✅ Zero user complaints about booking times

### Phase 2 (Future)

- ✅ Database has timezone column
- ✅ Box detection stores correct timezone
- ✅ Frontend sends box timezone to backend
- ✅ Backend uses box timezone in calculations
- ✅ Supports boxes in different timezones
- ✅ All existing tests still pass

## Files Summary

### Modified Files (Phase 1)

1. **Backend:**
   - `modules/prebooking/utils/error-parser.utils.ts` - Core calculation logic
   - `app/api/booking/route.ts` - API endpoint (accept classTime string)

2. **Frontend:**
   - `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Remove convertLocalToUTC call
   - `modules/booking/api/models/booking.api.ts` - Update API types

3. **Testing:**
   - `modules/prebooking/utils/error-parser.utils.test.ts` - Add cross-DST tests

### New Files (Phase 2 - Future)

1. **Database:**
   - `supabase/migrations/YYYYMMDDHHMMSS_add_box_timezone.sql` - Migration

2. **Services:**
   - Update `modules/boxes/api/services/box-detection.service.ts` - Timezone detection

## Questions for User

Before implementation, please confirm:

### Question 1: Phase Scope
- **Option A:** Implement Phase 1 only (hardcoded Europe/Madrid)
- **Option B:** Implement both phases (with database changes)

**Recommendation:** Phase 1 first, Phase 2 later if needed

### Question 2: Box Locations
- Are all boxes in Spain (Madrid timezone)?
- Or are there/will there be boxes in other timezones?

**Impact:** If all in Spain, Phase 1 is sufficient. If multi-timezone, need Phase 2.

### Question 3: Timeline
- How urgent is this fix?
- Can we deploy Phase 1 immediately and plan Phase 2 later?

**Recommendation:** Deploy Phase 1 ASAP (1 day), plan Phase 2 for future sprint

## Next Steps

1. ✅ Implementation plan created (this document)
2. ⏳ Get user confirmation on questions above
3. ⏳ Consult `frontend-developer` subagent on API changes
4. ⏳ Implement Phase 1 changes
5. ⏳ Run unit tests
6. ⏳ Manual testing
7. ⏳ Deploy to staging
8. ⏳ Deploy to production
9. ⏳ Monitor logs and verify
10. ⏳ Plan Phase 2 if needed

## Conclusion

This implementation fixes the fundamental DST bug by:
1. Calculating in LOCAL time (box timezone)
2. Maintaining same clock hour across DST boundaries
3. Converting to UTC using correct offset for each specific date

The phased approach allows for:
- Quick fix (Phase 1: 1 day)
- Proper architecture (Phase 2: 1 week if needed)
- Zero breaking changes
- Full test coverage

**Result:** Prebookings will always execute at the same LOCAL HOUR as the class, regardless of DST transitions. ✅
