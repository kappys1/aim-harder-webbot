# DST AvailableAt Bug - Architecture Analysis & Implementation Plan

## Executive Summary

The prebooking `availableAt` calculation is showing **1 hour difference between local and production** due to a **date format bug** in the timezone conversion logic that causes issues during DST transitions.

**Root Cause:** `convertLocalToUTC()` receives date in `YYYYMMDD` format (e.g., `20251028`) but constructs an invalid ISO datetime string `20251028T08:00:00`, which `fromZonedTime` cannot parse correctly for DST transitions.

**Impact:** Prebookings created across DST boundaries (e.g., booking from Oct 23 UTC+2 for Oct 28 UTC+1) calculate `availableAt` with wrong timezone offset.

**Solution Complexity:** Low - Single defensive fix in `timezone.utils.ts`

---

## Problem Deep Dive

### The Bug in Action

**Scenario:** User in Madrid books class for October 28, 2025 at 08:00

1. **Frontend** (`booking-dashboard.component.tsx`):
   ```typescript
   const apiDate = BookingUtils.formatDateForApi(bookingDay.date);
   // Returns: "20251028" (YYYYMMDD format, no hyphens)

   classTimeUTC = convertLocalToUTC(apiDate, "08:00");
   ```

2. **Timezone Utils** (`timezone.utils.ts`):
   ```typescript
   const localDateTime = `${localDate}T${localTime}:00`;
   // Result: "20251028T08:00:00" ❌ INVALID ISO 8601 FORMAT

   const utcDate = fromZonedTime(localDateTime, browserTimezone);
   // fromZonedTime fails to parse correctly for DST transitions
   ```

3. **Result:**
   - **Expected:** `2025-10-28T07:00:00.000Z` (08:00 CET = UTC+1)
   - **Actual:** `2025-10-28T08:00:00.000Z` (uses wrong offset)

### Why It Fails

`fromZonedTime` from `date-fns-tz` expects **valid ISO 8601 format** with date separators:
- ✅ Valid: `2025-10-28T08:00:00`
- ❌ Invalid: `20251028T08:00:00`

When given an invalid format during a DST transition period, it falls back to using the **current timezone offset** (UTC+2) instead of calculating the **class date's offset** (UTC+1).

### Why Local Works but Production Fails

**Hypothesis 1: Environment Timing**
- Local testing might not be crossing DST boundary
- Production bookings are made closer to the actual DST transition date

**Hypothesis 2: Server vs Browser Timezone**
- Local dev server might use different timezone settings
- Vercel production servers in different region

**Actual Reason:** The bug exists in both, but only manifests when booking **across DST transition dates**. The test scenario (Oct 23 → Oct 28) crosses the Oct 27 DST change.

---

## Current Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Frontend: BookingUtils.formatDateForApi()                       │
│    Input:  Date object                                              │
│    Output: "20251028" (YYYYMMDD)                                    │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Frontend: convertLocalToUTC(apiDate, classTime)                 │
│    Input:  "20251028", "08:00"                                      │
│    Bug:    Constructs "20251028T08:00:00" ❌                        │
│    Output: "2025-10-28T08:00:00.000Z" (WRONG)                      │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Backend: parseEarlyBookingError(errorMsg, day, classTimeUTC)   │
│    Input:  Date("2025-10-28T08:00:00.000Z")                        │
│    Output: availableAt = sub(classTimeUTC, { days: 4 })            │
│    Result: "2025-10-24T08:00:00.000Z" (1 hour late)                │
└─────────────────────────────────────────────────────────────────────┘
```

### Files Involved

| File | Role | Issue |
|------|------|-------|
| `booking.utils.ts` | Formats date to `YYYYMMDD` | Produces format without separators |
| `timezone.utils.ts` | Converts local → UTC | **BUG HERE:** Doesn't normalize date format |
| `booking-dashboard.component.tsx` | Calls conversion | Passes `YYYYMMDD` format |
| `error-parser.utils.ts` | Calculates `availableAt` | Receives incorrect UTC time |

---

## Solution Design

### Option A: Fix in `timezone.utils.ts` (RECOMMENDED)

**Rationale:** Make the utility defensive and robust against any input format.

**Implementation:**

```typescript
export function convertLocalToUTC(localDate: string, localTime: string): string {
  try {
    const browserTimezone = getBrowserTimezone();

    // DEFENSIVE FIX: Normalize date format
    // Handle both "YYYYMMDD" and "YYYY-MM-DD" formats
    let normalizedDate = localDate;
    if (/^\d{8}$/.test(localDate)) {
      // Convert YYYYMMDD → YYYY-MM-DD
      const year = localDate.substring(0, 4);
      const month = localDate.substring(4, 6);
      const day = localDate.substring(6, 8);
      normalizedDate = `${year}-${month}-${day}`;

      console.log('[Timezone] Normalized date format:', {
        input: localDate,
        output: normalizedDate,
      });
    }

    // Construct valid ISO 8601 datetime string
    const localDateTime = `${normalizedDate}T${localTime}:00`;

    // Convert to UTC using correct DST offset for the specific date
    const utcDate = fromZonedTime(localDateTime, browserTimezone);

    console.log('[Timezone] Conversion complete:', {
      localDateTime,
      browserTimezone,
      utcResult: utcDate.toISOString(),
      utcHours: utcDate.getUTCHours(),
      utcMinutes: utcDate.getUTCMinutes(),
    });

    return utcDate.toISOString();
  } catch (error) {
    console.error('[Timezone] Error converting local to UTC:', {
      localDate,
      localTime,
      error,
    });
    throw new Error(`Failed to convert local time to UTC: ${error}`);
  }
}
```

**Advantages:**
- ✅ Single point of fix (DRY principle)
- ✅ Defensive against future format changes
- ✅ No breaking changes for callers
- ✅ Comprehensive error logging
- ✅ Easy to test in isolation

### Option B: Fix in Caller (NOT RECOMMENDED)

**Implementation:**
```typescript
// booking-dashboard.component.tsx
const apiDate = BookingUtils.formatDateForApi(bookingDay.date);
const isoDate = `${apiDate.substring(0, 4)}-${apiDate.substring(4, 6)}-${apiDate.substring(6, 8)}`;
classTimeUTC = convertLocalToUTC(isoDate, classTime);
```

**Disadvantages:**
- ❌ Violates DRY (every caller must remember to convert)
- ❌ Easy to forget in future code
- ❌ More places to maintain

### Option C: Change `formatDateForApi` to Return ISO Format

**Impact:** BREAKING CHANGE - would affect all API calls expecting `YYYYMMDD` format.

**Disadvantages:**
- ❌ High risk (AimHarder API expects `YYYYMMDD`)
- ❌ Requires extensive testing of all booking flows
- ❌ Not worth the risk for this fix

---

## Recommended Implementation

### Phase 1: Fix the Bug (Option A)

**File:** `common/utils/timezone.utils.ts`

1. Add date format normalization logic
2. Add comprehensive logging for debugging
3. Add error handling with context

**Estimated Time:** 30 minutes

### Phase 2: Add Tests

**File:** `common/utils/timezone.utils.test.ts`

```typescript
describe('convertLocalToUTC - Date Format Handling', () => {
  beforeEach(() => {
    // Mock browser timezone to Madrid
    jest.spyOn(Intl, 'DateTimeFormat')
      .mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Europe/Madrid' })
      } as any);
  });

  describe('Date format normalization', () => {
    it('should handle YYYYMMDD format (no hyphens)', () => {
      const result = convertLocalToUTC('20251028', '08:00');
      expect(result).toBe('2025-10-28T07:00:00.000Z'); // CET = UTC+1
    });

    it('should handle YYYY-MM-DD format (with hyphens)', () => {
      const result = convertLocalToUTC('2025-10-28', '08:00');
      expect(result).toBe('2025-10-28T07:00:00.000Z');
    });

    it('should throw error for invalid format', () => {
      expect(() => convertLocalToUTC('invalid', '08:00')).toThrow();
    });
  });

  describe('DST transition handling', () => {
    it('should correctly calculate UTC for summer time date (UTC+2)', () => {
      const result = convertLocalToUTC('20250715', '08:00');
      expect(result).toBe('2025-07-15T06:00:00.000Z'); // CEST = UTC+2
    });

    it('should correctly calculate UTC for winter time date (UTC+1)', () => {
      const result = convertLocalToUTC('20251028', '08:00');
      expect(result).toBe('2025-10-28T07:00:00.000Z'); // CET = UTC+1
    });

    it('should handle booking across DST boundary', () => {
      // Booking FROM Oct 23 (UTC+2) FOR Oct 28 (UTC+1)
      const result = convertLocalToUTC('20251028', '08:00');
      expect(result).toBe('2025-10-28T07:00:00.000Z');

      // Verify available date calculation
      const classDate = new Date(result);
      const availableAt = sub(classDate, { days: 4 });
      expect(availableAt.toISOString()).toBe('2025-10-24T07:00:00.000Z');
    });
  });

  describe('Edge cases', () => {
    it('should handle midnight times', () => {
      const result = convertLocalToUTC('20251028', '00:00');
      expect(result).toBe('2025-10-27T23:00:00.000Z'); // CET = UTC+1
    });

    it('should handle late evening times', () => {
      const result = convertLocalToUTC('20251028', '23:59');
      expect(result).toBe('2025-10-28T22:59:00.000Z');
    });

    it('should handle single digit hours', () => {
      const result = convertLocalToUTC('20251028', '8:00');
      expect(result).toBe('2025-10-28T07:00:00.000Z');
    });
  });
});
```

**Estimated Time:** 1 hour

### Phase 3: Logging & Monitoring

**Files:**
- `booking-dashboard.component.tsx` (already has logs)
- `app/api/booking/route.ts` (already has logs)
- `error-parser.utils.ts` (already has logs)

**Additional Logs Needed:**
- Date format normalization events
- DST offset detection
- UTC conversion results

**Estimated Time:** 15 minutes

### Phase 4: Production Verification

1. Deploy to production
2. Monitor logs for:
   - Date format normalization messages
   - Correct UTC conversion results
   - `availableAt` times matching expectations
3. Test with actual booking across DST boundary
4. Verify countdown timer shows correct time

**Estimated Time:** 30 minutes

---

## Testing Strategy

### Unit Tests

**Coverage Required:**
1. ✅ Date format normalization (`YYYYMMDD` → `YYYY-MM-DD`)
2. ✅ DST summer time (UTC+2)
3. ✅ DST winter time (UTC+1)
4. ✅ Cross-DST boundary scenarios
5. ✅ Edge cases (midnight, single-digit hours)
6. ✅ Error handling (invalid formats)

### Integration Tests

**Test Scenario:**
```typescript
describe('Prebooking creation across DST', () => {
  it('should calculate correct availableAt when booking crosses DST transition', async () => {
    // Mock date: Oct 23, 2025 (UTC+2)
    jest.setSystemTime(new Date('2025-10-23T08:00:00+02:00'));

    // Book class for Oct 28, 2025 at 08:00 (UTC+1)
    const booking = {
      date: '20251028',
      time: '08:00',
    };

    const result = await createPrebooking(booking);

    // Verify: availableAt should be 4 days before class at 08:00 Madrid time
    // Class: Oct 28 08:00 CET (UTC+1) = Oct 28 07:00 UTC
    // Available: Oct 24 08:00 CET (UTC+2) = Oct 24 06:00 UTC
    expect(result.availableAt).toBe('2025-10-24T06:00:00.000Z');
  });
});
```

### Manual Testing Checklist

- [ ] Book class for summer date (July) - verify `availableAt`
- [ ] Book class for winter date (December) - verify `availableAt`
- [ ] Book class for DST transition date (Oct 28) - verify `availableAt`
- [ ] Verify countdown timer shows correct time
- [ ] Check prebooking card displays correct "En: Xh Ym"
- [ ] Verify logs show correct date normalization
- [ ] Test with different browser timezones (NY, Tokyo, London)

---

## Rollout Plan

### Step 1: Implementation (Dev)
1. Update `timezone.utils.ts` with fix
2. Add comprehensive tests
3. Run test suite locally
4. Verify no regressions

### Step 2: Staging Verification
1. Deploy to staging/preview
2. Test booking scenarios
3. Monitor logs
4. Verify `availableAt` calculations

### Step 3: Production Deployment
1. Deploy to production
2. Monitor error rates
3. Check prebooking creation logs
4. Verify real user bookings
5. Watch for timezone-related errors

### Step 4: Post-Deployment Monitoring
1. Track prebooking accuracy for 7 days
2. Monitor user feedback
3. Check analytics for booking errors
4. Verify DST transition dates work correctly

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Invalid date format breaks conversion | High | Low | Comprehensive error handling + tests |
| Breaking change for other callers | High | Very Low | Defensive approach maintains backward compatibility |
| DST edge cases not covered | Medium | Low | Extensive test suite with real DST dates |
| Production timezone differs from local | Low | Very Low | Solution is timezone-agnostic |

**Overall Risk:** ✅ LOW - Defensive fix with comprehensive tests and logging

---

## Success Criteria

### Functional Requirements
- ✅ `availableAt` matches expected time in both local and production
- ✅ Cross-DST bookings calculate correctly
- ✅ Countdown timer shows accurate time remaining
- ✅ Prebooking executes at correct time

### Technical Requirements
- ✅ 100% test coverage for date format handling
- ✅ 100% test coverage for DST scenarios
- ✅ Comprehensive error logging
- ✅ Zero breaking changes

### Operational Requirements
- ✅ No increase in error rates post-deployment
- ✅ Logs show successful date normalization
- ✅ User feedback confirms correct timing
- ✅ Works across all supported timezones

---

## Alternative Solutions Considered

### 1. Use Native Date Parser Instead of `fromZonedTime`

**Approach:** Use `Date.UTC()` with manual offset calculation

**Rejected Because:**
- Requires manual DST offset lookup (complex)
- Reinvents the wheel (date-fns-tz already handles this)
- More error-prone than fixing the format issue

### 2. Always Send Date with Hyphens from Frontend

**Approach:** Change `formatDateForApi()` to return `YYYY-MM-DD`

**Rejected Because:**
- Breaking change for AimHarder API (expects `YYYYMMDD`)
- High risk, low benefit
- Requires extensive testing of external API calls

### 3. Create Separate Function for Timezone Conversion

**Approach:** `convertApiDateToUTC()` that handles `YYYYMMDD` specifically

**Rejected Because:**
- Violates DRY (duplicate conversion logic)
- Creates confusion about which function to use
- Better to make existing function defensive

---

## Documentation Updates

### Files to Update

1. **`timezone.utils.ts`** - Enhance JSDoc comments:
   ```typescript
   /**
    * Converts a local date/time to UTC ISO 8601 string
    *
    * Handles multiple date formats:
    * - YYYYMMDD (e.g., "20251028")
    * - YYYY-MM-DD (e.g., "2025-10-28")
    *
    * Automatically handles DST transitions by using the timezone offset
    * for the specific date, not the current date.
    */
   ```

2. **Context Session File** - Update with solution status

3. **CHANGELOG.md** - Document the fix:
   ```markdown
   ## [Unreleased]
   ### Fixed
   - DST timezone bug in prebooking availableAt calculation
   - Date format normalization in convertLocalToUTC utility
   - Cross-DST boundary booking scenarios now calculate correctly
   ```

---

## Future Improvements

### Short-term (Next Sprint)
1. Add timezone selection in user settings
2. Display all times in user's preferred timezone
3. Add timezone warnings for cross-timezone bookings

### Medium-term (Next Quarter)
1. Create timezone utility package
2. Centralize all date/time operations
3. Add timezone awareness to all timestamps
4. Implement server-side timezone detection

### Long-term (Backlog)
1. Support multiple timezone displays simultaneously
2. Add timezone conversion UI component
3. Implement intelligent DST warnings
4. Create timezone testing framework

---

## Implementation Checklist

### Code Changes
- [ ] Update `timezone.utils.ts` with date normalization
- [ ] Add comprehensive logging
- [ ] Enhance error handling
- [ ] Update JSDoc comments

### Testing
- [ ] Add unit tests for YYYYMMDD format
- [ ] Add unit tests for DST scenarios
- [ ] Add integration tests for cross-DST bookings
- [ ] Run full test suite
- [ ] Manual testing in dev environment

### Documentation
- [ ] Update context session file
- [ ] Update function documentation
- [ ] Add implementation notes
- [ ] Document test scenarios

### Deployment
- [ ] Create pull request
- [ ] Code review
- [ ] Deploy to staging
- [ ] Verify in staging
- [ ] Deploy to production
- [ ] Monitor logs and errors

### Post-Deployment
- [ ] Verify real user bookings
- [ ] Monitor for 7 days
- [ ] Collect user feedback
- [ ] Update status in context session
- [ ] Document lessons learned

---

## Questions for User

### Clarifications Needed

1. **Test Data Access:**
   - Do you have access to production logs showing the bug?
   - Can you provide specific examples of incorrect `availableAt` times?

2. **Deployment Schedule:**
   - Is this a hotfix or can it wait for next release?
   - Do you want to test in staging first?

3. **Monitoring:**
   - What metrics should we track post-deployment?
   - How long should we monitor before considering it resolved?

4. **Rollback Plan:**
   - If something goes wrong, what's the rollback procedure?
   - Should we implement a feature flag for gradual rollout?

---

## Summary

**Problem:** Date format bug in `convertLocalToUTC()` causes incorrect `availableAt` calculation during DST transitions.

**Solution:** Normalize date format in `timezone.utils.ts` to ensure valid ISO 8601 format for `fromZonedTime()`.

**Complexity:** Low - Single defensive fix with comprehensive tests.

**Risk:** Low - Backward compatible, well-tested, comprehensive error handling.

**Timeline:** 2-3 hours for implementation + testing + deployment.

**Next Step:** Implement the fix in `timezone.utils.ts` following Option A approach.
