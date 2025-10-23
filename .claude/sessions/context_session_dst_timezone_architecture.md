# Context Session: DST Timezone Architecture Analysis

## Problem Statement

The user has clarified that **this is NOT a display or format parsing issue**. The bug is about **timezone offset calculations being dependent on the CLASS DATE, not the current date**.

### Real Scenario

**TODAY (Oct 23, 2025):** Madrid is in UTC+2 (CEST - summer time)
**CLASS DATE (Oct 28, 2025):** Madrid will be in UTC+1 (CET - winter time, after DST transition on Oct 26-27)

When a user tries to book a class today for Oct 28:
1. System detects "error: you can only book 4 days in advance"
2. **BUG:** Backend calculates `availableAt = classTimeUTC - 4 days`
3. **PROBLEM:** The `classTimeUTC` that arrives at the backend is calculated using the CURRENT timezone offset (UTC+2) instead of the CLASS DATE's timezone offset (UTC+1)

### Expected vs Actual Behavior

#### WHAT HAPPENS NOW (INCORRECT):
```
Oct 23 (UTC+2): User tries to book 08:00 Madrid time
Frontend calculates: 08:00 Madrid (Oct 23) = 06:00 UTC (using current offset UTC+2)
Frontend sends: classTimeUTC = "2025-10-28T06:00:00.000Z" (WRONG - uses today's offset)
Backend calculates: availableAt = 06:00 - 4 days = Oct 24 06:00 UTC
Result: Prebooking executes at 06:00 UTC = 08:00 Madrid (Oct 24)
```

#### WHAT SHOULD HAPPEN (CORRECT):
```
Oct 28 (UTC+1): Class is ACTUALLY at 08:00 Madrid = 07:00 UTC
Backend should calculate: availableAt = 07:00 - 4 days = Oct 24 07:00 UTC
Result: Prebooking should execute at 07:00 UTC = 08:00 Madrid (Oct 24)
```

**The bug:** 1 hour difference because the offset used for Oct 28 is incorrect.

## Root Cause Analysis

### Current Flow

1. **Frontend (`booking-dashboard.component.tsx`)**:
   ```typescript
   const apiDate = BookingUtils.formatDateForApi(bookingDay.date); // Returns "20251028"
   classTimeUTC = convertLocalToUTC(apiDate, classTime); // e.g., "08:00"
   ```

2. **Timezone Utils (`timezone.utils.ts`)**:
   ```typescript
   export function convertLocalToUTC(localDate: string, localTime: string): string {
     const browserTimezone = getBrowserTimezone(); // "Europe/Madrid"
     const localDateTime = `${localDate}T${localTime}:00`; // "20251028T08:00:00"
     const utcDate = fromZonedTime(localDateTime, browserTimezone);
     return utcDate.toISOString();
   }
   ```

3. **Problem Identification**:
   - `formatDateForApi` returns `"20251028"` (no hyphens)
   - `localDateTime` becomes `"20251028T08:00:00"` (NOT valid ISO 8601)
   - `fromZonedTime` **might be misinterpreting this format**
   - Or it's using the browser's CURRENT offset instead of the CLASS DATE's offset

### Why fromZonedTime Might Fail

`date-fns-tz`'s `fromZonedTime` requires a valid date string. When given `"20251028T08:00:00"`:
- It might parse it incorrectly
- It might use the current timezone offset instead of the target date's offset
- It might fall back to some default behavior

## User's Key Requirement

> "Tenemos que reservar en la hora del box. Me da igual en el horario en el que esté el usuario"

**Translation:** "We have to book at the box's time. I don't care about the user's timezone"

This means:
1. The box has a fixed timezone (e.g., "Europe/Madrid")
2. All class times are in the box's local timezone
3. The system should calculate UTC using the box's timezone FOR THAT SPECIFIC DATE
4. It should NOT use the browser/user's timezone

## Architectural Decision

### Current Architecture Issues

1. **No Box Timezone in Database**:
   - The `Box` model doesn't have a `timezone` field
   - We're relying on browser timezone detection
   - This fails when box timezone ≠ user timezone

2. **Frontend Calculates UTC**:
   - Frontend uses `getBrowserTimezone()` to convert local to UTC
   - This is WRONG if the user is in a different timezone than the box
   - Example: User in NYC (UTC-4) booking Madrid box (UTC+1)

3. **Date Format Issue**:
   - `apiDate` is `"20251028"` (no hyphens)
   - This creates invalid ISO 8601: `"20251028T08:00:00"`
   - `fromZonedTime` might misinterpret this

### Proposed Solution: Box Timezone Architecture

#### Option A: Store Box Timezone (RECOMMENDED)

**Pros:**
- Correct: Box timezone is independent of user timezone
- Scalable: Supports users in any timezone booking any box
- Accurate: Always uses the correct offset for the class date
- Future-proof: Handles multi-box, multi-timezone scenarios

**Cons:**
- Requires database migration
- Need to detect/store box timezone on box creation
- More complex implementation

**Implementation:**
1. Add `timezone` field to `Box` model (e.g., `"Europe/Madrid"`)
2. Detect timezone when box is discovered (from AimHarder API or manual config)
3. Send box timezone to frontend along with class data
4. Frontend uses box timezone (not browser timezone) for UTC conversion
5. Backend validates using box timezone

#### Option B: Fix Date Format Only

**Pros:**
- Simple: Just normalize date format
- Quick: No database changes
- Minimal code changes

**Cons:**
- Doesn't solve user timezone mismatch
- Still relies on browser timezone
- Only fixes DST if user is in same timezone as box

**Implementation:**
1. Normalize `apiDate` format in `convertLocalToUTC`
2. Ensure `fromZonedTime` receives valid ISO 8601
3. Add unit tests for cross-DST scenarios

## Recommended Approach: HYBRID

1. **Short-term (IMMEDIATE FIX):**
   - Fix date format issue in `timezone.utils.ts`
   - This solves the current DST bug for users in Madrid
   - Deploy quickly to production

2. **Long-term (PROPER ARCHITECTURE):**
   - Add `timezone` field to `Box` model
   - Update box detection to store timezone
   - Update frontend to use box timezone instead of browser timezone
   - Update backend validation to use box timezone

## Files Affected

### Immediate Fix (Option B)
1. `common/utils/timezone.utils.ts` - Normalize date format
2. `common/utils/timezone.utils.test.ts` - Add DST tests
3. `.claude/sessions/context_session_dst_availableat_bug.md` - Update status

### Long-term Solution (Option A)
1. **Database:**
   - `supabase/migrations/` - Add timezone column to boxes table

2. **Models:**
   - `modules/boxes/models/box.model.ts` - Add timezone field
   - `modules/boxes/api/models/box.api.ts` - Update API schema

3. **Services:**
   - `modules/boxes/api/services/box-detection.service.ts` - Detect timezone
   - `modules/boxes/api/services/box.service.ts` - Store/retrieve timezone

4. **Frontend:**
   - `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Use box timezone
   - `common/utils/timezone.utils.ts` - Accept timezone parameter

5. **Backend:**
   - `app/api/booking/route.ts` - Pass box timezone
   - `modules/prebooking/utils/error-parser.utils.ts` - Use box timezone

## Implementation Priority

### Phase 1: IMMEDIATE (Fix Current Bug)
- [ ] Normalize date format in `convertLocalToUTC`
- [ ] Add defensive logging for DST debugging
- [ ] Add unit tests for YYYYMMDD format
- [ ] Add unit tests for cross-DST scenarios
- [ ] Deploy to production

### Phase 2: ARCHITECTURAL (Proper Solution)
- [ ] Add timezone field to Box model
- [ ] Create database migration
- [ ] Update box detection to store timezone
- [ ] Update frontend to use box timezone
- [ ] Update backend validation
- [ ] Add comprehensive tests
- [ ] Deploy to production

## Questions for User

1. **Is the box always in the same timezone?**
   - If yes, we can hardcode "Europe/Madrid"
   - If no, we need to detect/store it per box

2. **Do users ever book from different timezones?**
   - If yes, we MUST use box timezone (not browser timezone)
   - If no, the format fix might be sufficient

3. **Should we prioritize quick fix or proper architecture?**
   - Quick fix: 1 day
   - Proper architecture: 3-5 days

## Next Steps

1. Create implementation plan in `.claude/doc/dst_timezone_architecture/`
2. Consult with `frontend-developer` subagent on timezone flow
3. Consult with `qa-criteria-validator` on test scenarios
4. Get user confirmation on architectural approach
5. Implement based on priority

## Implementation Plan Created

A comprehensive implementation plan has been created at:
**`.claude/doc/dst_timezone_architecture/nextjs_architect.md`**

### Plan Overview

**Phase 1: IMMEDIATE FIX (1 day)**
- Fix date format normalization in `timezone.utils.ts`
- Add comprehensive unit tests for DST scenarios
- Deploy to production
- Solves the current bug for users in Madrid timezone

**Phase 2: ARCHITECTURAL IMPROVEMENT (1 week)**
- Add box timezone to database
- Update frontend to use box timezone (not browser timezone)
- Update backend to validate box timezone
- Enables cross-timezone bookings (user in NYC booking Madrid box)

### Key Files in Implementation Plan

1. **Date Format Fix:**
   - `common/utils/timezone.utils.ts` - Normalize YYYYMMDD to YYYY-MM-DD
   - `common/utils/timezone.utils.test.ts` - Add DST transition tests

2. **Box Timezone Architecture:**
   - `supabase/migrations/` - Add timezone column
   - `modules/boxes/models/box.model.ts` - Add timezone field
   - `modules/boxes/api/services/box-detection.service.ts` - Detect timezone
   - `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Use box timezone

### Questions for User (IMPORTANT)

Before implementation, please answer:

1. **Phase Priority:**
   - Quick fix only (Phase 1)?
   - Or proper architecture (both phases)?

2. **Timezone Scope:**
   - All boxes in Spain (Europe/Madrid)?
   - Or boxes in other timezones too?

3. **User Base:**
   - Do users book from different timezones?
   - Example: User in USA booking Spanish box?

4. **Timeline:**
   - Is this urgent (need Phase 1 ASAP)?
   - Or can we take time for proper solution?

## Status

- ✅ Problem analyzed
- ✅ Root cause identified (date format + timezone source)
- ✅ Solution options designed (immediate fix + architectural improvement)
- ✅ Implementation plan created (`.claude/doc/dst_timezone_architecture/nextjs_architect.md`)
- ⏳ Awaiting user input on approach
- ⏳ Implementation pending
- ⏳ Testing pending
- ⏳ Deployment pending
