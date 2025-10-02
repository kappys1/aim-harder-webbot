# Session Context: My Prebookings Section

## Feature Request
Create a dedicated section "Mis Pre-reservas" where users can:
- View all their pending prebookings
- See countdown timer for each prebooking
- Cancel prebookings directly without navigating to the specific day
- **Mobile-first design approach**

## Initial Analysis

### Existing Infrastructure
1. **PreBooking Service** (`modules/prebooking/api/services/prebooking.service.ts`):
   - `findByUser(userEmail)`: Returns pending prebookings for user
   - `delete(id)`: Cancels a prebooking
   - `countPendingByUser(userEmail)`: Counts pending prebookings

2. **PreBooking Model** (`modules/prebooking/models/prebooking.model.ts`):
   - Status types: pending, loaded, executing, completed, failed
   - Contains: id, userEmail, bookingData, availableAt, status, result, errorMessage, timestamps

3. **Existing API Endpoints to Reuse**:
   - GET user prebookings: Will use `preBookingService.findByUser()`
   - DELETE prebooking: Will use `preBookingService.delete()`
   - Cancel QStash schedule when deleting

4. **Existing Components**:
   - `PreBookingBadge.component.tsx`: Shows prebooking indicator
   - `usePreBooking.hook.tsx`: Hook for prebooking operations

## Implementation Plan

### Phase 1: Agent Consultation ✅ COMPLETED
- [x] Consult with nextjs-architect - Recommendations received
- [x] Consult with shadcn-ui-architect - Recommendations received
- [x] Update plan based on agent feedback

### Phase 2: Backend & API Layer ✅ COMPLETED (Reused Existing)
- [x] ~~Create new API routes~~ **NOT NEEDED**
- [x] Reuse existing `/api/prebooking` routes:
  - GET `/api/prebooking?user_email={email}` - List prebookings
  - DELETE `/api/prebooking?id={id}` - Cancel prebooking + QStash schedule

### Phase 3: Frontend Implementation ✅ COMPLETED
- [x] Install AlertDialog component from shadcn/ui
- [x] Create directory structure: `modules/prebooking/pods/my-prebookings/`
- [x] Create page: `app/(app)/my-prebookings/page.tsx`
- [x] Create container: `my-prebookings.container.tsx`
- [x] Create main component: `my-prebookings.component.tsx`
- [x] Create hook: `hooks/useMyPrebookings.hook.tsx`
- [x] Create components:
  - `components/PrebookingCard.component.tsx` (with AlertDialog)
  - `components/EmptyState.component.tsx`
  - `components/PrebookingListSkeleton.tsx`
- [x] Add navigation links in Header (desktop + mobile)

### Phase 4: Testing & Validation ⏳ PENDING
- [ ] Test with qa-criteria-validator agent
- [ ] Test with ui-ux-analyzer agent
- [ ] Implement feedback and iterate

## Mobile-First Design Requirements
- Touch-friendly buttons (min 44x44px)
- Swipe-to-delete gesture (optional enhancement)
- Responsive card layout
- Large, readable text
- Clear visual hierarchy
- Optimized for vertical scrolling
- Loading skeletons for better UX

## Technical Considerations

### Data to Display (Per Prebooking)
- Class/Activity name (from `bookingData.activityName`)
- Date and time (from `availableAt`)
- Countdown timer (real-time)
- Status badge
- Cancel button with confirmation

### Real-time Features
- Use React Query for automatic refetching
- Update list immediately after cancellation
- Optimistic updates for better UX
- Show toast notifications

## Implementation Summary

### Files Created
1. **Page & Container**:
   - `app/(app)/my-prebookings/page.tsx` - Next.js route with metadata
   - `modules/prebooking/pods/my-prebookings/my-prebookings.container.tsx` - Server Component wrapper

2. **Main Component**:
   - `modules/prebooking/pods/my-prebookings/my-prebookings.component.tsx` - Client Component with:
     - User authentication via `useAuth` hook
     - Data fetching and mutations via `useMyPrebookings` hook
     - Loading, error, and empty states
     - Refresh functionality

3. **Hook**:
   - `modules/prebooking/pods/my-prebookings/hooks/useMyPrebookings.hook.tsx` - React Query hook:
     - Fetches prebookings from `/api/prebooking?user_email={email}`
     - Cancel mutation with DELETE `/api/prebooking?id={id}`
     - Auto-refetch every 60 seconds
     - Optimistic updates on cancel
     - Toast notifications

4. **UI Components**:
   - `PrebookingCard.component.tsx` - Mobile-first card with:
     - Activity name, date/time, location
     - Real-time countdown using `useCountdown` hook
     - Status badge with color coding
     - Cancel button with AlertDialog confirmation
     - Touch-friendly (min 44x44px buttons)
   - `EmptyState.component.tsx` - No prebookings state
   - `PrebookingListSkeleton.tsx` - Loading skeletons

5. **Navigation**:
   - Updated `common/components/header/header.component.tsx`
   - Added "Mis Pre-reservas" link in desktop navigation
   - Added "Pre-reservas" link in mobile navigation

### Components Reused
- ✅ `useCountdown.hook.tsx` - Countdown timer logic
- ✅ `/api/prebooking` routes - GET and DELETE endpoints
- ✅ AlertDialog from shadcn/ui (newly installed)
- ✅ Card, Badge, Button, Skeleton from shadcn/ui

### Mobile-First Implementation
- Touch-friendly buttons (44x44px minimum)
- Responsive card layout (`max-w-2xl`)
- Stacked vertical layout on mobile
- AlertDialog for confirmations (not browser confirm)
- Color-coded countdown (red <5min, orange <30min, blue default)
- Accessible with ARIA labels

### Next Steps
1. Start dev server and test functionality
2. Run qa-criteria-validator for acceptance testing
3. Run ui-ux-analyzer for UI/UX review
4. Iterate based on feedback

---

## Next.js Architect Recommendations

**Status**: ✅ COMPLETED (2025-10-03)
**Documentation**: `.claude/doc/my_prebookings/nextjs_architect.md`

### Key Recommendations Summary

#### 1. Routing Structure
- **Route**: `/my-prebookings` (top-level in (app) group)
- **Files**: `app/(app)/my-prebookings/page.tsx`
- **Rationale**: Follows existing pattern, simple, direct access

#### 2. Server vs Client Component Split
```
page.tsx (Server)
  ↓
my-prebookings.container.tsx (Server)
  ↓
my-prebookings.component.tsx (Client) ← Main UI, all interactions
  ↓
PrebookingCard.component.tsx (Client)
EmptyState.component.tsx (Client)
LoadingSkeleton.component.tsx (Client)
```

**Key Decision**: Client-heavy architecture
- Real-time countdown timers require client state
- Optimistic updates for better UX
- Follows BookingDashboard pattern

#### 3. Data Fetching Pattern
- **Strategy**: Client-side fetching with custom hook
- **Hook**: `useMyPrebookings()` (similar to existing `usePreBooking`)
- **API**: Reuse existing `/api/prebooking` routes
- **Features**:
  - Auto-refetch every 60 seconds
  - Optimistic updates on cancel
  - Toast notifications for feedback

#### 4. API Routes Decision
- **DO NOT create new routes** ✅
- **REUSE existing routes**:
  - `GET /api/prebooking?user_email={email}` - List prebookings
  - `DELETE /api/prebooking?id={id}` - Cancel prebooking
- **Rationale**: DRY principle, routes already complete with QStash cancellation

#### 5. Next.js 14+ Optimizations
- Metadata API for SEO
- `loading.tsx` for Suspense fallback
- `error.tsx` for error boundary (optional)
- Route segment config: `dynamic = 'force-dynamic'`
- React.memo for countdown timer optimization
- Dynamic imports for heavy components

#### 6. Component Reuse Strategy
**REUSE these existing components:**
- `useCountdown.hook.tsx` - Already perfect for timers
- `PreBookingBadge.component.tsx` - For status display (if needed)
- All shadcn/ui components (Card, Button, AlertDialog, etc.)

**DO NOT create:**
- New countdown hook (already exists)
- New API routes (already exist)
- New badge component (already exists)

### Updated Implementation Plan

#### Phase 2: Backend & API Layer
- [x] ~~Create API route: `app/api/my-prebookings/route.ts`~~ **NOT NEEDED - Reuse existing `/api/prebooking`**
- [x] API infrastructure complete (no changes needed)

#### Phase 3: Frontend Implementation
**Structure:**
```
modules/prebooking/pods/my-prebookings/
├── my-prebookings.container.tsx      # Server Component
├── my-prebookings.component.tsx      # Client Component (main UI)
├── my-prebookings.test.tsx           # Tests
├── components/
│   ├── PrebookingCard.component.tsx  # Individual card
│   ├── EmptyState.component.tsx      # No prebookings state
│   └── LoadingSkeleton.component.tsx # Loading state
├── hooks/
│   └── useMyPrebookings.hook.tsx     # Business logic
└── models/
    └── my-prebookings.types.ts       # Local types (if needed)
```

**Page structure:**
```
app/(app)/my-prebookings/
├── page.tsx                          # Server Component entry
└── loading.tsx                       # Optional: Suspense fallback
```

**Navigation:**
- Add link to `common/components/header/header.component.tsx`
- Desktop and mobile navigation sections

### Architecture Principles Applied

1. **DRY**: Reuse existing API routes, hooks, components
2. **YAGNI**: No new API routes, no complex state management
3. **KISS**: Simple routing, simple data flow, simple cancellation
4. **Consistency**: Follows BookingDashboard pattern exactly

### Performance Optimizations

1. **Countdown Timer Performance**:
   - Use `React.memo` to prevent card re-renders
   - Only countdown display updates, not entire card

2. **Auto-refresh Strategy**:
   - 60-second interval (configurable)
   - Cleanup interval on unmount
   - Disable when userEmail is null

3. **Optimistic Updates**:
   - Remove from list immediately on cancel
   - Rollback if API call fails
   - Show loading state during operation

### Mobile-First Implementation

```typescript
// Touch-friendly buttons
<Button className="min-h-[44px] min-w-[44px]">Cancel</Button>

// Responsive layout
<div className="space-y-4"> {/* Stacks vertically on mobile */}
  <PrebookingCard />
</div>

// AlertDialog instead of browser confirm()
<AlertDialog>
  <AlertDialogTrigger>Cancel</AlertDialogTrigger>
  <AlertDialogContent>{/* Touch-friendly */}</AlertDialogContent>
</AlertDialog>
```

### Next Steps

1. ✅ Next.js architecture defined
2. ⏳ Pending: Consult shadcn-ui-architect for:
   - Specific UI component choices
   - Empty state design
   - Loading skeleton design
   - Card layout details
3. ⏳ Pending: Implementation
4. ⏳ Pending: QA validation

### Key Files to Reference

- **Architecture Plan**: `.claude/doc/my_prebookings/nextjs_architect.md`
- **Existing Patterns**:
  - `modules/booking/pods/booking-dashboard/` (similar structure)
  - `modules/prebooking/pods/prebooking/hooks/usePreBooking.hook.tsx` (similar hook)
  - `modules/prebooking/pods/prebooking/hooks/useCountdown.hook.tsx` (reuse)
  - `app/api/prebooking/route.ts` (existing API)

### Important Notes

- **NO new API routes needed** - existing routes are perfect
- **Client-heavy architecture** - required for real-time features
- **Reuse countdown hook** - already implemented and tested
- **Follow BookingDashboard pattern** - proven architecture
- **Mobile-first responsive design** - touch targets, stacking layout
