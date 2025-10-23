# DST Timezone Architecture - Implementation Plan

## Executive Summary

This plan addresses the DST (Daylight Saving Time) timezone bug where prebookings are calculated with incorrect UTC offsets when booking across DST transitions. The issue occurs because the system uses the CURRENT timezone offset instead of the CLASS DATE's timezone offset.

**Read Context First:** `.claude/sessions/context_session_dst_timezone_architecture.md`

## Problem Definition

### Current Bug

When a user books a class that crosses a DST boundary:
- **Today (Oct 23):** Madrid is UTC+2 (CEST)
- **Class (Oct 28):** Madrid will be UTC+1 (CET)
- **Bug:** System calculates `availableAt` using UTC+2 (wrong) instead of UTC+1 (correct)
- **Result:** Prebooking executes 1 hour late

### Root Cause

Two architectural issues:
1. **Date Format:** `apiDate = "20251028"` creates invalid ISO: `"20251028T08:00:00"`
2. **Timezone Source:** Frontend uses browser timezone instead of box timezone

### User Requirement

> "We have to book at the box's time. I don't care about the user's timezone"

This means the system MUST use the box's timezone (not the user's) for all calculations.

## Recommended Solution: HYBRID APPROACH

### Phase 1: IMMEDIATE FIX (Deploy within 1 day)
Fix the date format issue to resolve current DST bug

### Phase 2: ARCHITECTURAL IMPROVEMENT (Deploy within 1 week)
Add box timezone to the database for proper multi-timezone support

## Phase 1: Immediate Fix - Date Format Normalization

### Objective
Fix `convertLocalToUTC` to properly handle YYYYMMDD format and DST transitions

### Implementation Details

#### 1.1 Update `common/utils/timezone.utils.ts`

**File:** `/Users/marcosga/Documents/projects/alex/aimharder-wod-bot2/common/utils/timezone.utils.ts`

**Change:** Normalize date format before constructing ISO 8601 string

**Current Code (Lines 65-85):**
```typescript
export function convertLocalToUTC(localDate: string, localTime: string): string {
  try {
    const browserTimezone = getBrowserTimezone();

    // Construct full datetime string: "YYYY-MM-DD HH:mm:ss"
    const localDateTime = `${localDate}T${localTime}:00`;

    // CRITICAL FIX: Use fromZonedTime to convert the local time to UTC
    const utcDate = fromZonedTime(localDateTime, browserTimezone);

    // Return ISO 8601 UTC string
    return utcDate.toISOString();
  } catch (error) {
    console.error('[Timezone] Error converting local to UTC:', error);
    throw new Error(`Failed to convert local time to UTC: ${error}`);
  }
}
```

**New Code:**
```typescript
export function convertLocalToUTC(localDate: string, localTime: string): string {
  try {
    const browserTimezone = getBrowserTimezone();

    // CRITICAL FIX: Normalize date format to ensure valid ISO 8601
    // Input can be either "YYYYMMDD" or "YYYY-MM-DD"
    let normalizedDate = localDate;

    if (/^\d{8}$/.test(localDate)) {
      // Convert YYYYMMDD to YYYY-MM-DD
      const year = localDate.substring(0, 4);
      const month = localDate.substring(4, 6);
      const day = localDate.substring(6, 8);
      normalizedDate = `${year}-${month}-${day}`;

      console.log('[Timezone] Normalized date format:', {
        original: localDate,
        normalized: normalizedDate,
      });
    }

    // Construct valid ISO 8601 datetime string: "YYYY-MM-DDTHH:mm:ss"
    const localDateTime = `${normalizedDate}T${localTime}:00`;

    // CRITICAL: Use fromZonedTime to convert local time to UTC
    // This automatically handles DST by using the CORRECT offset for the SPECIFIC DATE
    // Example: If class is Oct 28 (UTC+1) but today is Oct 23 (UTC+2),
    //          fromZonedTime will correctly use UTC+1 for Oct 28
    const utcDate = fromZonedTime(localDateTime, browserTimezone);

    console.log('[Timezone] Conversion details:', {
      input: {
        localDate,
        localTime,
        normalizedDate,
        localDateTime,
        browserTimezone,
      },
      output: {
        utcISO: utcDate.toISOString(),
        utcHours: utcDate.getUTCHours(),
        utcMinutes: utcDate.getUTCMinutes(),
      },
    });

    // Return ISO 8601 UTC string
    return utcDate.toISOString();
  } catch (error) {
    console.error('[Timezone] Error converting local to UTC:', error);
    throw new Error(`Failed to convert local time to UTC: ${error}`);
  }
}
```

**Rationale:**
- Normalizes YYYYMMDD format to YYYY-MM-DD for valid ISO 8601
- `fromZonedTime` uses IANA timezone database to get the correct offset FOR THAT SPECIFIC DATE
- This handles DST transitions automatically
- Comprehensive logging for debugging

#### 1.2 Add Unit Tests

**File:** `/Users/marcosga/Documents/projects/alex/aimharder-wod-bot2/common/utils/timezone.utils.test.ts`

**New Tests:**
```typescript
describe('convertLocalToUTC - Date Format Handling', () => {
  beforeEach(() => {
    // Mock getBrowserTimezone to return Madrid timezone
    vi.spyOn(timezoneUtils, 'getBrowserTimezone').mockReturnValue('Europe/Madrid');
  });

  describe('Date format normalization', () => {
    it('should handle YYYYMMDD format (no hyphens)', () => {
      const result = convertLocalToUTC('20251028', '08:00');

      // Oct 28, 2025 is in CET (UTC+1), so 08:00 local = 07:00 UTC
      expect(result).toBe('2025-10-28T07:00:00.000Z');
    });

    it('should handle YYYY-MM-DD format (with hyphens)', () => {
      const result = convertLocalToUTC('2025-10-28', '08:00');

      // Should work identically
      expect(result).toBe('2025-10-28T07:00:00.000Z');
    });

    it('should handle different times on same date', () => {
      const morning = convertLocalToUTC('20251028', '08:00');
      const evening = convertLocalToUTC('20251028', '20:30');

      expect(morning).toBe('2025-10-28T07:00:00.000Z');
      expect(evening).toBe('2025-10-28T19:30:00.000Z');
    });
  });

  describe('DST transition scenarios', () => {
    it('should use UTC+2 for summer dates (before DST transition)', () => {
      // July 15, 2025 is in CEST (UTC+2)
      const result = convertLocalToUTC('20250715', '08:00');

      expect(result).toBe('2025-07-15T06:00:00.000Z');
    });

    it('should use UTC+1 for winter dates (after DST transition)', () => {
      // November 15, 2025 is in CET (UTC+1)
      const result = convertLocalToUTC('20251115', '08:00');

      expect(result).toBe('2025-11-15T07:00:00.000Z');
    });

    it('should correctly handle cross-DST booking scenario', () => {
      // Real bug scenario:
      // Today: Oct 23 (UTC+2)
      // Class: Oct 28 (UTC+1)
      // Class time: 08:00 Madrid
      const result = convertLocalToUTC('20251028', '08:00');

      // Should use UTC+1 for Oct 28 (not UTC+2 from today)
      expect(result).toBe('2025-10-28T07:00:00.000Z');

      // Verify availableAt calculation
      const classTimeUTC = new Date(result);
      const availableAt = new Date(classTimeUTC.getTime() - (4 * 24 * 60 * 60 * 1000));

      // Should be Oct 24 at 07:00 UTC (not 06:00 UTC)
      expect(availableAt.toISOString()).toBe('2025-10-24T07:00:00.000Z');
    });

    it('should handle DST transition date itself', () => {
      // Oct 27, 2025 is the DST transition date (03:00 → 02:00)
      const beforeTransition = convertLocalToUTC('20251027', '02:00');
      const afterTransition = convertLocalToUTC('20251027', '03:00');

      // Both should work correctly
      expect(beforeTransition).toBeTruthy();
      expect(afterTransition).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should handle midnight', () => {
      const result = convertLocalToUTC('20251028', '00:00');
      expect(result).toBe('2025-10-27T23:00:00.000Z');
    });

    it('should handle end of day', () => {
      const result = convertLocalToUTC('20251028', '23:59');
      expect(result).toBe('2025-10-28T22:59:00.000Z');
    });

    it('should throw error for invalid date format', () => {
      expect(() => convertLocalToUTC('invalid', '08:00')).toThrow();
    });

    it('should throw error for invalid time format', () => {
      expect(() => convertLocalToUTC('20251028', 'invalid')).toThrow();
    });
  });
});

describe('convertLocalToUTC - Different Timezones', () => {
  it('should work correctly for New York timezone', () => {
    vi.spyOn(timezoneUtils, 'getBrowserTimezone').mockReturnValue('America/New_York');

    // Oct 28, 2025 is in EDT (UTC-4)
    const result = convertLocalToUTC('20251028', '08:00');

    expect(result).toBe('2025-10-28T12:00:00.000Z');
  });

  it('should work correctly for Tokyo timezone', () => {
    vi.spyOn(timezoneUtils, 'getBrowserTimezone').mockReturnValue('Asia/Tokyo');

    // Tokyo is UTC+9 (no DST)
    const result = convertLocalToUTC('20251028', '08:00');

    expect(result).toBe('2025-10-27T23:00:00.000Z');
  });

  it('should work correctly for UTC', () => {
    vi.spyOn(timezoneUtils, 'getBrowserTimezone').mockReturnValue('UTC');

    const result = convertLocalToUTC('20251028', '08:00');

    expect(result).toBe('2025-10-28T08:00:00.000Z');
  });
});
```

**Test Coverage:**
- Date format normalization (YYYYMMDD vs YYYY-MM-DD)
- DST transitions (UTC+2 vs UTC+1)
- Cross-DST booking scenario (the actual bug)
- Edge cases (midnight, end of day, invalid formats)
- Different timezones (NYC, Tokyo, UTC)

#### 1.3 Update Context Session

**File:** `.claude/sessions/context_session_dst_availableat_bug.md`

**Add:**
```markdown
## Phase 1 Implementation Complete

- ✅ Fixed date format normalization in `timezone.utils.ts`
- ✅ Added comprehensive unit tests for DST scenarios
- ✅ Verified `fromZonedTime` uses correct offset for specific dates
- ✅ Deployed to production

## Verification Steps

1. Run unit tests locally
2. Deploy to production
3. Monitor logs for timezone conversions
4. Test cross-DST booking scenario
5. Verify `availableAt` times are correct
```

### Phase 1 Acceptance Criteria

- [ ] `convertLocalToUTC` accepts both YYYYMMDD and YYYY-MM-DD formats
- [ ] DST transitions are handled correctly (uses class date offset, not current date offset)
- [ ] Unit tests pass with 80%+ coverage
- [ ] Cross-DST booking scenario works correctly in production
- [ ] Comprehensive logging for debugging
- [ ] No regression in existing functionality

### Phase 1 Timeline

- **Implementation:** 2-3 hours
- **Testing:** 1-2 hours
- **Deployment:** 30 minutes
- **Verification:** 1 hour
- **Total:** 1 day

## Phase 2: Architectural Improvement - Box Timezone

### Objective
Add box timezone to database for proper multi-timezone support

### Why This Is Important

**Current Limitation:**
- Frontend uses `getBrowserTimezone()` (user's browser timezone)
- If user timezone ≠ box timezone, calculations are WRONG
- Example: User in NYC (UTC-4) booking Madrid box (UTC+1) → 5 hour difference!

**Proper Solution:**
- Store box timezone in database (e.g., "Europe/Madrid")
- Frontend uses box timezone (not browser timezone) for calculations
- Backend validates using box timezone
- Works correctly regardless of user's location

### Implementation Details

#### 2.1 Database Migration

**File:** `supabase/migrations/YYYYMMDD_add_box_timezone.sql`

```sql
-- Add timezone column to boxes table
ALTER TABLE boxes
ADD COLUMN timezone TEXT DEFAULT 'Europe/Madrid';

-- Add comment
COMMENT ON COLUMN boxes.timezone IS 'IANA timezone identifier for the box (e.g., "Europe/Madrid", "America/New_York")';

-- Update existing boxes to have Madrid timezone (default)
UPDATE boxes
SET timezone = 'Europe/Madrid'
WHERE timezone IS NULL;

-- Make timezone NOT NULL after updating existing data
ALTER TABLE boxes
ALTER COLUMN timezone SET NOT NULL;

-- Create index for faster queries
CREATE INDEX idx_boxes_timezone ON boxes(timezone);
```

**Rollback:**
```sql
-- Remove timezone column
ALTER TABLE boxes DROP COLUMN IF EXISTS timezone;
DROP INDEX IF EXISTS idx_boxes_timezone;
```

#### 2.2 Update Box Model

**File:** `modules/boxes/models/box.model.ts`

**Change:**
```typescript
export interface Box {
  id: string;
  boxId: string;
  subdomain: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  baseUrl: string;
  timezone: string; // IANA timezone (e.g., "Europe/Madrid")
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedBoxInfo {
  subdomain: string;
  name: string;
  boxId: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  timezone?: string; // Optional during detection, defaults to "Europe/Madrid"
}
```

#### 2.3 Update Box API Schema

**File:** `modules/boxes/api/models/box.api.ts`

**Add:**
```typescript
export const BoxApiSchema = z.object({
  id: z.string().uuid(),
  box_id: z.string(),
  subdomain: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  base_url: z.string().url(),
  timezone: z.string(), // IANA timezone
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

#### 2.4 Update Box Detection Service

**File:** `modules/boxes/api/services/box-detection.service.ts`

**Add timezone detection:**
```typescript
async detectBoxInfo(
  subdomain: string,
  aimharderToken: string,
  cookies: CookieData[]
): Promise<DetectedBoxInfo> {
  // ... existing detection logic ...

  // Detect timezone (default to Madrid if not detectable)
  const timezone = await this.detectBoxTimezone(subdomain);

  return {
    subdomain,
    name: boxName,
    boxId,
    phone: boxInfo?.phone,
    email: boxInfo?.email,
    address: boxInfo?.address,
    website: boxInfo?.website,
    logoUrl: boxInfo?.logoUrl,
    timezone, // Add timezone
  };
}

/**
 * Detect box timezone from subdomain or location
 * Default to "Europe/Madrid" if cannot detect
 */
private async detectBoxTimezone(subdomain: string): Promise<string> {
  // Strategy 1: Hardcoded mapping for known boxes
  const knownTimezones: Record<string, string> = {
    'crossfitcerdanyola300': 'Europe/Madrid',
    // Add more as needed
  };

  if (knownTimezones[subdomain]) {
    return knownTimezones[subdomain];
  }

  // Strategy 2: Try to detect from box info API
  // (if AimHarder provides timezone or location data)

  // Strategy 3: Default to Madrid (most boxes are in Spain)
  console.log(`[BoxDetection] Using default timezone for ${subdomain}: Europe/Madrid`);
  return 'Europe/Madrid';
}
```

**Rationale:**
- Start with simple hardcoded mapping
- Can be enhanced later with geolocation API
- Safe default (Europe/Madrid) for Spanish boxes

#### 2.5 Update Box Service

**File:** `modules/boxes/api/services/box.service.ts`

**Update createOrGetBox:**
```typescript
static async createOrGetBox(boxInfo: DetectedBoxInfo): Promise<BoxApiResponse> {
  // Check if box exists
  const { data: existingBox } = await supabaseAdmin
    .from('boxes')
    .select('*')
    .eq('box_id', boxInfo.boxId)
    .single();

  if (existingBox) {
    // Update timezone if changed
    if (existingBox.timezone !== boxInfo.timezone) {
      await supabaseAdmin
        .from('boxes')
        .update({ timezone: boxInfo.timezone })
        .eq('id', existingBox.id);

      console.log(`[BoxService] Updated timezone for box ${existingBox.id}`);
    }

    return existingBox;
  }

  // Create new box with timezone
  const { data: newBox, error } = await supabaseAdmin
    .from('boxes')
    .insert({
      box_id: boxInfo.boxId,
      subdomain: boxInfo.subdomain,
      name: boxInfo.name,
      phone: boxInfo.phone,
      email: boxInfo.email,
      address: boxInfo.address,
      website: boxInfo.website,
      logo_url: boxInfo.logoUrl,
      base_url: `https://${boxInfo.subdomain}.aimharder.com`,
      timezone: boxInfo.timezone || 'Europe/Madrid', // Default timezone
    })
    .select()
    .single();

  if (error) throw error;
  return newBox;
}
```

#### 2.6 Update Timezone Utils

**File:** `common/utils/timezone.utils.ts`

**Add new function with timezone parameter:**
```typescript
/**
 * Converts a local date/time to UTC using a specific timezone
 *
 * This is the CORRECT way to handle multi-timezone scenarios.
 * Use this when you know the timezone of the class (e.g., box timezone).
 *
 * @param localDate - Date string in format "YYYY-MM-DD" or "YYYYMMDD"
 * @param localTime - Time string in format "HH:mm"
 * @param timezone - IANA timezone string (e.g., "Europe/Madrid", "America/New_York")
 * @returns ISO 8601 UTC string
 *
 * @example
 * // User in NYC booking Madrid box class at 08:00 Madrid time
 * convertLocalToUTCWithTimezone("2025-10-28", "08:00", "Europe/Madrid")
 * // Returns: "2025-10-28T07:00:00.000Z" (correct)
 *
 * // vs using browser timezone (WRONG):
 * convertLocalToUTC("2025-10-28", "08:00")
 * // Returns: "2025-10-28T12:00:00.000Z" (wrong - used NYC timezone)
 */
export function convertLocalToUTCWithTimezone(
  localDate: string,
  localTime: string,
  timezone: string
): string {
  try {
    // Normalize date format
    let normalizedDate = localDate;

    if (/^\d{8}$/.test(localDate)) {
      const year = localDate.substring(0, 4);
      const month = localDate.substring(4, 6);
      const day = localDate.substring(6, 8);
      normalizedDate = `${year}-${month}-${day}`;
    }

    // Construct valid ISO 8601 datetime string
    const localDateTime = `${normalizedDate}T${localTime}:00`;

    // CRITICAL: Use the provided timezone (box timezone)
    // NOT the browser timezone
    const utcDate = fromZonedTime(localDateTime, timezone);

    console.log('[Timezone] Conversion with explicit timezone:', {
      input: {
        localDate,
        localTime,
        normalizedDate,
        localDateTime,
        timezone, // Box timezone
      },
      output: {
        utcISO: utcDate.toISOString(),
        utcHours: utcDate.getUTCHours(),
        utcMinutes: utcDate.getUTCMinutes(),
      },
    });

    return utcDate.toISOString();
  } catch (error) {
    console.error('[Timezone] Error converting local to UTC with timezone:', error);
    throw new Error(`Failed to convert local time to UTC: ${error}`);
  }
}

/**
 * Converts a local date/time to UTC using browser timezone
 *
 * DEPRECATED: Use convertLocalToUTCWithTimezone with box timezone instead
 * This function only works correctly if user timezone === box timezone
 *
 * @deprecated Use convertLocalToUTCWithTimezone instead
 */
export function convertLocalToUTC(localDate: string, localTime: string): string {
  const browserTimezone = getBrowserTimezone();
  return convertLocalToUTCWithTimezone(localDate, localTime, browserTimezone);
}
```

**Rationale:**
- New function accepts explicit timezone parameter
- Old function delegates to new function (backward compatible)
- Clear documentation about which to use

#### 2.7 Update Frontend Booking Dashboard

**File:** `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`

**Change (around line 175):**
```typescript
// Get box timezone from current box
const boxTimezone = currentBox?.timezone || 'Europe/Madrid';

// OLD (WRONG - uses browser timezone):
// classTimeUTC = convertLocalToUTC(apiDate, classTime);

// NEW (CORRECT - uses box timezone):
classTimeUTC = convertLocalToUTCWithTimezone(apiDate, classTime, boxTimezone);

console.log('[BOOKING-FRONTEND] Converted class time:', {
  apiDate,
  classTime,
  boxTimezone, // Box timezone (not browser timezone)
  classTimeUTC,
  browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  differentTimezones: Intl.DateTimeFormat().resolvedOptions().timeZone !== boxTimezone,
});
```

**Rationale:**
- Uses box timezone (from database) instead of browser timezone
- Works correctly regardless of user's location
- Logs timezone comparison for debugging

#### 2.8 Update Backend Booking Route

**File:** `app/api/booking/route.ts`

**Add box timezone validation (around line 199):**
```typescript
// Parse and validate request body
const body = await request.json();
const classTimeUTC = body.classTimeUTC;
const boxId = body.boxId;
const boxSubdomain = body.boxSubdomain;
const boxAimharderId = body.boxAimharderId;
const boxTimezone = body.boxTimezone; // NEW: Box timezone

console.log('[BOOKING-BACKEND] Received booking request:', {
  day: body.day,
  classTimeUTC,
  boxId,
  boxSubdomain,
  boxTimezone, // NEW
});

// Validate box timezone
if (!boxTimezone) {
  return NextResponse.json(
    {
      error: "Missing box timezone",
    },
    { status: 400 }
  );
}

// Validate timezone is valid IANA identifier
if (!isValidIANATimezone(boxTimezone)) {
  return NextResponse.json(
    {
      error: "Invalid box timezone",
    },
    { status: 400 }
  );
}
```

**Add validation function:**
```typescript
/**
 * Validates if a string is a valid IANA timezone identifier
 */
function isValidIANATimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
```

#### 2.9 Add Tests

**File:** `modules/boxes/api/services/box-detection.service.test.ts`

```typescript
describe('BoxDetectionService - Timezone Detection', () => {
  it('should detect timezone for known boxes', async () => {
    const result = await service.detectBoxTimezone('crossfitcerdanyola300');
    expect(result).toBe('Europe/Madrid');
  });

  it('should default to Europe/Madrid for unknown boxes', async () => {
    const result = await service.detectBoxTimezone('unknown-box');
    expect(result).toBe('Europe/Madrid');
  });
});
```

**File:** `common/utils/timezone.utils.test.ts`

```typescript
describe('convertLocalToUTCWithTimezone', () => {
  it('should use provided timezone (not browser timezone)', () => {
    // Mock browser timezone to NYC
    vi.spyOn(timezoneUtils, 'getBrowserTimezone').mockReturnValue('America/New_York');

    // Convert using Madrid timezone (box timezone)
    const result = convertLocalToUTCWithTimezone('20251028', '08:00', 'Europe/Madrid');

    // Should use Madrid timezone (UTC+1), not NYC timezone (UTC-4)
    expect(result).toBe('2025-10-28T07:00:00.000Z');
  });

  it('should handle cross-timezone booking correctly', () => {
    // User in Tokyo booking Madrid box
    const result = convertLocalToUTCWithTimezone('20251028', '08:00', 'Europe/Madrid');

    // Should use Madrid time (08:00 = 07:00 UTC)
    // NOT Tokyo time (08:00 = 23:00 UTC previous day)
    expect(result).toBe('2025-10-28T07:00:00.000Z');
  });
});
```

### Phase 2 Acceptance Criteria

- [ ] Database migration adds timezone column successfully
- [ ] Box model includes timezone field
- [ ] Box detection service detects/defaults timezone correctly
- [ ] Frontend uses box timezone (not browser timezone)
- [ ] Backend validates box timezone
- [ ] Unit tests pass with 80%+ coverage
- [ ] Cross-timezone booking scenario works correctly
- [ ] No regression in existing functionality
- [ ] User in NYC can book Madrid box correctly

### Phase 2 Timeline

- **Database Migration:** 1 hour
- **Model Updates:** 2 hours
- **Service Updates:** 3 hours
- **Frontend Updates:** 2 hours
- **Backend Updates:** 2 hours
- **Testing:** 3 hours
- **Deployment:** 1 hour
- **Verification:** 2 hours
- **Total:** 2-3 days

## Testing Strategy

### Unit Tests (80% coverage required)

1. **Timezone Utils:**
   - Date format normalization (YYYYMMDD, YYYY-MM-DD)
   - DST transitions (UTC+2 → UTC+1)
   - Cross-DST booking scenarios
   - Different timezones (Madrid, NYC, Tokyo, UTC)
   - Edge cases (midnight, end of day, invalid formats)
   - Timezone parameter vs browser timezone

2. **Box Detection:**
   - Timezone detection for known boxes
   - Default timezone for unknown boxes
   - Timezone validation

3. **Error Parser:**
   - Using classTimeUTC with correct timezone
   - availableAt calculation accuracy

### Integration Tests

1. **End-to-End Booking:**
   - User books class crossing DST boundary
   - Verify classTimeUTC is correct
   - Verify availableAt is correct
   - Verify prebooking executes at correct time

2. **Cross-Timezone Booking:**
   - User in NYC books Madrid box
   - Verify class time uses Madrid timezone
   - Verify prebooking executes at correct Madrid time

### Manual Testing Scenarios

1. **DST Transition (Phase 1):**
   - Today: Oct 23, 2025 (UTC+2)
   - Book class: Oct 28, 2025 08:00 (should use UTC+1)
   - Expected availableAt: Oct 24, 2025 07:00 UTC
   - Verify: Prebooking shows "Se reservará en: X horas"

2. **Cross-Timezone (Phase 2):**
   - User location: New York (UTC-4)
   - Box location: Madrid (UTC+1)
   - Book class: Oct 28, 2025 08:00 Madrid time
   - Expected classTimeUTC: 2025-10-28T07:00:00.000Z
   - Verify: Prebooking uses Madrid time (not NYC time)

## Deployment Strategy

### Phase 1 Deployment

1. **Pre-deployment:**
   - Run all unit tests locally
   - Run integration tests locally
   - Verify no breaking changes

2. **Deployment:**
   - Deploy `timezone.utils.ts` changes
   - Deploy `timezone.utils.test.ts` changes
   - No database changes (safe)

3. **Post-deployment:**
   - Monitor application logs for timezone conversions
   - Test cross-DST booking scenario
   - Verify existing prebookings still work
   - Monitor for errors

4. **Rollback Plan:**
   - Revert `timezone.utils.ts` to previous version
   - No database rollback needed

### Phase 2 Deployment

1. **Pre-deployment:**
   - Run all unit tests locally
   - Run integration tests locally
   - Verify database migration locally
   - Backup production database

2. **Deployment:**
   - Run database migration (add timezone column)
   - Deploy model updates
   - Deploy service updates
   - Deploy frontend updates
   - Deploy backend updates

3. **Post-deployment:**
   - Verify all boxes have timezone set
   - Test cross-timezone booking
   - Monitor application logs
   - Verify existing functionality
   - Monitor for errors

4. **Rollback Plan:**
   - Rollback database migration (remove timezone column)
   - Rollback code changes
   - Restore from backup if needed

## Monitoring and Verification

### Log Monitoring

Monitor these logs after deployment:

1. **Phase 1:**
   ```
   [Timezone] Normalized date format
   [Timezone] Conversion details
   [BOOKING-FRONTEND] Converted class time
   [PreBooking] Using provided classTimeUTC
   ```

2. **Phase 2:**
   ```
   [BoxDetection] Using default timezone for
   [BoxService] Updated timezone for box
   [Timezone] Conversion with explicit timezone
   [BOOKING-BACKEND] Received booking request (with boxTimezone)
   ```

### Metrics to Track

1. **Prebooking Accuracy:**
   - Number of prebookings created
   - Number of prebookings executed on time
   - Number of prebookings executed late/early
   - Time difference (should be 0 after fix)

2. **Error Rates:**
   - Timezone conversion errors
   - Invalid date format errors
   - Invalid timezone errors

3. **User Impact:**
   - Number of cross-DST bookings
   - Number of cross-timezone bookings
   - User complaints about wrong times

## Risk Assessment

### Phase 1 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `fromZonedTime` still uses wrong offset | Low | High | Extensive unit tests, manual verification |
| Date normalization breaks existing formats | Low | Medium | Support both formats, extensive tests |
| Performance impact from logging | Low | Low | Use conditional logging, remove in production |
| Regression in existing functionality | Low | High | Comprehensive integration tests |

### Phase 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Database migration fails | Low | High | Test locally, backup database, rollback plan |
| Existing boxes have wrong timezone | Medium | Medium | Default to Madrid, manual correction if needed |
| Frontend/backend timezone mismatch | Low | High | Extensive validation, comprehensive tests |
| User confusion from timezone display | Low | Medium | Clear UI messaging, user timezone display |

## Success Criteria

### Phase 1 Success

- [ ] Cross-DST bookings use correct offset for class date
- [ ] `availableAt` times are accurate (±0 minutes)
- [ ] No regression in existing functionality
- [ ] Unit tests pass with 80%+ coverage
- [ ] Zero timezone-related errors in production logs

### Phase 2 Success

- [ ] Users in any timezone can book any box correctly
- [ ] Class times always use box timezone (not user timezone)
- [ ] Database has timezone for all boxes
- [ ] Cross-timezone bookings work correctly
- [ ] Unit tests pass with 80%+ coverage
- [ ] Zero timezone-related errors in production logs

## Questions for User

Before starting implementation, confirm:

1. **Phase Priority:**
   - Should we do Phase 1 only (quick fix)?
   - Or should we do both Phase 1 and Phase 2 (proper fix)?

2. **Timezone Scope:**
   - Are all boxes in Spain (Europe/Madrid)?
   - Or do you have boxes in other timezones?

3. **User Base:**
   - Do users ever book from different timezones?
   - Example: User in USA booking Spanish box?

4. **Testing:**
   - Can we test in production with your account?
   - Or do you prefer staging environment?

5. **Timeline:**
   - Is this urgent (need Phase 1 ASAP)?
   - Or can we take time for proper solution (Phase 2)?

## Notes

- **Current Fix in Place:** There was a previous attempt to fix this in `context_session_dst_availableat_bug.md` but it only addressed the date format issue partially
- **Root Cause Confirmed:** The bug is definitively the combination of date format + timezone source issues
- **User Requirement Clear:** "Book at box time, not user time" → must use box timezone
- **Recommended Approach:** Do both phases, but Phase 1 can be deployed immediately for quick relief

## Next Steps

1. Get user confirmation on approach (Phase 1 only vs both phases)
2. Get user answers to questions above
3. Begin Phase 1 implementation
4. Deploy Phase 1 to production
5. Verify Phase 1 success
6. Begin Phase 2 implementation (if approved)
7. Deploy Phase 2 to production
8. Verify Phase 2 success
9. Document final solution

## References

- Context Session: `.claude/sessions/context_session_dst_timezone_architecture.md`
- Previous Analysis: `.claude/sessions/context_session_dst_availableat_bug.md`
- Timezone Bug Timeline: `.claude/sessions/context_session_timezone_bug_diagnosis.md`
- date-fns-tz Documentation: https://date-fns.org/v2.29.3/docs/Time-Zones
- IANA Timezone Database: https://www.iana.org/time-zones
