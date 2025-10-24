# DST Local Time Bug - Visual Summary

## The Problem in Plain Terms

**User says:** "La clase es a las 08:00. La disponibilidad debería ser 4 días antes a las 08:00 también."

**System shows:** "La disponibilidad es a las 09:00" ❌

**Why?** The system maintains the same UTC hour across DST boundaries, but the LOCAL hour changes.

---

## Visual Timeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DST TRANSITION TIMELINE                        │
└─────────────────────────────────────────────────────────────────────┘

Oct 23 (HOY)              Oct 24 (Disponibilidad)    Oct 26-27          Oct 28 (Clase)
UTC+2 (Verano)            UTC+2 (Verano)              DST Change         UTC+1 (Invierno)
─────────────────────────────────────────────────────────────────────────────────────
                                                      🕐 Reloj
                                                      retrocede
                                                      1 hora
```

---

## What Happens NOW (WRONG)

```
┌──────────────────────────────────────────────────────────────────┐
│ CLASE (Oct 28)                                                   │
├──────────────────────────────────────────────────────────────────┤
│ Hora Madrid: 08:00                                               │
│ Offset:      UTC+1 (invierno)                                    │
│ Hora UTC:    07:00 ✅                                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    Backend calcula:
                    UTC - 4 días
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ DISPONIBILIDAD (Oct 24) - CALCULADO EN UTC                       │
├──────────────────────────────────────────────────────────────────┤
│ Hora UTC:    07:00 (misma hora UTC que la clase)                │
│ Offset:      UTC+2 (verano)                                      │
│ Hora Madrid: 09:00 ❌ (1 hora tarde!)                           │
└──────────────────────────────────────────────────────────────────┘

PROBLEMA: La hora UTC se mantiene (07:00), pero la hora local cambia (08:00 → 09:00)
```

---

## What SHOULD Happen (CORRECT)

```
┌──────────────────────────────────────────────────────────────────┐
│ CLASE (Oct 28)                                                   │
├──────────────────────────────────────────────────────────────────┤
│ Hora Madrid: 08:00 (hora del box)                                │
│ Offset:      UTC+1 (invierno)                                    │
│ Hora UTC:    07:00                                               │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    Backend calcula:
                    LOCAL - 4 días
                    (mantiene 08:00 Madrid)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ DISPONIBILIDAD (Oct 24) - CALCULADO EN HORA LOCAL                │
├──────────────────────────────────────────────────────────────────┤
│ Hora Madrid: 08:00 ✅ (misma hora local que la clase)           │
│ Offset:      UTC+2 (verano)                                      │
│ Hora UTC:    06:00 (diferente UTC, pero mismo LOCAL)            │
└──────────────────────────────────────────────────────────────────┘

SOLUCIÓN: La hora local se mantiene (08:00), la hora UTC se ajusta automáticamente
```

---

## Code Comparison

### BEFORE (Current - Wrong)

```typescript
// Backend: error-parser.utils.ts
const classDateUTC = new Date("2025-10-28T07:00:00.000Z"); // Oct 28, 08:00 Madrid (UTC+1)

// Subtract 4 days in UTC (maintains UTC hour)
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const availableAt = new Date(classDateUTC.getTime() - 4 * millisecondsPerDay);
// Result: "2025-10-24T07:00:00.000Z"
// Display: Oct 24, 09:00 Madrid ❌ (07:00 UTC = 09:00 Madrid with UTC+2)
```

**Problem:** Subtracts exactly 96 hours, which keeps UTC hour but changes local hour

### AFTER (Fixed - Correct)

```typescript
// Backend: error-parser.utils.ts
import { parseISO, sub } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const BOX_TIMEZONE = 'Europe/Madrid';

// Parse class time as LOCAL datetime
const classLocal = parseISO("2025-10-28T08:00:00"); // Oct 28, 08:00 (no timezone yet)

// Subtract 4 days in LOCAL time (maintains clock hour)
const availableLocal = sub(classLocal, { days: 4 });
// Result: "2025-10-24T08:00:00" (still 08:00 local)

// Convert to UTC using box timezone FOR THAT SPECIFIC DATE
const availableUTC = fromZonedTime(availableLocal, BOX_TIMEZONE);
// Oct 24 is UTC+2, so: 08:00 Madrid = 06:00 UTC ✅
// Result: "2025-10-24T06:00:00.000Z"
// Display: Oct 24, 08:00 Madrid ✅
```

**Solution:** Subtracts days in local time, then converts to UTC with correct offset

---

## Key Insight

```
┌────────────────────────────────────────────────────────────────────┐
│                    THE CORE PROBLEM                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  When you subtract time across DST boundaries:                    │
│                                                                    │
│  ❌ Subtracting UTC time = Same UTC hour, different LOCAL hour    │
│  ✅ Subtracting LOCAL time = Same LOCAL hour, different UTC hour  │
│                                                                    │
│  User requirement: "hora del box" = LOCAL hour must stay same     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Example Calculations

### Scenario 1: Oct 28 class at 08:00 (cross-DST)

| Date | Local Time | UTC Offset | UTC Time | Calculation |
|------|------------|------------|----------|-------------|
| **Oct 28 (Class)** | 08:00 Madrid | UTC+1 | 07:00 UTC | Class time |
| **Oct 24 (Available)** | 08:00 Madrid ✅ | UTC+2 | 06:00 UTC | 4 days before in LOCAL time |

**Result:** Prebooking at 08:00 Madrid (same local hour) ✅

### Scenario 2: July 15 class at 10:00 (no DST crossing)

| Date | Local Time | UTC Offset | UTC Time | Calculation |
|------|------------|------------|----------|-------------|
| **July 15 (Class)** | 10:00 Madrid | UTC+2 | 08:00 UTC | Class time |
| **July 11 (Available)** | 10:00 Madrid ✅ | UTC+2 | 08:00 UTC | 4 days before in LOCAL time |

**Result:** Prebooking at 10:00 Madrid (same local hour, same UTC hour) ✅

---

## The Fix in 3 Steps

### Step 1: Receive LOCAL time from frontend

```typescript
// Frontend sends
{
  classDay: "20251028",
  classTime: "08:00" // ← Local Madrid time as string
}
```

### Step 2: Calculate in LOCAL time

```typescript
// Backend calculates
const classLocal = parseISO("2025-10-28T08:00:00");
const availableLocal = sub(classLocal, { days: 4 });
// Result: "2025-10-24T08:00:00" (local time maintained)
```

### Step 3: Convert to UTC using box timezone

```typescript
// Backend converts
const availableUTC = fromZonedTime(availableLocal, 'Europe/Madrid');
// Oct 24 is UTC+2: 08:00 Madrid = 06:00 UTC
// Result: "2025-10-24T06:00:00.000Z"
```

---

## Why This Works

1. **Step 1 → Step 2:** Subtracting days in LOCAL time keeps clock hour the same
   - Oct 28, 08:00 → Oct 24, 08:00 ✅

2. **Step 2 → Step 3:** `fromZonedTime()` uses the SPECIFIC DATE's offset
   - Oct 28 (UTC+1): 08:00 Madrid = 07:00 UTC
   - Oct 24 (UTC+2): 08:00 Madrid = 06:00 UTC
   - Different UTC times, but same LOCAL time ✅

3. **Result:** Prebooking always executes at same LOCAL hour as class
   - User sees: "Se reservará en Oct 24, 08:00" ✅
   - System schedules: 2025-10-24T06:00:00.000Z
   - Execution: Oct 24 at 08:00 Madrid time ✅

---

## Files to Change (Phase 1)

### Backend
- `modules/prebooking/utils/error-parser.utils.ts` - Change calculation logic
- `app/api/booking/route.ts` - Accept classTime string instead of classTimeUTC

### Frontend
- `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` - Send classTime string
- `modules/booking/api/models/booking.api.ts` - Update API types

### Tests
- `modules/prebooking/utils/error-parser.utils.test.ts` - Add cross-DST test cases

---

## Testing Strategy

### Critical Test Case

```typescript
test('Oct 28 class at 08:00 should have Oct 24 availability at 08:00', () => {
  const result = parseEarlyBookingError(
    'No puedes reservar clases con más de 4 días de antelación',
    '20251028',
    '08:00'
  );

  // Class: Oct 28, 08:00 Madrid (UTC+1) = 07:00 UTC
  expect(result.classDate).toBe('2025-10-28T07:00:00.000Z');

  // Available: Oct 24, 08:00 Madrid (UTC+2) = 06:00 UTC
  expect(result.availableAt).toBe('2025-10-24T06:00:00.000Z');
});
```

---

## Success Criteria

✅ Prebooking executes at same LOCAL hour as class
✅ Works across DST boundaries (Oct 28 → Oct 24)
✅ Works within same DST period (July 15 → July 11)
✅ All test cases pass
✅ Production logs show correct calculation
✅ User sees correct time in UI

---

## Timeline

- **Phase 1 (Immediate Fix):** 1 day
  - Hardcode box timezone = 'Europe/Madrid'
  - Change backend calculation logic
  - Update frontend to send classTime string
  - Deploy to production

- **Phase 2 (Future):** 1 week (if needed)
  - Add timezone column to boxes table
  - Detect/store box timezone on creation
  - Support multiple timezones
  - Update frontend/backend to use box timezone

---

## Questions for User

Before proceeding, please confirm:

1. **Are all boxes in Spain (Madrid timezone)?**
   - Yes → Phase 1 sufficient
   - No → Need Phase 2 for multi-timezone

2. **Is this urgent?**
   - Yes → Deploy Phase 1 immediately
   - No → Can plan both phases together

3. **Should we proceed with Phase 1?**
   - Recommended: Yes (quick fix, no breaking changes)

---

**Next:** Review implementation plan at `.claude/doc/dst_local_time_fix/nextjs_architect.md`
