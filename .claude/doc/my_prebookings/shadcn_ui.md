# UI/UX Implementation Plan: My Prebookings Page (Mobile-First)

## Executive Summary

This document provides a comprehensive UI/UX implementation plan for the "My Prebookings" feature with a **mobile-first design approach**. The design prioritizes touch-friendly interactions, vertical scrolling, and optimized mobile viewport usage while maintaining desktop compatibility.

---

## 1. Component Selection & Architecture

### 1.1 Primary Components (shadcn/ui)

#### **Card Component** ✅ RECOMMENDED
- **File**: `common/ui/card.tsx` (already exists in project)
- **Usage**: Each prebooking item will be a Card
- **Why**: Cards provide excellent mobile-first structure with built-in padding, rounded corners, and clear visual separation
- **Mobile Benefits**:
  - Natural touch targets
  - Clear visual hierarchy
  - Easy to scan vertically
  - Supports complex content layouts

**Implementation Pattern**:
```tsx
<Card className="w-full">
  <CardHeader className="pb-3">
    {/* Activity name + Status badge */}
  </CardHeader>
  <CardContent className="pb-3">
    {/* Date, Time, Countdown */}
  </CardContent>
  <CardFooter className="pt-3">
    {/* Cancel button */}
  </CardFooter>
</Card>
```

#### **AlertDialog Component** ✅ RECOMMENDED (over Dialog)
- **Why AlertDialog over Dialog**:
  - Specifically designed for confirmation actions
  - Better semantic meaning (confirms destructive action)
  - Built-in accessibility for critical decisions
  - Mobile-optimized with proper focus management
  - Prevents accidental dismissal (no outside click to close)

**Usage**: Cancel confirmation
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Cancelar</Button>
  </AlertDialogTrigger>
  <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
    <AlertDialogHeader>
      <AlertDialogTitle>¿Cancelar prereserva?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta acción no se puede deshacer. La prereserva para "{activityName}"
        será eliminada permanentemente.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
      <AlertDialogCancel className="w-full sm:w-auto">
        No, mantener
      </AlertDialogCancel>
      <AlertDialogAction
        className="w-full sm:w-auto bg-destructive text-destructive-foreground"
        onClick={handleCancel}
      >
        Sí, cancelar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

#### **Badge Component** ✅ RECOMMENDED
- **File**: Need to install/verify `common/ui/badge.tsx`
- **Usage**:
  1. Status indicator (pending, loaded, executing, etc.)
  2. Countdown timer display
- **Variants to use**:
  - `default`: For active/pending status
  - `secondary`: For countdown timer
  - `destructive`: For error states
  - `outline`: For neutral states

**Implementation Pattern**:
```tsx
{/* Status Badge */}
<Badge variant="default" className="bg-blue-100 text-blue-700">
  <Clock className="w-3 h-3 mr-1" />
  Prereserva activa
</Badge>

{/* Countdown Badge */}
<Badge variant="secondary" className="font-mono tabular-nums">
  En 2h 45m
</Badge>
```

#### **Skeleton Component** ✅ RECOMMENDED
- **File**: Need to install/verify `common/ui/skeleton.tsx`
- **Usage**: Loading states for prebooking cards
- **Pattern**: Mimics the card structure

**Implementation**:
```tsx
function PrebookingCardSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
```

#### **Button Component** ✅ ALREADY EXISTS
- **File**: `common/ui/button.tsx`
- **Variants to use**:
  - `destructive`: Cancel button (primary action)
  - `ghost`: Secondary actions if needed
- **Mobile sizing**: Ensure minimum 44x44px touch target

#### **Scroll Area Component** (Optional Enhancement)
- **When to use**: If list becomes very long (10+ items)
- **Mobile consideration**: Native scrolling is usually better on mobile
- **Recommendation**: Use native scrolling with `overflow-y-auto` instead

---

## 2. Layout Structure & Responsive Design

### 2.1 Page Layout (Mobile-First)

```tsx
{/* Mobile: Full width, padding on sides */}
<div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
  <header className="space-y-2">
    <h1 className="text-2xl font-bold tracking-tight">
      Mis Pre-reservas
    </h1>
    <p className="text-sm text-muted-foreground">
      Gestiona tus reservas programadas
    </p>
  </header>

  {/* List of prebookings */}
  <div className="space-y-3">
    {prebookings.map((prebooking) => (
      <PrebookingCard key={prebooking.id} prebooking={prebooking} />
    ))}
  </div>
</div>
```

### 2.2 Individual Card Layout

```tsx
<Card className="w-full hover:shadow-md transition-shadow">
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between gap-2">
      {/* Activity name - wraps on mobile */}
      <h3 className="text-base font-semibold leading-tight line-clamp-2 flex-1">
        {prebooking.bookingData.activityName}
      </h3>

      {/* Status badge - stays on same line */}
      <Badge variant="default" className="shrink-0">
        <Clock className="w-3 h-3 mr-1" />
        Activa
      </Badge>
    </div>
  </CardHeader>

  <CardContent className="pb-3 space-y-3">
    {/* Date & Time */}
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CalendarIcon className="w-4 h-4 shrink-0" />
      <time dateTime={isoDate} className="tabular-nums">
        {formattedDateTime}
      </time>
    </div>

    {/* Countdown Timer - Prominent Display */}
    <div className="flex items-center gap-2">
      <TimerIcon className="w-4 h-4 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Se ejecutará en:</p>
        <p className="text-lg font-bold font-mono tabular-nums text-primary">
          {countdown.formatted}
        </p>
      </div>
    </div>
  </CardContent>

  <CardFooter className="pt-3">
    {/* Full-width cancel button on mobile */}
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className="w-full min-h-[44px]"
          size="default"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Cancelar Prereserva
        </Button>
      </AlertDialogTrigger>
      {/* Dialog content here */}
    </AlertDialog>
  </CardFooter>
</Card>
```

---

## 3. Empty State Design

### 3.1 When No Prebookings Exist

```tsx
<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
  {/* Icon */}
  <div className="rounded-full bg-muted p-6 mb-4">
    <CalendarX2 className="w-12 h-12 text-muted-foreground" />
  </div>

  {/* Title */}
  <h3 className="text-lg font-semibold mb-2">
    No tienes prereservas activas
  </h3>

  {/* Description */}
  <p className="text-sm text-muted-foreground mb-6 max-w-sm">
    Cuando configures una prereserva automática, aparecerá aquí y podrás
    gestionarla fácilmente.
  </p>

  {/* Optional CTA */}
  <Button asChild variant="default">
    <Link href="/schedule">
      <Plus className="w-4 h-4 mr-2" />
      Ir a Horarios
    </Link>
  </Button>
</div>
```

### 3.2 Icon Recommendation
- **Component**: `CalendarX2`, `ClipboardX`, or `CalendarOff` from `lucide-react`
- **Already in project**: Project uses lucide-react (seen in PreBookingBadge)

---

## 4. Mobile-Specific Interactions

### 4.1 Touch-Friendly Design Rules

**Minimum Touch Target Sizes**:
- Buttons: `min-h-[44px]` (44px minimum)
- Interactive cards: Minimum 48px height
- Spacing between cards: `space-y-3` (12px) minimum

**Implementation**:
```tsx
<Button
  variant="destructive"
  className="w-full min-h-[44px] text-base"
  size="default"
>
  Cancelar Prereserva
</Button>
```

### 4.2 Swipe-to-Delete (Optional Enhancement)

**Recommendation**: **DO NOT IMPLEMENT initially**
- Adds complexity
- Not standard web pattern (more native app)
- AlertDialog already provides safe confirmation
- Can be added later if user feedback requests it

**If needed later**, use libraries like:
- `framer-motion` (for gesture detection)
- Custom implementation with touch events

### 4.3 Pull-to-Refresh (Optional Enhancement)

**Recommendation**: **IMPLEMENT via React Query**
- Use React Query's `refetch` on pull-down gesture
- Native-like experience
- Already fits with your data fetching strategy

```tsx
// In your hook
const { data, isLoading, refetch } = useQuery({
  queryKey: ['my-prebookings'],
  queryFn: fetchMyPrebookings,
  refetchInterval: 30000, // Auto-refresh every 30s
});
```

---

## 5. Loading States Strategy

### 5.1 Initial Page Load

```tsx
function MyPrebookingsPage() {
  const { data, isLoading } = useMyPrebookings();

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        <header className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <PrebookingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Render actual content
}
```

### 5.2 Optimistic Update on Cancel

```tsx
const cancelMutation = useMutation({
  mutationFn: cancelPrebooking,
  onMutate: async (prebookingId) => {
    // Cancel refetch
    await queryClient.cancelQueries(['my-prebookings']);

    // Snapshot previous value
    const previous = queryClient.getQueryData(['my-prebookings']);

    // Optimistically update
    queryClient.setQueryData(['my-prebookings'], (old) =>
      old?.filter((p) => p.id !== prebookingId)
    );

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['my-prebookings'], context.previous);
    toast.error('No se pudo cancelar la prereserva');
  },
  onSuccess: () => {
    toast.success('Prereserva cancelada exitosamente');
  },
});
```

### 5.3 Button Loading State

```tsx
<Button
  variant="destructive"
  className="w-full min-h-[44px]"
  disabled={isCancelling}
>
  {isCancelling ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Cancelando...
    </>
  ) : (
    <>
      <XCircle className="w-4 h-4 mr-2" />
      Cancelar Prereserva
    </>
  )}
</Button>
```

---

## 6. Real-Time Countdown Timer Implementation

### 6.1 Reuse Existing Hook

Your project already has `useCountdown.hook.tsx` (used in PreBookingBadge). **REUSE THIS**.

```tsx
// From PreBookingBadge.component.tsx
import { useCountdown } from '../hooks/useCountdown.hook';

function PrebookingCard({ prebooking }) {
  const countdown = useCountdown(prebooking.availableAt);

  return (
    <Card>
      {/* ... */}
      <div className="text-lg font-bold font-mono tabular-nums text-primary">
        {countdown.isExpired ? (
          <span className="text-amber-600">Ejecutando...</span>
        ) : (
          countdown.formatted
        )}
      </div>
    </Card>
  );
}
```

### 6.2 Countdown Display Pattern

**Large, Prominent Timer** (mobile-first):
```tsx
{/* Mobile: Large countdown */}
<div className="bg-muted/50 rounded-lg p-3 border border-border">
  <p className="text-xs text-muted-foreground mb-1">Se ejecutará en:</p>
  <p className="text-2xl sm:text-xl font-bold font-mono tabular-nums text-primary">
    {countdown.formatted}
  </p>
</div>
```

### 6.3 Auto-Remove on Expiry (Optional)

```tsx
useEffect(() => {
  if (countdown.isExpired && prebooking.status === 'pending') {
    // Optionally refetch to get updated status
    refetch();
  }
}, [countdown.isExpired, prebooking.status]);
```

---

## 7. Color Scheme & Theming

### 7.1 Using Project Colors (from globals.css)

Your project uses **oklch color space** with CSS variables. Here's the mapping:

**Status Colors** (following PreBookingBadge pattern):

| Status | Background | Text | Border | Icon |
|--------|-----------|------|--------|------|
| `pending` | `bg-blue-100 dark:bg-blue-950/30` | `text-blue-700 dark:text-blue-400` | `border-blue-200 dark:border-blue-800` | `Clock` |
| `loaded` | `bg-amber-100 dark:bg-amber-950/30` | `text-amber-700 dark:text-amber-400` | `border-amber-200 dark:border-amber-800` | `Loader2` (spin) |
| `executing` | `bg-purple-100 dark:bg-purple-950/30` | `text-purple-700 dark:text-purple-400` | `border-purple-200 dark:border-purple-800` | `Loader2` (spin) |
| `completed` | `bg-green-100 dark:bg-green-950/30` | `text-green-700 dark:text-green-400` | `border-green-200 dark:border-green-800` | `CheckCircle2` |
| `failed` | `bg-red-100 dark:bg-red-950/30` | `text-red-700 dark:text-red-400` | `border-red-200 dark:border-red-800` | `XCircle` |

**Countdown Timer**: Use `text-primary` (already in CSS variables)

**Destructive Actions**: Use `variant="destructive"` (uses `--destructive` variable)

### 7.2 Dark Mode Compatibility

All components should automatically work with dark mode via CSS variables. Test both modes.

```tsx
{/* Example: Card that works in both modes */}
<Card className="bg-card text-card-foreground border-border">
  {/* Content */}
</Card>
```

---

## 8. Component File Structure

```
modules/prebooking/pods/my-prebookings/
├── MyPrebookings.container.tsx        # Server Component (data fetching)
├── MyPrebookings.component.tsx        # Client Component (UI)
├── components/
│   ├── PrebookingCard.component.tsx   # Individual card
│   ├── PrebookingCardSkeleton.component.tsx
│   ├── CancelDialog.component.tsx     # Extracted AlertDialog
│   ├── EmptyState.component.tsx       # No prebookings state
│   └── CountdownDisplay.component.tsx # Reusable countdown UI
├── hooks/
│   ├── useMyPrebookings.hook.tsx      # React Query hook
│   └── useCancelPrebooking.hook.tsx   # Cancel mutation hook
└── my-prebookings.types.ts            # TypeScript types
```

---

## 9. Accessibility Checklist

### 9.1 ARIA Labels & Semantic HTML

```tsx
<Card role="article" aria-labelledby={`prebooking-${id}-title`}>
  <CardHeader>
    <h3 id={`prebooking-${id}-title`} className="text-base font-semibold">
      {activityName}
    </h3>
  </CardHeader>

  <CardContent>
    <time dateTime={isoDate} aria-label={`Fecha: ${readableDate}`}>
      {formattedDate}
    </time>

    <div role="timer" aria-live="polite" aria-atomic="true">
      <span className="sr-only">Tiempo restante:</span>
      {countdown.formatted}
    </div>
  </CardContent>

  <CardFooter>
    <Button
      variant="destructive"
      aria-label={`Cancelar prereserva para ${activityName}`}
    >
      Cancelar Prereserva
    </Button>
  </CardFooter>
</Card>
```

### 9.2 Focus Management

- AlertDialog automatically manages focus (built-in)
- Ensure focus returns to trigger button after dialog close
- Test keyboard navigation (Tab, Enter, Escape)

### 9.3 Screen Reader Support

```tsx
{/* Loading state */}
<div role="status" aria-live="polite" aria-busy={isLoading}>
  {isLoading ? (
    <>
      <span className="sr-only">Cargando prereservas...</span>
      <PrebookingCardSkeleton />
    </>
  ) : (
    <PrebookingList />
  )}
</div>
```

---

## 10. Performance Optimizations

### 10.1 React Query Configuration

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,        // 30 seconds
      cacheTime: 300000,       // 5 minutes
      refetchOnWindowFocus: true,
      refetchInterval: 30000,  // Auto-refresh every 30s
    },
  },
});
```

### 10.2 Memoization

```tsx
// Memoize countdown calculations
const PrebookingCard = React.memo(({ prebooking }) => {
  const countdown = useCountdown(prebooking.availableAt);

  return (
    <Card>{/* ... */}</Card>
  );
}, (prev, next) => {
  // Only re-render if prebooking data changes
  return prev.prebooking.id === next.prebooking.id &&
         prev.prebooking.status === next.prebooking.status;
});
```

### 10.3 Lazy Loading Components

```tsx
const CancelDialog = lazy(() => import('./components/CancelDialog.component'));

<Suspense fallback={<div>...</div>}>
  <CancelDialog {...props} />
</Suspense>
```

---

## 11. Animation & Transitions

### 11.1 Card Hover Effects

```tsx
<Card className="w-full transition-all duration-200 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]">
  {/* Content */}
</Card>
```

### 11.2 List Enter/Exit Animations (Optional)

Use `framer-motion` if you want smooth list animations:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence mode="popLayout">
  {prebookings.map((prebooking) => (
    <motion.div
      key={prebooking.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      layout
    >
      <PrebookingCard prebooking={prebooking} />
    </motion.div>
  ))}
</AnimatePresence>
```

**Recommendation**: Start without animations, add only if needed for polish.

---

## 12. Toast Notifications

### 12.1 Using Sonner (shadcn/ui recommended)

Install if not present:
```bash
npx shadcn@latest add sonner
```

Usage:
```tsx
import { toast } from 'sonner';

// Success
toast.success('Prereserva cancelada exitosamente', {
  description: `${activityName} ha sido removida`,
});

// Error
toast.error('No se pudo cancelar la prereserva', {
  description: error.message,
  action: {
    label: 'Reintentar',
    onClick: () => retry(),
  },
});

// Loading
const toastId = toast.loading('Cancelando prereserva...');
// Later:
toast.success('Cancelada', { id: toastId });
```

### 12.2 Toast Position (Mobile)

```tsx
<Toaster
  position="top-center"  // Better for mobile
  expand={true}
  richColors
/>
```

---

## 13. Responsive Breakpoints

### 13.1 Tailwind Breakpoints Strategy

```tsx
{/* Mobile-first approach */}
<div className="
  px-4 sm:px-6 lg:px-8           /* Padding */
  space-y-3 sm:space-y-4         /* Card spacing */
  text-base sm:text-sm           /* Text size */
">
  <Card className="
    w-full
    hover:shadow-md sm:hover:shadow-lg  /* Desktop gets bigger shadow */
  ">
    <CardHeader className="pb-3 sm:pb-4">
      <h3 className="text-base sm:text-lg">  {/* Larger on desktop */}
        {activityName}
      </h3>
    </CardHeader>

    <CardFooter className="
      flex-col sm:flex-row          /* Stack on mobile, row on desktop */
      gap-2 sm:gap-3
    ">
      <Button className="w-full sm:w-auto">
        Cancelar
      </Button>
    </CardFooter>
  </Card>
</div>
```

### 13.2 Container Max Width

```tsx
{/* Optimal reading width */}
<div className="container max-w-2xl mx-auto">
  {/* Content */}
</div>
```

---

## 14. Implementation Priority & Phases

### Phase 1: Core UI (MVP) ✅
1. Basic card layout with Card component
2. Status badge using existing PreBookingBadge logic
3. Countdown timer using existing useCountdown hook
4. AlertDialog for cancel confirmation
5. Button with proper mobile sizing
6. Empty state component

### Phase 2: UX Polish ✨
1. Skeleton loading states
2. Optimistic updates
3. Toast notifications (Sonner)
4. Hover/active states
5. Dark mode testing

### Phase 3: Performance ⚡
1. React Query optimization
2. Memoization where needed
3. Auto-refresh every 30s
4. Debounced actions

### Phase 4: Nice-to-Haves 🎁
1. Pull-to-refresh
2. List animations (framer-motion)
3. Swipe-to-delete (if user feedback requests)
4. Advanced filtering/sorting

---

## 15. Questions for Clarification

Before implementation, please clarify:

### 15.1 Data & Business Logic
1. **Should canceled prebookings disappear immediately or show "Cancelled" state first?**
   - Recommendation: Optimistic removal (disappear immediately)

2. **What happens if cancellation fails?**
   - Show error toast and restore to list?
   - Show error state on the card itself?

3. **Should we show completed/failed prebookings in this list, or only pending?**
   - Recommendation: Only pending (active management page)
   - Could add filter tabs later: "Activas | Historial"

### 15.2 UI/UX Preferences
1. **Preferred countdown format?**
   - Current in PreBookingBadge: "2h 45m 30s"
   - Alternative: "En 2 horas"
   - Alternative: "2:45:30"

2. **Should cards be collapsible to save space on mobile?**
   - Recommendation: No, keep simple list view

3. **Navigation: Should this be a full page or a modal/drawer?**
   - Current plan: Full page route `/my-prebookings`
   - Alternative: Drawer from main navigation

### 15.3 Technical
1. **Auto-refresh interval?**
   - Recommendation: 30 seconds (balance between real-time and performance)

2. **Maximum prebookings to show?**
   - Pagination if > 20?
   - Infinite scroll?
   - Recommendation: Show all (unlikely to have many simultaneous)

---

## 16. Component Installation Checklist

Before implementation, ensure these shadcn/ui components are installed:

```bash
# Check if these exist in common/ui/
# If not, install them:

npx shadcn@latest add card          # ✅ Already exists
npx shadcn@latest add button        # ✅ Already exists
npx shadcn@latest add alert-dialog  # ❓ Verify
npx shadcn@latest add badge         # ❓ Verify
npx shadcn@latest add skeleton      # ❓ Verify
npx shadcn@latest add sonner        # ❓ For toasts
```

---

## 17. Mobile Testing Checklist

After implementation, test on:

### 17.1 Devices
- [ ] iPhone SE (375px width) - smallest modern mobile
- [ ] iPhone 12/13/14 (390px width)
- [ ] iPhone Pro Max (428px width)
- [ ] Android medium (360px width)
- [ ] Tablet (768px width)

### 17.2 Interactions
- [ ] All buttons are tappable (44px minimum)
- [ ] Scrolling is smooth
- [ ] AlertDialog is readable and buttons are accessible
- [ ] Text is readable without zooming
- [ ] No horizontal scrolling
- [ ] Cards don't overflow
- [ ] Countdown updates in real-time

### 17.3 Accessibility
- [ ] Screen reader can read all content
- [ ] Keyboard navigation works
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1 for text)

---

## 18. Code Examples Repository

### 18.1 Complete PrebookingCard Component Example

```tsx
'use client';

import { PreBooking } from '@/modules/prebooking/models/prebooking.model';
import { Card, CardHeader, CardContent, CardFooter } from '@/common/ui/card';
import { Badge } from '@/common/ui/badge';
import { Button } from '@/common/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/common/ui/alert-dialog';
import { useCountdown } from '@/modules/prebooking/hooks/useCountdown.hook';
import { Clock, Calendar, Timer, XCircle } from 'lucide-react';
import { useState } from 'react';

interface PrebookingCardProps {
  prebooking: PreBooking;
  onCancel: (id: string) => Promise<void>;
}

export function PrebookingCard({ prebooking, onCancel }: PrebookingCardProps) {
  const countdown = useCountdown(prebooking.availableAt);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel(prebooking.id);
    } catch (error) {
      // Error handled by parent
      setIsCancelling(false);
    }
  };

  const formattedDate = prebooking.availableAt.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card
      className="w-full transition-shadow hover:shadow-md"
      role="article"
      aria-labelledby={`prebooking-${prebooking.id}-title`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            id={`prebooking-${prebooking.id}-title`}
            className="text-base font-semibold leading-tight line-clamp-2 flex-1"
          >
            {prebooking.bookingData.activityName}
          </h3>

          <Badge
            variant="default"
            className="shrink-0 bg-blue-100 text-blue-700 border-blue-200"
          >
            <Clock className="w-3 h-3 mr-1" />
            Activa
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 shrink-0" />
          <time
            dateTime={prebooking.availableAt.toISOString()}
            className="tabular-nums"
          >
            {formattedDate}
          </time>
        </div>

        {/* Countdown Timer */}
        <div className="bg-muted/50 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="w-4 h-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              Se ejecutará en:
            </p>
          </div>
          <p
            className="text-2xl font-bold font-mono tabular-nums text-primary"
            role="timer"
            aria-live="polite"
          >
            {countdown.isExpired ? (
              <span className="text-amber-600">Ejecutando...</span>
            ) : (
              countdown.formatted
            )}
          </p>
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full min-h-[44px]"
              disabled={isCancelling}
              aria-label={`Cancelar prereserva para ${prebooking.bookingData.activityName}`}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar Prereserva
                </>
              )}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Cancelar prereserva?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La prereserva para
                <strong> "{prebooking.bookingData.activityName}"</strong> será
                eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">
                No, mantener
              </AlertDialogCancel>
              <AlertDialogAction
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleCancel}
              >
                Sí, cancelar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
```

---

## 19. Final Recommendations

### DO's ✅
1. **Start simple**: Implement MVP first (Card + AlertDialog + Badge)
2. **Reuse existing code**: useCountdown hook, PreBookingBadge logic, color schemes
3. **Mobile-first**: Design for 375px width first, then scale up
4. **Touch-friendly**: Minimum 44px buttons, adequate spacing
5. **Use AlertDialog**: Better than Dialog for confirmations
6. **Optimize with React Query**: Auto-refresh, optimistic updates
7. **Test accessibility**: Screen readers, keyboard navigation
8. **Use CSS variables**: Respect existing color system

### DON'Ts ❌
1. **Don't over-engineer**: Avoid complex animations initially
2. **Don't implement swipe-to-delete** (yet): Can add later if needed
3. **Don't create custom components**: Use shadcn/ui components
4. **Don't ignore loading states**: Always show skeletons
5. **Don't forget dark mode**: Test both light and dark themes
6. **Don't hardcode colors**: Use CSS variables from globals.css
7. **Don't skip accessibility**: ARIA labels, semantic HTML required

---

## 20. Next Steps After Reading This Doc

1. **Verify component installations**: Check which shadcn components need installing
2. **Answer clarification questions** (Section 15)
3. **Review with nextjs-architect agent**: Confirm routing and data fetching strategy
4. **Begin Phase 1 implementation**: Start with basic Card layout
5. **Test on real mobile device**: As early as possible
6. **Iterate based on feedback**: Use qa-criteria-validator and ui-ux-analyzer agents

---

## Summary

This plan provides a **complete, mobile-first UI/UX implementation** for the My Prebookings page using shadcn/ui components. The design prioritizes:

- **Touch-friendly interactions** (44px minimum buttons)
- **Clear visual hierarchy** (Card-based layout)
- **Real-time updates** (countdown timers, auto-refresh)
- **Safe actions** (AlertDialog confirmations)
- **Accessibility** (ARIA labels, semantic HTML, keyboard navigation)
- **Performance** (React Query, optimistic updates, memoization)
- **Consistent theming** (Using project's oklch color system)

All components follow your project's existing patterns and architecture conventions.
