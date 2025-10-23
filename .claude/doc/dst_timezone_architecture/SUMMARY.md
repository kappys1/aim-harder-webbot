# DST Timezone Bug - Executive Summary

## The Problem

When users book classes across DST (Daylight Saving Time) transitions, the prebooking `availableAt` time is calculated with the **wrong timezone offset**.

### Example Bug Scenario

**Today:** Oct 23, 2025 - Madrid is UTC+2 (summer time)
**Class:** Oct 28, 2025 - Madrid will be UTC+1 (winter time, after Oct 26-27 transition)

**What happens now (WRONG):**
- User books class at 08:00 Madrid time for Oct 28
- System calculates: 08:00 Madrid = 06:00 UTC (uses today's offset UTC+2)
- Prebooking executes: Oct 24 at 06:00 UTC = 08:00 Madrid time
- **BUG:** Should execute at 07:00 UTC (using Oct 28's offset UTC+1)

**Result:** Prebooking executes 1 hour late!

## Root Cause

Two issues:

1. **Date Format:** Frontend sends `"20251028"` (no hyphens) which creates invalid ISO 8601: `"20251028T08:00:00"`
2. **Timezone Source:** Frontend uses browser timezone instead of box timezone

## Solution: Two-Phase Approach

### Phase 1: IMMEDIATE FIX (1 day)

**Goal:** Fix date format to resolve DST bug for Madrid users

**What we'll do:**
- Normalize date format in `timezone.utils.ts` (YYYYMMDD → YYYY-MM-DD)
- Ensure `fromZonedTime` uses correct offset for class date
- Add comprehensive unit tests for DST transitions

**Impact:**
- Fixes DST bug for users in same timezone as box
- No database changes needed
- Quick deployment (1 day)

**Limitation:**
- Still uses browser timezone
- Won't work correctly if user timezone ≠ box timezone

### Phase 2: ARCHITECTURAL IMPROVEMENT (1 week)

**Goal:** Proper multi-timezone support

**What we'll do:**
- Add `timezone` field to `Box` model in database
- Store box timezone (e.g., "Europe/Madrid")
- Update frontend to use box timezone (not browser timezone)
- Update backend to validate box timezone

**Impact:**
- Users anywhere can book any box correctly
- User in NYC can book Madrid box at correct Madrid time
- Future-proof for international expansion

**Example:**
```
User in NYC (UTC-4) booking Madrid box (UTC+1)
Class: Oct 28, 08:00 Madrid time
System calculates: 08:00 Madrid = 07:00 UTC (uses box timezone)
Result: Correct! Prebooking executes at Madrid box time
```

## Files to Change

### Phase 1 (Date Format Fix)
- `common/utils/timezone.utils.ts` - Normalize date format
- `common/utils/timezone.utils.test.ts` - Add DST tests

### Phase 2 (Box Timezone)
- `supabase/migrations/` - Add timezone column
- `modules/boxes/models/box.model.ts` - Add timezone field
- `modules/boxes/api/services/box-detection.service.ts` - Detect timezone
- `modules/boxes/api/services/box.service.ts` - Store/retrieve timezone
- `common/utils/timezone.utils.ts` - Add timezone parameter
- `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Use box timezone
- `app/api/booking/route.ts` - Validate box timezone

## Decision Points

We need you to decide:

1. **Do Phase 1 only (quick fix) or both phases (proper fix)?**
   - Phase 1: Fast (1 day), limited scope
   - Both phases: Slower (1 week), proper solution

2. **Are all boxes in Spain/Madrid timezone?**
   - If yes: Phase 1 might be enough
   - If no: We need Phase 2

3. **Do users book from different timezones?**
   - If no: Phase 1 might be enough
   - If yes: We need Phase 2

4. **How urgent is this?**
   - Very urgent: Do Phase 1 now, Phase 2 later
   - Can wait: Do both phases properly

## Recommended Approach

**OUR RECOMMENDATION:** Do Phase 1 immediately, then Phase 2

**Why?**
1. Phase 1 fixes the immediate bug (1 day)
2. Phase 2 provides proper architecture (1 week)
3. Users get relief quickly while we build proper solution
4. Future-proof for international expansion

**Timeline:**
- Day 1: Implement Phase 1, deploy to production
- Days 2-7: Implement Phase 2, deploy to production
- Total: 1 week for complete solution

## What Happens Next

1. **You decide:** Which approach (Phase 1 only vs both phases)
2. **We implement:** Follow the plan in `.claude/doc/dst_timezone_architecture/nextjs_architect.md`
3. **We test:** Comprehensive unit + integration tests
4. **We deploy:** Staged deployment with monitoring
5. **We verify:** Confirm bug is fixed in production

## Documentation

- **Full Context:** `.claude/sessions/context_session_dst_timezone_architecture.md`
- **Implementation Plan:** `.claude/doc/dst_timezone_architecture/nextjs_architect.md`
- **This Summary:** `.claude/doc/dst_timezone_architecture/SUMMARY.md`

## Questions?

Ask the parent agent or refer to the detailed implementation plan!
