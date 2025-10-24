# Context Session: DST Local Time Fix

## Problem Statement (CONFIRMED BY USER)

The current timezone logic has a FUNDAMENTAL architectural flaw:

**User requirement:** "Tenemos que reservar en la hora del box. Me da igual en el horario en el que esté el usuario"

**Current behavior:** System calculates UTC using browser timezone, which is WRONG when:
1. User timezone ≠ Box timezone
2. Booking crosses DST boundaries

## Real Scenario Analysis

### The Problem in Detail

**TODAY:** October 23, 2025
- Madrid timezone: **UTC+2** (CEST - summer time)

**CLASS DATE:** October 28, 2025
- Madrid timezone: **UTC+1** (CET - winter time, after DST transition on Oct 26-27)

**BOX REQUIREMENT:** Class is at **08:00 Madrid time**

### What SHOULD Happen (Correct)

```
Class: Oct 28, 08:00 Madrid time (UTC+1) = 07:00 UTC
Prebooking available: Oct 24, 08:00 Madrid time (UTC+2) = 06:00 UTC
Backend calculates: availableAt = 06:00 UTC
Display to user: "Se reservará en Oct 24, 08:00 Madrid time"
```

**Result:** Prebooking executes at 08:00 Madrid time on Oct 24 ✅

### What's Happening NOW (Incorrect - after format fix)

```typescript
// Frontend (Oct 23, user in Madrid UTC+2)
const apiDate = "20251028"; // Class date Oct 28
const classTime = "08:00";  // 08:00 Madrid time

// convertLocalToUTC uses BROWSER timezone (Madrid)
convertLocalToUTC("20251028", "08:00")
  → Creates: "2025-10-28T08:00:00" in Europe/Madrid timezone
  → fromZonedTime("2025-10-28T08:00:00", "Europe/Madrid")
  → Result: "2025-10-28T07:00:00.000Z" ✅ CORRECT (uses Oct 28's offset UTC+1)

// Backend
classDateUTC = new Date("2025-10-28T07:00:00.000Z")
availableAt = classDateUTC - 4 days (using millisecond arithmetic)
availableAt = "2025-10-24T07:00:00.000Z"

// Display
07:00 UTC on Oct 24 = 09:00 Madrid time (UTC+2) ❌ WRONG
```

**Result:** Shows "09:00" instead of "08:00" ❌

### Root Cause

The fix from the previous session handled the date format issue, and `fromZonedTime` DOES use the correct offset for Oct 28 (UTC+1).

BUT:
- Class on Oct 28 at 08:00 Madrid (UTC+1) = 07:00 UTC ✅
- When we subtract 4 days: 07:00 UTC - 4 days = Oct 24 at 07:00 UTC
- Oct 24 is in UTC+2, so 07:00 UTC = 09:00 Madrid time ❌

**The problem:** We're keeping the same UTC hour across the DST boundary, but the LOCAL hour changes.

## The Correct Solution

We need to calculate in **LOCAL TIME**, not UTC:

```
Class: Oct 28, 08:00 Madrid time
Subtract 4 days IN LOCAL TIME: Oct 24, 08:00 Madrid time
Then convert to UTC USING OCT 24's OFFSET:
  Oct 24 (UTC+2): 08:00 - 2 hours = 06:00 UTC
```

### Why Current Approach Fails

```typescript
// Current backend logic
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const availableAt = new Date(classDateUTC.getTime() - daysAdvance * millisecondsPerDay);
```

This subtracts **exactly 96 hours** (4 days), which maintains the same UTC hour but not the same local hour across DST.

Example:
- Class: 2025-10-28T07:00:00.000Z (08:00 Madrid UTC+1)
- Subtract 96 hours: 2025-10-24T07:00:00.000Z (09:00 Madrid UTC+2) ❌

## Architectural Solution Options

### Option A: Calculate in Box's Local Timezone (RECOMMENDED)

**Backend receives:**
- `classDay`: "20251028"
- `classTime`: "08:00" (Madrid local time)
- `boxTimezone`: "Europe/Madrid" (NEW - from box data)

**Backend calculates:**
```typescript
// 1. Create local datetime for class
const classLocal = `${classDay}T${classTime}:00`; // "2025-10-28T08:00:00"

// 2. Subtract days IN LOCAL TIME
const availableLocal = sub(parseISO(classLocal), { days: daysAdvance });
// Result: "2025-10-24T08:00:00" (local time)

// 3. Convert to UTC using box timezone FOR THAT SPECIFIC DATE
const availableUTC = fromZonedTime(availableLocal, boxTimezone);
// Oct 24 is UTC+2, so: 08:00 Madrid = 06:00 UTC ✅
```

**Pros:**
- Correct: Always books at same local hour
- Timezone-independent: Works for any user timezone
- Box-centric: Follows user requirement "hora del box"

**Cons:**
- Requires box timezone in database
- More complex implementation
- Need to pass timezone from frontend to backend

### Option B: Fix in Frontend with Two Conversions

**Frontend calculates:**
```typescript
// 1. Subtract days in LOCAL time
const classDateLocal = parseISO(apiDate); // Oct 28
const availableDateLocal = sub(classDateLocal, { days: 4 }); // Oct 24

// 2. Create local datetime for AVAILABLE date
const availableLocal = `${format(availableDateLocal, 'yyyy-MM-dd')}T${classTime}:00`;
// "2025-10-24T08:00:00"

// 3. Convert AVAILABLE local time to UTC
const availableUTC = fromZonedTime(availableLocal, boxTimezone);
// Uses Oct 24's offset: 08:00 Madrid (UTC+2) = 06:00 UTC ✅
```

**Send to backend:**
- `availableAt`: "2025-10-24T06:00:00.000Z"

**Pros:**
- Frontend handles all timezone logic
- Backend just stores and schedules
- No database changes needed

**Cons:**
- Frontend does calculation that belongs in backend
- Duplicates logic (frontend calculates what backend should calculate)
- Less transparent for debugging

### Option C: Store Local Time + Timezone (MOST ROBUST)

**Database stores:**
- `class_time_local`: "08:00"
- `class_date`: "2025-10-28"
- `box_timezone`: "Europe/Madrid"
- `available_at_utc`: "2025-10-24T06:00:00.000Z" (calculated)

**Backend calculates on prebooking creation:**
```typescript
function calculateAvailableAt(
  classDate: string,
  classTime: string,
  boxTimezone: string,
  daysAdvance: number
): Date {
  // Work entirely in box's local timezone
  const classLocalDateTime = `${classDate}T${classTime}:00`;
  const classLocal = parseISO(classLocalDateTime);

  // Subtract days in LOCAL time (maintains clock hour)
  const availableLocal = sub(classLocal, { days: daysAdvance });

  // Convert to UTC using box timezone for THAT specific date
  return fromZonedTime(availableLocal, boxTimezone);
}
```

**Pros:**
- Single source of truth
- Clear separation of concerns
- Audit trail (can see local time in logs)
- Works for multi-timezone scenarios

**Cons:**
- Most complex implementation
- Requires database changes
- Need to migrate existing data

## Recommended Approach: OPTION C (Phased Implementation)

### Phase 1: Hardcoded Box Timezone (IMMEDIATE FIX - 1 day)

**Goal:** Fix the bug without database changes

**Implementation:**
1. Hardcode box timezone in backend: `const BOX_TIMEZONE = 'Europe/Madrid'`
2. Update `parseEarlyBookingError` to calculate in local time:
   ```typescript
   // Instead of receiving classTimeUTC, receive classDay + classTime
   function parseEarlyBookingError(
     errorMessage: string,
     classDay: string,
     classTime: string,
   ): ParsedEarlyBookingError | null {
     const BOX_TIMEZONE = 'Europe/Madrid';

     // Create local datetime
     const classLocal = parseISO(`${classDay}T${classTime}:00`);

     // Subtract days in local time
     const availableLocal = sub(classLocal, { days: daysAdvance });

     // Convert to UTC using box timezone FOR THAT DATE
     const availableUTC = fromZonedTime(availableLocal, BOX_TIMEZONE);

     return { availableAt: availableUTC, ... };
   }
   ```
3. Update frontend to send `classTime` string instead of `classTimeUTC`

**Files to modify:**
- `modules/prebooking/utils/error-parser.utils.ts` - Update calculation logic
- `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Send classTime instead of classTimeUTC
- `app/api/booking/route.ts` - Pass classTime to error parser

**Testing:**
- Test Oct 28 class (UTC+1) with Oct 24 availability (UTC+2)
- Verify availableAt shows 08:00 Madrid time on both dates

### Phase 2: Box Timezone in Database (PROPER SOLUTION - 1 week)

**Goal:** Support multi-timezone boxes

**Implementation:**
1. Add `timezone` column to `boxes` table
2. Update box detection to detect/store timezone
3. Pass box timezone from frontend to backend
4. Use box timezone in calculations (replace hardcoded value)

**Files to modify:**
- `supabase/migrations/` - Add timezone column
- `modules/boxes/models/box.model.ts` - Add timezone field
- `modules/boxes/api/services/box-detection.service.ts` - Detect timezone
- `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Pass boxTimezone
- `modules/prebooking/utils/error-parser.utils.ts` - Use boxTimezone parameter

## Files Affected (Phase 1)

### Backend
1. **`modules/prebooking/utils/error-parser.utils.ts`**
   - Change signature: `parseEarlyBookingError(errorMessage, classDay, classTime)`
   - Add: `const BOX_TIMEZONE = 'Europe/Madrid'`
   - Replace millisecond arithmetic with local time calculation
   - Use `fromZonedTime` for available date conversion

2. **`app/api/booking/route.ts`** (if exists, or wherever backend API is)
   - Update call to `parseEarlyBookingError`
   - Pass `classTime` instead of `classTimeUTC`

### Frontend
3. **`modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`**
   - Remove `convertLocalToUTC` call
   - Send `classTime` as string instead of UTC conversion
   - Update API call to include `classTime` parameter

### Testing
4. **`modules/prebooking/utils/error-parser.utils.test.ts`**
   - Add cross-DST test cases
   - Test Oct 28 class with Oct 24 availability
   - Verify local hour is maintained

## Implementation Details (Phase 1)

### 1. Update error-parser.utils.ts

**Current:**
```typescript
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTimeUTC?: Date
): ParsedEarlyBookingError | null {
  // ... extracts daysAdvance ...

  let classDateUTC: Date;
  if (classTimeUTC && classTimeUTC instanceof Date) {
    classDateUTC = classTimeUTC;
  } else {
    // Fallback to 00:00 UTC
  }

  // BUG: This maintains UTC hour, not local hour
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const availableAt = new Date(classDateUTC.getTime() - daysAdvance * millisecondsPerDay);
}
```

**Fixed:**
```typescript
import { parseISO, sub } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const BOX_TIMEZONE = 'Europe/Madrid'; // Hardcoded for Phase 1

export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTime: string,  // NEW: local time string "HH:mm"
): ParsedEarlyBookingError | null {
  if (!errorMessage) return null;

  // Extract days advance
  const daysMatch = errorMessage.match(/(\d+)\s+días?\s+de\s+antelación/i);
  if (!daysMatch) return null;
  const daysAdvance = parseInt(daysMatch[1], 10);

  // Normalize classDay format: YYYYMMDD → YYYY-MM-DD
  let normalizedDate = classDay;
  if (/^\d{8}$/.test(classDay)) {
    normalizedDate = `${classDay.substring(0, 4)}-${classDay.substring(4, 6)}-${classDay.substring(6, 8)}`;
  }

  // Create local datetime string
  const classLocalDateTime = `${normalizedDate}T${classTime}:00`;
  console.log('[PreBooking] Class local datetime:', {
    classDay,
    normalizedDate,
    classTime,
    classLocalDateTime,
    boxTimezone: BOX_TIMEZONE,
  });

  // Parse as local date (no timezone conversion yet)
  const classLocal = parseISO(classLocalDateTime);

  // Subtract days in LOCAL time (maintains clock hour across DST)
  const availableLocal = sub(classLocal, { days: daysAdvance });

  console.log('[PreBooking] Local time calculation:', {
    classLocal: classLocal.toISOString(),
    daysAdvance,
    availableLocal: availableLocal.toISOString(),
    explanation: 'Subtracted days in local time, clock hour maintained',
  });

  // Convert available local time to UTC using box timezone
  // This uses the CORRECT offset for the available date (not class date)
  const availableUTC = fromZonedTime(availableLocal, BOX_TIMEZONE);

  // Convert class local time to UTC for reference
  const classUTC = fromZonedTime(classLocal, BOX_TIMEZONE);

  console.log('[PreBooking] UTC conversion:', {
    classLocal: classLocal.toISOString(),
    classUTC: classUTC.toISOString(),
    availableLocal: availableLocal.toISOString(),
    availableUTC: availableUTC.toISOString(),
    explanation: 'Converted to UTC using box timezone for each specific date',
  });

  return {
    availableAt: availableUTC,
    daysAdvance,
    classDate: classUTC,
  };
}
```

### 2. Update booking-dashboard.component.tsx

**Current (line ~176):**
```typescript
let classTimeUTC: string | undefined;
if (classTime) {
  try {
    classTimeUTC = convertLocalToUTC(apiDate, classTime);
    console.log('[BOOKING-FRONTEND] Converted class time:', {
      apiDate,
      classTime,
      classTimeUTC,
      // ...
    });
  } catch (error) {
    // ...
  }
}
```

**Fixed:**
```typescript
// Remove convertLocalToUTC - backend will handle timezone conversion
console.log('[BOOKING-FRONTEND] Sending class time:', {
  apiDate,
  classTime,
  note: 'Backend will calculate timezone using box timezone',
});

// classTime is already in local format "HH:mm", send as-is
```

**Update API call (wherever it sends to backend):**
```typescript
// Before
await bookingApi.createBooking({
  classDay: apiDate,
  classTimeUTC: classTimeUTC,
  // ...
});

// After
await bookingApi.createBooking({
  classDay: apiDate,
  classTime: classTime, // Send local time string
  // ...
});
```

### 3. Add Tests

**error-parser.utils.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import { parseEarlyBookingError } from './error-parser.utils';

describe('parseEarlyBookingError - Cross-DST Scenarios', () => {
  it('should maintain local hour when crossing DST boundary', () => {
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
    expect(result!.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
  });

  it('should maintain local hour in summer time', () => {
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

  it('should handle YYYYMMDD date format', () => {
    const result = parseEarlyBookingError(
      'No puedes reservar clases con más de 4 días de antelación',
      '20251028', // No hyphens
      '08:00'
    );

    expect(result).not.toBeNull();
    expect(result!.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
  });

  it('should handle YYYY-MM-DD date format', () => {
    const result = parseEarlyBookingError(
      'No puedes reservar clases con más de 4 días de antelación',
      '2025-10-28', // With hyphens
      '08:00'
    );

    expect(result).not.toBeNull();
    expect(result!.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
  });
});
```

## Verification Plan

### Manual Testing

1. **Test Case 1: Cross-DST Booking**
   - Date: Oct 23, 2025 (today, UTC+2)
   - Class: Oct 28, 2025 at 08:00 (UTC+1)
   - Expected: "Se reservará en Oct 24, 08:00" (not 09:00)

2. **Test Case 2: Same DST Booking**
   - Date: Oct 15, 2025 (UTC+2)
   - Class: Oct 19, 2025 at 10:00 (UTC+2)
   - Expected: "Se reservará en Oct 15, 10:00"

3. **Test Case 3: Winter to Winter**
   - Date: Nov 5, 2025 (UTC+1)
   - Class: Nov 9, 2025 at 12:00 (UTC+1)
   - Expected: "Se reservará en Nov 5, 12:00"

### Logging Verification

Add comprehensive logs to track:
```typescript
console.log('[PreBooking] Calculation breakdown:', {
  classDay,
  classTime,
  classLocal: '2025-10-28T08:00:00',
  classUTC: '2025-10-28T07:00:00.000Z', // UTC+1
  availableLocal: '2025-10-24T08:00:00',
  availableUTC: '2025-10-24T06:00:00.000Z', // UTC+2
  explanation: 'Clock hour 08:00 maintained in local time',
});
```

### Acceptance Criteria

✅ Prebooking available at same LOCAL hour as class
✅ Works across DST boundaries
✅ Works in same DST period
✅ Frontend sends local time string, not UTC
✅ Backend calculates using box timezone
✅ Tests pass for all DST scenarios
✅ Production logs show correct calculation

## Questions for User (MUST ANSWER)

### Question 1: Box Timezone Scope
- **Option A:** All boxes are in Spain (Europe/Madrid) - can hardcode
- **Option B:** Boxes in multiple timezones - need database field

**Current assumption:** All boxes in Madrid (hardcoded for Phase 1)

### Question 2: Implementation Priority
- **Option A:** Phase 1 only (quick fix with hardcoded timezone)
- **Option B:** Both phases (proper architecture with database)

**Current plan:** Phase 1 immediate, Phase 2 later if needed

### Question 3: Timeline
- **Urgent:** Need fix ASAP (deploy Phase 1 today)
- **Normal:** Can take time to plan both phases

**Current assumption:** Urgent fix needed

## Next Steps

1. ✅ Create context session (this file)
2. ⏳ Get user confirmation on questions above
3. ⏳ Create implementation plan in `.claude/doc/dst_local_time_fix/nextjs_architect.md`
4. ⏳ Consult frontend-developer subagent on API changes
5. ⏳ Implement Phase 1
6. ⏳ Test cross-DST scenarios
7. ⏳ Deploy to production
8. ⏳ Monitor logs and verify correct behavior

## Status

- ✅ Problem analyzed (local time vs UTC calculation)
- ✅ Root cause identified (UTC hour maintained instead of local hour)
- ✅ Solution designed (calculate in local time, convert to UTC per date)
- ✅ Context session created
- ✅ Implementation plan created (`.claude/doc/dst_local_time_fix/nextjs_architect.md`)
- ✅ Architecture reviewed and documented
- ⏳ Awaiting user confirmation on questions
- ⏳ Subagent consultation pending
- ⏳ Implementation pending
- ⏳ Testing pending
- ⏳ Deployment pending

## Implementation Plan Location

**Detailed implementation plan:** `.claude/doc/dst_local_time_fix/nextjs_architect.md`

This plan includes:
- Complete problem analysis with concrete examples
- Phase 1: Immediate fix (hardcoded Europe/Madrid timezone)
- Phase 2: Proper architecture (box timezone in database)
- Detailed code changes for all affected files
- Comprehensive test cases for cross-DST scenarios
- Deployment strategy and rollback plan
- Monitoring and verification procedures

## Key Decisions Made

### Solution Approach
- **Chosen:** Calculate in LOCAL time, then convert to UTC per date
- **Rejected:** Continue using UTC-only calculations (fails across DST)
- **Rejected:** Frontend-only fix (violates separation of concerns)

### Implementation Strategy
- **Phase 1:** Hardcoded `BOX_TIMEZONE = 'Europe/Madrid'` (1 day)
- **Phase 2:** Box timezone in database (1 week, if needed)
- **Rationale:** Quick fix first, proper architecture later

### Technical Decisions
- **Use `fromZonedTime()`** with box timezone for each specific date
- **Use `sub()` from date-fns** for local time arithmetic
- **Backend receives `classTime` string** instead of `classTimeUTC`
- **Comprehensive logging** for debugging DST issues

## Questions for User (MUST ANSWER BEFORE PROCEEDING)

### Critical Questions

1. **Phase Scope:**
   - Option A: Implement Phase 1 only (hardcoded Europe/Madrid) ← Recommended
   - Option B: Implement both phases (with database changes)

2. **Box Locations:**
   - Are all boxes in Spain (Madrid timezone)?
   - Or are there/will there be boxes in other timezones?

3. **Timeline:**
   - Is this urgent (need Phase 1 ASAP)?
   - Or can we take time for proper solution (Phase 2)?

**Recommendation:** Deploy Phase 1 immediately (fixes current bug), plan Phase 2 for future if multi-timezone support needed.

## Next Actions

After user confirms questions above:
1. Consult `frontend-developer` subagent on API contract changes
2. Verify all affected files and dependencies
3. Implement Phase 1 changes
4. Run comprehensive test suite
5. Manual testing for cross-DST scenarios
6. Deploy to production
7. Monitor logs and verify correct behavior
