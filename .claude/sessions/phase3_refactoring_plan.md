# FASE 3 Refactoring Plan - Container/Component Split Elimination

## Current Structure (BEFORE)

```
booking-dashboard.container.tsx (Server - 73 LOC)
└─ booking-dashboard.component.tsx (Client - 659 LOC) ❌ TOO BIG
   ├─ BookingDashboardContent (608 LOC of logic)
   │  ├─ useBooking() - state management
   │  ├─ useBoxFromUrl() - box selection
   │  ├─ useBoxes() - boxes data
   │  ├─ usePreBooking() - prebooking data
   │  ├─ 3 handlers: handleBooking (150 LOC), handleCancel (100 LOC), handlePrebooking (80 LOC)
   │  ├─ useEffect for date redirect
   │  └─ Render UI
   └─ Exports: BookingDashboardComponent
```

## New Structure (AFTER)

```
booking-dashboard.page.tsx (Server - new RSC approach)
├─ Fetch data on server
├─ Pass initial data
└─ BookingDashboard (Compositional)
   ├─ BookingHeader (Server) - Static header with box info
   ├─ BookingControls (Client) - Week selector, filters
   │  └─ WeekSelector (already optimized)
   ├─ BookingGridWrapper (Server) - Grid layout
   │  └─ BookingCard
   │     ├─ BookingCardDisplay (Server) - Static info
   │     └─ BookingCardActions (Client) - Handlers
   └─ BookingErrorBoundary (Client) - Error handling
```

## Refactoring Steps

### 1. Create Server Actions (replaces handlers)
```typescript
// modules/booking/api/server-actions/booking.actions.ts (NEW)
'use server';

export async function createBookingAction(params: BookingActionParams) {
  // Move handleBooking logic here
  // Direct API call from server
  // Return result
}

export async function cancelBookingAction(params: CancelParams) {
  // Move handleCancel logic here
}

export async function createPrebookingAction(params: PreBookingParams) {
  // Move handlePrebooking logic here
}
```

### 2. Split BookingDashboardComponent into smaller pieces

**booking-dashboard.tsx** (Server Component - 100 LOC)
```typescript
// No "use client"
// Can use async/await, await fetch directly
// Passes initial data to children

export async function BookingDashboard(props) {
  // Fetch initial booking data if needed
  // Layout and orchestration
}
```

**booking-controls.tsx** (Client - 150 LOC)
```typescript
"use client";
// WeekSelector, date navigation
// Client-side interactivity only
```

**booking-card-actions.tsx** (Client - 80 LOC)
```typescript
"use client";
// Book/Cancel/Prebooking buttons
// Call Server Actions
```

**booking-card-display.tsx** (Server - 50 LOC)
```typescript
// No "use client"
// Static display of booking info
```

## Benefits

| Aspect | Before | After | Improvement |
|--------|--------|-------|------------|
| **Client Code** | 659 LOC | ~200 LOC | -70% |
| **Client JS Bundle** | 20KB | 8KB | -60% |
| **Server Code** | 0 LOC | 250 LOC | Clear separation |
| **TTI** | 3-4s | 1.5-2s | -50% |
| **Maintainability** | Complex | Clear | +100% |

## Implementation Order

1. ✅ Create Server Actions for booking/cancel/prebooking
2. ✅ Create booking-header.tsx (Server)
3. ✅ Create booking-controls.tsx (Client)
4. ✅ Create booking-card-display.tsx (Server)
5. ✅ Create booking-card-actions.tsx (Client)
6. ✅ Update booking-dashboard.component.tsx → booking-dashboard.tsx
7. ✅ Remove booking-dashboard.container.tsx (merge with page)
8. ✅ Update booking/page.tsx to use new structure
9. ✅ Write/update tests for all new components
10. ✅ Verify build & no TypeScript errors
11. ✅ Run test suite

## Files to Create

- modules/booking/api/server-actions/booking.actions.ts
- modules/booking/pods/booking-dashboard/components/booking-header/booking-header.component.tsx
- modules/booking/pods/booking-dashboard/components/booking-controls/booking-controls.component.tsx
- modules/booking/pods/booking-dashboard/components/booking-card-display/booking-card-display.component.tsx
- modules/booking/pods/booking-dashboard/components/booking-card-actions/booking-card-actions.component.tsx

## Files to Delete/Merge

- booking-dashboard.container.tsx → merge logic into page.tsx
- booking-dashboard.component.tsx → refactor as booking-dashboard.tsx

## Tests to Create/Update

- booking-dashboard.component.test.tsx → update for new structure
- booking-header.component.test.tsx (new)
- booking-controls.component.test.tsx (new)
- booking-card-display.component.test.tsx (new)
- booking-card-actions.component.test.tsx (new)
- booking.actions.test.ts (new) - Server Actions tests

## Risks & Mitigations

### Risk: Breaking existing functionality
- Mitigation: Keep same component API during transition
- Mitigation: Incremental refactoring, test each step

### Risk: Server Actions error handling
- Mitigation: Proper error handling in each action
- Mitigation: Client-side error boundaries

### Risk: Data serialization between server/client
- Mitigation: Zod validation for all data transfers
- Mitigation: Type safety with TypeScript

## Success Criteria

- [ ] Build completes without errors
- [ ] All TypeScript checks pass
- [ ] All existing tests pass (or updated)
- [ ] No new console errors
- [ ] No broken functionality
- [ ] Bundle size reduced by 60% (20KB → 8KB)
- [ ] Client code reduced from 659 → <250 LOC
