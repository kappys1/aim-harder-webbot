# Next.js Architecture Plan: My Prebookings Page

## Executive Summary

This document provides the Next.js-specific architecture recommendations for implementing the "My Prebookings" page in your CrossFit booking application. Based on analysis of your existing codebase patterns, I've designed an approach that leverages Next.js 14+ features while maintaining consistency with your established architecture.

## Architecture Recommendations

### 1. Routing Structure

**Recommendation: Use `/my-prebookings` as a top-level route within the `(app)` group**

**File Structure:**
```
app/(app)/my-prebookings/
├── page.tsx                    # Server Component - Entry point
└── loading.tsx                 # Optional: Loading UI (Suspense fallback)
```

**Rationale:**
- Follows your existing pattern (`/booking`, `/dashboard` are top-level routes)
- "My Prebookings" is a primary user feature, not a nested resource
- Keeps navigation simple and direct
- Aligns with the Header navigation pattern (we'll add a navigation link)

**Alternative Considered and Rejected:**
- `/booking/prebookings` - Too nested; prebookings are separate from the booking calendar
- `/dashboard/prebookings` - Dashboard is for box selection, not a parent route

### 2. Server vs Client Component Split

**Server Component Strategy:**

```typescript
// app/(app)/my-prebookings/page.tsx (Server Component)
import { Metadata } from 'next';
import { MyPrebookingsContainer } from '@/modules/prebooking/pods/my-prebookings/my-prebookings.container';

export const metadata: Metadata = {
  title: 'Mis Pre-reservas - CrossFit Cerdanyola',
  description: 'Gestiona tus pre-reservas pendientes',
};

export default function MyPrebookingsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <MyPrebookingsContainer />
    </main>
  );
}
```

**Container Component (Server Component):**

```typescript
// modules/prebooking/pods/my-prebookings/my-prebookings.container.tsx
import React from 'react';
import { cookies } from 'next/headers';
import { MyPrebookingsComponent } from './my-prebookings.component';

export async function MyPrebookingsContainer() {
  // Server-side: Extract user email from cookies or auth
  // This ensures we have user context on initial render
  const cookieStore = await cookies();

  // Note: You might need to extract userEmail from your auth system
  // For now, following your pattern of using localStorage on client

  return (
    <MyPrebookingsComponent />
  );
}
```

**Client Component (UI & Interactions):**

```typescript
// modules/prebooking/pods/my-prebookings/my-prebookings.component.tsx
"use client";

import { useMyPrebookings } from './hooks/useMyPrebookings.hook';
import { PrebookingCard } from './components/PrebookingCard.component';
// ... rest of component
```

**Split Responsibilities:**

| Component | Type | Purpose |
|-----------|------|---------|
| `page.tsx` | Server | Page entry, metadata, layout wrapper |
| `my-prebookings.container.tsx` | Server | Auth validation, initial data setup |
| `my-prebookings.component.tsx` | Client | UI rendering, interactions, real-time updates |
| Sub-components | Client | Cards, dialogs, countdown timers |

**Why This Split?**
- **Server Components** handle authentication and initial setup
- **Client Components** handle all user interactions and real-time features
- Follows your existing pattern from `BookingDashboardContainer` and `BookingDashboardComponent`
- Optimizes bundle size (server logic stays on server)

### 3. Data Fetching Pattern

**Recommendation: Client-side data fetching with React Query (via custom hook)**

**Pattern:**
```typescript
// Client-side data fetching in useMyPrebookings.hook.tsx
export function useMyPrebookings(userEmail?: string) {
  // Use fetch API to call /api/prebooking
  // Implement optimistic updates for deletions
  // Auto-refresh with React Query's refetch intervals
}
```

**Why NOT Server Component Data Fetching?**
1. **Real-time Requirements**: Prebookings need real-time countdown timers
2. **Frequent Updates**: Users need to see status changes without page refresh
3. **Optimistic Updates**: Cancel operations should update UI immediately
4. **Existing Pattern**: Your `usePreBooking.hook.tsx` already implements this pattern
5. **Better UX**: Loading states and mutations are easier with client-side fetching

**Data Flow:**
```
Initial Load:
Server Component → Client Component → useMyPrebookings → /api/prebooking (GET) → Display

User Cancels:
User Action → useMyPrebookings.cancelPrebooking → /api/prebooking?id=xxx (DELETE) → Optimistic Update → Refetch
```

**React Query Setup:**
```typescript
// hooks/useMyPrebookings.hook.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useMyPrebookings(userEmail?: string) {
  const queryClient = useQueryClient();

  // Fetch prebookings
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['prebookings', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/prebooking?user_email=${userEmail}`);
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 60000, // Auto-refetch every 60 seconds
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (prebookingId: string) => {
      const response = await fetch(`/api/prebooking?id=${prebookingId}`, {
        method: 'DELETE',
      });
      return response.json();
    },
    onMutate: async (prebookingId) => {
      // Optimistic update
      await queryClient.cancelQueries(['prebookings', userEmail]);
      const previous = queryClient.getQueryData(['prebookings', userEmail]);

      queryClient.setQueryData(['prebookings', userEmail], (old: any) => ({
        ...old,
        prebookings: old.prebookings.filter((pb: any) => pb.id !== prebookingId)
      }));

      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['prebookings', userEmail], context?.previous);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries(['prebookings', userEmail]);
    },
  });

  return {
    prebookings: data?.prebookings || [],
    isLoading,
    error,
    refetch,
    cancelPrebooking: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
  };
}
```

### 4. API Routes vs Server Actions

**Recommendation: Reuse existing API routes (DO NOT create new routes)**

**Existing API Routes to Use:**
```typescript
// Already exists: app/api/prebooking/route.ts

GET /api/prebooking?user_email={email}     // List user's prebookings
DELETE /api/prebooking?id={id}             // Cancel a prebooking
```

**Why Reuse Existing Routes?**
1. **DRY Principle**: Routes already exist and work
2. **Tested**: Already being used in `booking-dashboard.component.tsx`
3. **Complete**: Handle QStash cancellation, validation, error handling
4. **No Duplication**: Creating new routes would violate DRY

**Why NOT Server Actions?**
1. **Existing Architecture**: Your app uses API routes consistently
2. **Client-side Pattern**: Your hooks already fetch from API routes
3. **CORS**: API routes already handle CORS headers
4. **Consistency**: Mixing patterns would add complexity

**Integration:**
```typescript
// Your existing API route is perfect - no changes needed!
// GET /api/prebooking - Already returns user's pending prebookings
// DELETE /api/prebooking - Already handles cancellation + QStash cleanup
```

### 5. Next.js 14+ Specific Optimizations

**A. Metadata API (SEO)**
```typescript
// app/(app)/my-prebookings/page.tsx
export const metadata: Metadata = {
  title: 'Mis Pre-reservas - CrossFit Cerdanyola',
  description: 'Gestiona tus pre-reservas pendientes de CrossFit',
  openGraph: {
    title: 'Mis Pre-reservas',
    description: 'Gestiona tus pre-reservas pendientes',
  },
};
```

**B. Loading UI with Suspense**
```typescript
// app/(app)/my-prebookings/loading.tsx
export default function Loading() {
  return <MyPrebookingsLoadingSkeleton />;
}
```

**C. Error Boundary**
```typescript
// app/(app)/my-prebookings/error.tsx (Optional)
'use client';

export default function Error({ error, reset }: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="error-state">
      <h2>Error al cargar pre-reservas</h2>
      <button onClick={reset}>Reintentar</button>
    </div>
  );
}
```

**D. Route Segment Config**
```typescript
// app/(app)/my-prebookings/page.tsx
export const dynamic = 'force-dynamic'; // Always fetch fresh data
export const revalidate = 0; // Disable ISR caching
```

**E. Performance Optimizations**
```typescript
// Use dynamic imports for heavy components
const CancelDialog = dynamic(() =>
  import('./components/CancelDialog.component').then(mod => mod.CancelDialog)
);

// Optimize countdown timers to prevent excessive re-renders
const CountdownTimer = memo(({ targetDate }: Props) => {
  // Your existing useCountdown hook with optimization
});
```

## Module Structure Implementation

### Complete File Tree

```
modules/prebooking/
├── pods/
│   └── my-prebookings/
│       ├── my-prebookings.container.tsx      # Server Component
│       ├── my-prebookings.component.tsx      # Client Component
│       ├── my-prebookings.test.tsx           # Tests
│       ├── components/
│       │   ├── PrebookingCard.component.tsx  # Individual card (client)
│       │   ├── CancelDialog.component.tsx    # Confirmation dialog (client)
│       │   ├── EmptyState.component.tsx      # No prebookings state
│       │   └── LoadingSkeleton.component.tsx # Loading state
│       ├── hooks/
│       │   └── useMyPrebookings.hook.tsx     # Business logic hook
│       └── models/
│           └── my-prebookings.types.ts       # Local types if needed
```

### Shared Component Reuse

**REUSE These Existing Components:**
```typescript
// From modules/prebooking/pods/prebooking/
import { useCountdown } from '@/modules/prebooking/pods/prebooking/hooks/useCountdown.hook';
import { PreBookingBadge } from '@/modules/prebooking/pods/prebooking/components/PreBookingBadge.component';

// From common/
import { Card, CardContent, CardHeader, CardTitle } from '@/common/ui/card';
import { Button } from '@/common/ui/button';
import { AlertDialog } from '@/common/ui/alert-dialog';
```

**DO NOT Create New:**
- Countdown hook (already exists)
- Badge component (already exists)
- UI primitives (use shadcn components)

## Implementation Code Examples

### 1. Page Component (Server)

```typescript
// app/(app)/my-prebookings/page.tsx
import { Metadata } from 'next';
import { MyPrebookingsContainer } from '@/modules/prebooking/pods/my-prebookings/my-prebookings.container';

export const metadata: Metadata = {
  title: 'Mis Pre-reservas - CrossFit Cerdanyola',
  description: 'Gestiona tus pre-reservas pendientes',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MyPrebookingsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <MyPrebookingsContainer />
    </main>
  );
}
```

### 2. Container Component (Server)

```typescript
// modules/prebooking/pods/my-prebookings/my-prebookings.container.tsx
import React from 'react';
import { MyPrebookingsComponent } from './my-prebookings.component';

export async function MyPrebookingsContainer() {
  // Server component - could validate auth here if needed
  // For now, following your pattern of client-side email retrieval

  return <MyPrebookingsComponent />;
}
```

### 3. Client Component (Main UI)

```typescript
// modules/prebooking/pods/my-prebookings/my-prebookings.component.tsx
"use client";

import { useMyPrebookings } from './hooks/useMyPrebookings.hook';
import { PrebookingCard } from './components/PrebookingCard.component';
import { EmptyState } from './components/EmptyState.component';
import { LoadingSkeleton } from './components/LoadingSkeleton.component';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/common/ui/button';
import { Card, CardContent } from '@/common/ui/card';

export function MyPrebookingsComponent() {
  // Get user email from localStorage (following your existing pattern)
  const userEmail = typeof window !== 'undefined'
    ? localStorage.getItem('user-email')
    : null;

  const {
    prebookings,
    isLoading,
    error,
    refetch,
    cancelPrebooking,
    isCancelling,
  } = useMyPrebookings(userEmail || undefined);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Mis Pre-reservas</h1>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    Error al cargar pre-reservas
                  </p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="text-red-600 border-red-200 hover:bg-red-100"
                >
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Empty state
  if (!prebookings || prebookings.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Mis Pre-reservas</h1>
          <EmptyState />
        </div>
      </div>
    );
  }

  // Success state - List of prebookings
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mis Pre-reservas</h1>
            <p className="text-muted-foreground mt-1">
              {prebookings.length} {prebookings.length === 1 ? 'pre-reserva pendiente' : 'pre-reservas pendientes'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Actualizar
          </Button>
        </div>

        {/* Prebookings Grid */}
        <div className="space-y-4">
          {prebookings.map((prebooking) => (
            <PrebookingCard
              key={prebooking.id}
              prebooking={prebooking}
              onCancel={cancelPrebooking}
              isCancelling={isCancelling}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4. Business Hook (Client)

```typescript
// modules/prebooking/pods/my-prebookings/hooks/useMyPrebookings.hook.tsx
"use client";

import { useCallback, useEffect, useState } from 'react';
import { PreBooking } from '@/modules/prebooking/models/prebooking.model';
import { toast } from 'sonner';

interface UseMyPrebookingsResult {
  prebookings: PreBooking[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  cancelPrebooking: (id: string) => Promise<void>;
  isCancelling: boolean;
}

export function useMyPrebookings(userEmail?: string): UseMyPrebookingsResult {
  const [prebookings, setPrebookings] = useState<PreBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrebookings = useCallback(async () => {
    if (!userEmail) {
      setPrebookings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/prebooking?user_email=${encodeURIComponent(userEmail)}`,
        {
          headers: {
            'x-user-email': userEmail,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch prebookings');
      }

      // Map API response to PreBooking model
      const mappedPrebookings: PreBooking[] = data.prebookings.map(
        (pb: any) => ({
          id: pb.id,
          userEmail: userEmail,
          bookingData: pb.bookingData,
          availableAt: new Date(pb.availableAt),
          status: pb.status,
          result: pb.result
            ? {
                ...pb.result,
                executedAt: new Date(pb.result.executedAt),
              }
            : undefined,
          errorMessage: pb.errorMessage,
          createdAt: new Date(pb.createdAt),
          executedAt: pb.executedAt ? new Date(pb.executedAt) : undefined,
        })
      );

      setPrebookings(mappedPrebookings);
    } catch (err) {
      console.error('[useMyPrebookings] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPrebookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  const cancelPrebooking = useCallback(
    async (id: string) => {
      setIsCancelling(true);
      setError(null);

      try {
        const response = await fetch(`/api/prebooking?id=${id}`, {
          method: 'DELETE',
          headers: {
            'x-user-email': userEmail || '',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to cancel prebooking');
        }

        toast.success('Pre-reserva cancelada exitosamente');

        // Refetch to update list
        await fetchPrebookings();
      } catch (err) {
        console.error('[useMyPrebookings] Cancel error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        toast.error(`Error al cancelar: ${errorMessage}`);
        throw err;
      } finally {
        setIsCancelling(false);
      }
    },
    [userEmail, fetchPrebookings]
  );

  // Fetch on mount and when userEmail changes
  useEffect(() => {
    fetchPrebookings();
  }, [fetchPrebookings]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!userEmail) return;

    const interval = setInterval(() => {
      fetchPrebookings();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [userEmail, fetchPrebookings]);

  return {
    prebookings,
    isLoading,
    error,
    refetch: fetchPrebookings,
    cancelPrebooking,
    isCancelling,
  };
}
```

### 5. Prebooking Card Component

```typescript
// modules/prebooking/pods/my-prebookings/components/PrebookingCard.component.tsx
"use client";

import { PreBooking } from '@/modules/prebooking/models/prebooking.model';
import { Card, CardContent } from '@/common/ui/card';
import { Button } from '@/common/ui/button';
import { useCountdown } from '@/modules/prebooking/pods/prebooking/hooks/useCountdown.hook';
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
import { Calendar, Clock, MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface PrebookingCardProps {
  prebooking: PreBooking;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}

export function PrebookingCard({
  prebooking,
  onCancel,
  isCancelling,
}: PrebookingCardProps) {
  const countdown = useCountdown(prebooking.availableAt);
  const [isOpen, setIsOpen] = useState(false);

  const handleCancel = async () => {
    try {
      await onCancel(prebooking.id);
      setIsOpen(false);
    } catch (error) {
      // Error already handled in hook
    }
  };

  // Format date for display
  const classDate = new Date(prebooking.bookingData.day);
  const formattedClassDate = classDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formattedAvailableAt = prebooking.availableAt.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Class Info */}
          <div className="flex-1 space-y-3">
            {/* Class Name/Time - Extract from bookingData if available */}
            <div>
              <h3 className="font-semibold text-lg">
                Clase del {formattedClassDate}
              </h3>
              {prebooking.bookingData.classTime && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Clock className="w-4 h-4" />
                  {prebooking.bookingData.classTime}
                </p>
              )}
            </div>

            {/* Countdown Timer */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">
                Se reservará automáticamente en:
              </p>
              {countdown.isExpired ? (
                <p className="text-sm font-semibold text-blue-700">
                  Ejecutando pronto...
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-blue-700 font-mono">
                    {countdown.formatted}
                  </p>
                  <p className="text-xs text-blue-600">
                    {formattedAvailableAt}
                  </p>
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="text-xs text-muted-foreground">
              ID: {prebooking.bookingData.id}
            </div>
          </div>

          {/* Right: Cancel Button */}
          <div className="flex-shrink-0">
            <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isCancelling}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancelar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar pre-reserva?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. La pre-reserva será
                    eliminada y no se intentará reservar automáticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, mantener</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sí, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Navigation Integration

### Update Header Component

```typescript
// common/components/header/header.component.tsx
// Add navigation link to "Mis Pre-reservas"

<nav className="hidden md:flex items-center gap-6">
  <Link
    href="/dashboard"
    className={`text-sm font-medium transition-colors hover:text-primary ${
      isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
    }`}
  >
    Dashboard
  </Link>
  <Link
    href="/booking"
    className={`text-sm font-medium transition-colors hover:text-primary ${
      isActive("/booking") ? "text-primary" : "text-muted-foreground"
    }`}
  >
    Reservas
  </Link>
  {/* NEW: Add My Prebookings link */}
  <Link
    href="/my-prebookings"
    className={`text-sm font-medium transition-colors hover:text-primary ${
      isActive("/my-prebookings") ? "text-primary" : "text-muted-foreground"
    }`}
  >
    Mis Pre-reservas
  </Link>
</nav>

{/* Mobile Navigation - Add same link */}
<nav className="md:hidden flex items-center gap-4 mt-3 pt-3 border-t">
  {/* ... existing links ... */}
  <Link
    href="/my-prebookings"
    className={`text-sm font-medium transition-colors hover:text-primary ${
      isActive("/my-prebookings") ? "text-primary" : "text-muted-foreground"
    }`}
  >
    Pre-reservas
  </Link>
</nav>
```

## Performance Considerations

### 1. Real-time Updates Strategy

**Problem**: Countdown timers updating every second can cause performance issues

**Solution**:
```typescript
// Use React.memo to prevent unnecessary re-renders
const CountdownDisplay = memo(({ targetDate }: { targetDate: Date }) => {
  const countdown = useCountdown(targetDate);
  return <span>{countdown.formatted}</span>;
});

// In PrebookingCard, only countdown updates, not the whole card
```

### 2. List Virtualization (Optional)

**When to implement**: If users have > 20 prebookings

```typescript
// Use react-window for large lists
import { FixedSizeList } from 'react-window';

// Only render visible items in viewport
```

### 3. Bundle Size Optimization

```typescript
// Dynamic imports for dialogs
const CancelDialog = dynamic(() =>
  import('./components/CancelDialog.component').then(mod => mod.CancelDialog),
  { loading: () => <p>Loading...</p> }
);
```

## Answers to Your Questions

### 1. What's the best routing structure?

**Answer: `/my-prebookings` (top-level route in (app) group)**

- Simple, direct, follows your existing pattern
- Not nested under `/booking` or `/dashboard`
- Easy to add to navigation menu

### 2. How should I split Server vs Client components?

**Answer: Minimal Server Component wrapper, Client-heavy UI**

**Structure:**
- `page.tsx` (Server) → Entry point, metadata
- `my-prebookings.container.tsx` (Server) → Auth validation
- `my-prebookings.component.tsx` (Client) → All UI, interactions, timers
- Sub-components (Client) → Cards, dialogs, etc.

**Reasoning:**
- Real-time features require client components
- Countdown timers need useState/useEffect
- Cancel operations need optimistic updates
- Follows your existing `BookingDashboard` pattern

### 3. What data fetching pattern should I use?

**Answer: Client-side fetching with custom hook (like existing `usePreBooking`)**

**Pattern:**
```typescript
useMyPrebookings() → fetch('/api/prebooking') → optimistic updates
```

**Why NOT Server Component fetching:**
- Prebookings need real-time countdown updates
- User interactions (cancel) need immediate UI feedback
- Auto-refresh every 60 seconds is easier client-side
- Your existing pattern already does this

### 4. Should I create API routes or use Server Actions?

**Answer: REUSE existing API routes (`/api/prebooking`)**

**Existing routes are perfect:**
- `GET /api/prebooking?user_email={email}` - Already returns pending prebookings
- `DELETE /api/prebooking?id={id}` - Already handles cancellation + QStash cleanup

**DO NOT create new routes - violates DRY principle**

**Why not Server Actions:**
- Your app consistently uses API routes
- Existing hooks expect fetch() calls
- Changing pattern mid-project adds complexity

### 5. Any Next.js 14+ specific optimizations?

**Answer: Yes, several:**

**A. Metadata API**
```typescript
export const metadata: Metadata = {
  title: 'Mis Pre-reservas - CrossFit Cerdanyola',
  description: 'Gestiona tus pre-reservas pendientes',
};
```

**B. Route Segment Config**
```typescript
export const dynamic = 'force-dynamic'; // No static generation
export const revalidate = 0; // No ISR caching
```

**C. Loading UI (Suspense)**
```typescript
// app/(app)/my-prebookings/loading.tsx
export default function Loading() {
  return <LoadingSkeleton />;
}
```

**D. Error Boundary**
```typescript
// app/(app)/my-prebookings/error.tsx
'use client';
export default function Error({ error, reset }) {
  return <ErrorUI error={error} reset={reset} />;
}
```

**E. Performance**
- `React.memo` for countdown timers
- Dynamic imports for heavy components
- Optimistic UI updates for cancellations
- Auto-refetch with configurable interval (60s)

## Key Architectural Principles Applied

### 1. DRY (Don't Repeat Yourself)
- Reuse existing `useCountdown` hook
- Reuse existing API routes (`/api/prebooking`)
- Reuse existing `PreBooking` model
- Reuse shadcn UI components

### 2. YAGNI (You Aren't Gonna Need It)
- NO new API routes (existing ones work)
- NO complex state management (simple hooks suffice)
- NO virtualization (unless > 20 items)
- NO server-side data fetching (client-side is better here)

### 3. KISS (Keep It Simple)
- Simple route structure (`/my-prebookings`)
- Simple data flow (hook → fetch → render)
- Simple cancel operation (optimistic update)
- Simple navigation (just add link to header)

### 4. Consistency with Existing Patterns
- Follows `BookingDashboard` container/component split
- Uses same localStorage pattern for user email
- Uses same toast notifications (sonner)
- Uses same error handling patterns

## Mobile-First Considerations

### Responsive Design

```typescript
// Stack layout on mobile, cards on desktop
<div className="space-y-4">
  {/* Each card automatically stacks vertically */}
  <PrebookingCard ... />
</div>

// Touch-friendly buttons (min 44x44px)
<Button size="sm" className="min-h-[44px] min-w-[44px]">
  <Trash2 className="w-4 h-4" />
</Button>

// Responsive text sizes
<h1 className="text-2xl md:text-3xl font-bold">
  Mis Pre-reservas
</h1>
```

### Touch Interactions

```typescript
// Use AlertDialog instead of browser confirm()
// Provides better mobile UX with touch-friendly buttons
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button>Cancel</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    {/* Large touch targets */}
  </AlertDialogContent>
</AlertDialog>
```

## Testing Strategy

### Test Coverage Requirements (80%)

```typescript
// my-prebookings.test.tsx
describe('MyPrebookings', () => {
  describe('unit tests', () => {
    it('renders loading state initially', () => {});
    it('renders empty state when no prebookings', () => {});
    it('renders prebooking cards when data exists', () => {});
    it('shows error state on fetch failure', () => {});
  });

  describe('integration tests', () => {
    it('fetches prebookings on mount', () => {});
    it('cancels prebooking and updates list', () => {});
    it('shows confirmation dialog before cancel', () => {});
    it('handles cancel API errors', () => {});
    it('auto-refreshes every 60 seconds', () => {});
  });
});
```

## Implementation Checklist

### Phase 1: Core Structure
- [ ] Create `app/(app)/my-prebookings/page.tsx` (Server Component)
- [ ] Create `modules/prebooking/pods/my-prebookings/my-prebookings.container.tsx` (Server)
- [ ] Create `modules/prebooking/pods/my-prebookings/my-prebookings.component.tsx` (Client)
- [ ] Create `hooks/useMyPrebookings.hook.tsx` (Business logic)

### Phase 2: Sub-components
- [ ] Create `components/PrebookingCard.component.tsx`
- [ ] Create `components/EmptyState.component.tsx`
- [ ] Create `components/LoadingSkeleton.component.tsx`

### Phase 3: Integration
- [ ] Add navigation link to Header component
- [ ] Test API integration (`GET /api/prebooking`)
- [ ] Test cancel operation (`DELETE /api/prebooking`)
- [ ] Verify countdown timers work correctly

### Phase 4: Polish
- [ ] Add loading.tsx for Suspense
- [ ] Add error.tsx for error boundary (optional)
- [ ] Optimize performance (memo, dynamic imports)
- [ ] Test mobile responsive design

### Phase 5: Testing
- [ ] Write unit tests (80% coverage)
- [ ] Write integration tests
- [ ] Manual QA testing
- [ ] Mobile device testing

## Potential Gotchas & Solutions

### Issue 1: Countdown Timers Performance

**Problem**: 20 prebookings × 1 update/second = 20 re-renders/second

**Solution**:
```typescript
// Memoize countdown display
const CountdownDisplay = memo(({ targetDate }) => {
  const countdown = useCountdown(targetDate);
  return <span>{countdown.formatted}</span>;
});

// Use in PrebookingCard
<CountdownDisplay targetDate={prebooking.availableAt} />
```

### Issue 2: User Email Retrieval

**Problem**: `localStorage` only works client-side

**Solution**:
```typescript
// In MyPrebookingsComponent (client component)
const userEmail = typeof window !== 'undefined'
  ? localStorage.getItem('user-email')
  : null;

// Hook handles undefined gracefully
useMyPrebookings(userEmail || undefined);
```

### Issue 3: Stale Data After Cancel

**Problem**: List doesn't update after cancellation

**Solution**:
```typescript
// In cancelPrebooking hook
await onCancel(prebooking.id);
await refetch(); // Immediately refetch list
```

### Issue 4: Auto-refresh Interval Memory Leak

**Problem**: Interval not cleaned up on unmount

**Solution**:
```typescript
useEffect(() => {
  if (!userEmail) return;

  const interval = setInterval(fetchPrebookings, 60000);

  return () => clearInterval(interval); // Cleanup!
}, [userEmail, fetchPrebookings]);
```

## Summary

This architecture plan provides a complete Next.js 14+ implementation strategy for the "My Prebookings" page that:

1. **Follows your existing patterns** (BookingDashboard, usePreBooking)
2. **Reuses existing infrastructure** (API routes, models, hooks, components)
3. **Optimizes for performance** (memoization, dynamic imports, optimistic updates)
4. **Provides excellent UX** (real-time countdowns, instant feedback, mobile-first)
5. **Maintains clean code** (DRY, YAGNI, KISS principles)

The implementation is straightforward and builds on what you already have, requiring minimal new code while delivering maximum value to users.

## Next Steps

1. Review this plan with the team
2. Consult with `shadcn-ui-architect` for UI component details
3. Begin implementation following the checklist above
4. Update context session file with implementation progress
5. Submit to `qa-criteria-validator` for final review

---

**Document Version**: 1.0
**Created**: 2025-10-03
**Author**: nextjs-architect agent
**Status**: Ready for implementation
