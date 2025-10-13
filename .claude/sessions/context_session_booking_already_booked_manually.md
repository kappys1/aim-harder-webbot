# Session: Handle "Already Booked Manually" Case for BookState -12

## Context

When QStash executes an automatic prebooking and receives `bookState: -12` with the message **"No puedes hacer más de una reserva a la misma hora"**, it means the user already booked the class manually from the original AimHarder application. Previously, this was incorrectly marked as a failure.

## Problem

The system was treating two different scenarios with the same error code `-12`:
1. **"Too many days in advance"** - User trying to book too early → Should fail and create prebooking ✅
2. **"Already booked manually"** - User already reserved the class → Should be treated as success ❌ (was failing)

This led to:
- Prebookings incorrectly marked as "failed" when the booking goal was achieved
- Confusing UX showing failures when classes were actually booked
- Underestimated success metrics
- Misleading logs

## Implementation Summary

### Files Modified

#### 1. [booking.mapper.ts](modules/booking/api/mappers/booking.mapper.ts)
**Changes**:
- Added `alreadyBookedManually?: boolean` to return type of `mapBookingCreateResult()`
- Added new method `isAlreadyBookedManually()` to detect manual booking messages
- Updated logic to check for manual booking before treating as early_booking error
- When detected, returns `success: true` instead of `success: false`

**Key Logic**:
```typescript
// Check if user already booked manually before auto-booking
if (isEarlyBookingError && this.isAlreadyBookedManually(response.errorMssg)) {
  return {
    success: true, // Treat as success since the booking goal was achieved
    error: 'already_booked_manually',
    errorMessage: response.errorMssg,
    canRetryLater: false,
    alreadyBookedManually: true,
  };
}
```

**Detection Patterns**:
- `/no\s+puedes\s+hacer\s+más\s+de\s+una\s+reserva\s+a\s+la\s+misma\s+hora/i`
- `/ya\s+tienes\s+una\s+reserva\s+a\s+esa\s+hora/i`
- `/ya\s+has\s+reservado\s+a\s+esa\s+hora/i`

#### 2. [execute-prebooking/route.ts](app/api/execute-prebooking/route.ts)
**Changes**:
- Added `BookingMapper` import
- Changed success determination to use `mappedResult.success` instead of checking bookState directly
- Added logic to handle `alreadyBookedManually` flag in completion message
- Enhanced logging to differentiate manual booking case

**Before**:
```typescript
const success = bookingResponse.bookState === 1 || bookingResponse.id;
```

**After**:
```typescript
const mappedResult = BookingMapper.mapBookingCreateResult(bookingResponse);
const success = mappedResult.success;
```

#### 3. [prebooking.service.ts](modules/prebooking/api/services/prebooking.service.ts)
**Changes**:
- Added `alreadyBookedManually?: boolean` to `markCompleted()` method parameters
- Updated result object to include `alreadyBookedManually` field in database

#### 4. [booking.constants.ts](modules/booking/constants/booking.constants.ts)
**Changes**:
- Added comprehensive documentation for `ERROR_EARLY_BOOKING: -12` explaining it handles multiple cases
- Clarified that `BookingMapper.mapBookingCreateResult()` distinguishes between them

#### 5. [booking.mapper.test.ts](modules/booking/api/mappers/booking.mapper.test.ts)
**Changes**:
- Added new test suite `describe('already booked manually detection')`
- 6 new test cases covering:
  - ✅ Basic "misma hora" message detection as success
  - ✅ Case-insensitive message detection
  - ✅ Alternative message patterns ("ya tienes", "ya has reservado")
  - ✅ Ensures "días de antelación" still treated as failure
  - ✅ Unknown -12 messages default to early_booking

### Test Results

```
✓ modules/booking/api/mappers/booking.mapper.test.ts (39 tests) 7ms

Test Files  2 passed (2)
     Tests  53 passed (53)
```

All tests passing including 6 new tests for the "already booked manually" feature.

## How It Works

### Flow Diagram

```
QStash Webhook receives booking response
              ↓
bookState = -12?
              ↓
     YES                    NO
      ↓                      ↓
BookingMapper.mapBookingCreateResult()
      ↓
isAlreadyBookedManually(errorMssg)?
      ↓
  YES          NO
   ↓            ↓
success=true  success=false
   ↓            ↓
mark as      mark as
completed    failed
   ↓            ↓
User sees    Create
success     prebooking
```

### Example Scenarios

#### Scenario 1: User Books Manually First
1. User creates prebooking for Monday 7:00 AM
2. User manually books Monday 7:00 AM at 6:50 AM
3. QStash triggers at 7:00 AM
4. AimHarder returns: `bookState: -12, errorMssg: "No puedes hacer más de una reserva a la misma hora"`
5. **New behavior**: `mappedResult.success = true`, `alreadyBookedManually = true`
6. Prebooking marked as "completed" (not "failed")
7. User sees success message: "User already booked manually"

#### Scenario 2: Booking Too Early (Existing Behavior Preserved)
1. User tries to book class 5 days in advance (limit is 4)
2. AimHarder returns: `bookState: -12, errorMssg: "No puedes reservar clases con más de 4 días de antelación"`
3. **Preserved behavior**: `mappedResult.success = false`, `canRetryLater = true`
4. Prebooking created automatically for the correct time
5. System retries when booking window opens

## Benefits

### User Experience
✅ Correct status displayed when user books manually
✅ No confusing "failed" messages when class is actually booked
✅ Clear distinction between failure types

### Data Quality
✅ Accurate success/failure metrics
✅ Proper tracking of manual vs automatic bookings
✅ Better debugging with clear logs

### System Reliability
✅ No unnecessary retry attempts
✅ Preserved existing early_booking logic
✅ Extensible pattern matching for future messages

## Database Changes

The `prebookings` table's `result` JSONB column now includes:
```json
{
  "success": true,
  "bookState": -12,
  "message": "Booking already created manually by user",
  "alreadyBookedManually": true,
  "executedAt": "2025-10-13T..."
}
```

## Monitoring & Logging

New log patterns to look for:

**Success (Manual Booking)**:
```
[HYBRID {id}] ✅ SUCCESS (user booked manually) in 3250ms (fire latency: 2ms)
```

**Success (Auto Booking)**:
```
[HYBRID {id}] ✅ SUCCESS in 3250ms (fire latency: 2ms)
```

**Failure (Too Early)**:
```
[HYBRID {id}] ❌ FAILED in 3250ms (fire latency: 2ms): No puedes reservar clases con más de 4 días de antelación
```

## Future Enhancements

### Potential Improvements
1. **UI Badge**: Show "Booked Manually" badge in prebookings list
2. **Analytics**: Track percentage of manual vs automatic bookings
3. **Notification**: Different notification for manual bookings
4. **Auto-cancel**: Automatically cancel prebooking when manual booking detected earlier

### Additional Message Patterns
If AimHarder adds more messages for this case, simply add to the patterns array:
```typescript
const patterns = [
  /no\s+puedes\s+hacer\s+más\s+de\s+una\s+reserva\s+a\s+la\s+misma\s+hora/i,
  /ya\s+tienes\s+una\s+reserva\s+a\s+esa\s+hora/i,
  /ya\s+has\s+reservado\s+a\s+esa\s+hora/i,
  // Add new patterns here
];
```

## Documentation

Full analysis and technical details:
- [ANALYSIS.md](.claude/doc/booking_error_-12_already_booked/ANALYSIS.md)

## Acceptance Criteria

### Backend
- [x] When bookState=-12 and errorMssg contains "misma hora", mark prebooking as `completed`
- [x] When bookState=-12 and errorMssg contains "días de antelación", keep as `failed`
- [x] Add `alreadyBookedManually` field to prebooking result
- [x] Logs clearly differentiate both cases

### Testing
- [x] Unit test for "already booked manually" detection (6 test cases)
- [x] Unit test preserves "días de antelación" behavior
- [x] All existing tests still pass (53/53 tests passing)

### Code Quality
- [x] Type-safe with TypeScript
- [x] Well-documented with JSDoc comments
- [x] Clean separation of concerns
- [x] No breaking changes to existing functionality

## Conclusion

This implementation successfully distinguishes between two different error scenarios that share the same error code (-12), treating manual bookings as successes while preserving the existing early booking logic. The solution is:

- ✅ **Non-breaking**: All existing functionality preserved
- ✅ **Tested**: 6 new tests, all passing
- ✅ **Documented**: Clear comments and documentation
- ✅ **Extensible**: Easy to add more message patterns
- ✅ **Type-safe**: Full TypeScript support
