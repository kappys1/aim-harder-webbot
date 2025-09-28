# Next.js CrossFit Booking System Implementation Strategy

## Executive Summary

This document outlines the comprehensive implementation strategy for a CrossFit booking system following Next.js best practices and the project's established feature-based architecture. The implementation focuses on performance, type safety, and maintainable code patterns.

## 1. Next.js Architecture Strategy

### 1.1 Server vs Client Components

**Server Components (Data Fetching Layer)**
```typescript
// modules/booking/pods/booking-dashboard/booking-dashboard.container.tsx
import { BookingDashboardComponent } from "./booking-dashboard.component";
import { getInitialBookingData } from "@/modules/booking/api/services/booking.service";

interface BookingDashboardContainerProps {
  boxId: string;
  date: string;
}

export async function BookingDashboardContainer({
  boxId,
  date
}: BookingDashboardContainerProps) {
  // Server-side data fetching with cookie forwarding
  const initialBookings = await getInitialBookingData(boxId, date);

  return (
    <BookingDashboardComponent
      initialData={initialBookings}
      boxId={boxId}
      selectedDate={date}
    />
  );
}
```

**Client Components (Interactive UI Layer)**
```typescript
// modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx
"use client";

import { useBooking } from "./hooks/useBooking.hook";
import { BookingData } from "./models/booking.model";

interface BookingDashboardComponentProps {
  initialData: BookingData;
  boxId: string;
  selectedDate: string;
}

export function BookingDashboardComponent({
  initialData,
  boxId,
  selectedDate
}: BookingDashboardComponentProps) {
  const {
    bookings,
    isLoading,
    refreshBookings,
    handleBookingAction
  } = useBooking({
    initialData,
    boxId,
    selectedDate
  });

  return (
    <div className="booking-dashboard">
      {/* Interactive booking interface */}
    </div>
  );
}
```

### 1.2 Data Fetching Patterns

**API Route Strategy**
- Use Next.js API routes as proxy to handle subdomain calls
- Implement cookie forwarding and authentication middleware
- Add request caching and error handling

```typescript
// app/api/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/modules/booking/api/services/booking.service';
import { forwardAimharderCookies } from '@/modules/auth/api/services/cookie.service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const boxId = searchParams.get('box');
  const day = searchParams.get('day');
  const familyId = searchParams.get('familyId');

  if (!boxId || !day) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    // Forward authentication cookies to subdomain
    const cookieHeader = forwardAimharderCookies(request);

    const bookings = await bookingService.fetchBookings({
      boxId,
      day,
      familyId,
      cookieHeader
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Booking API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
```

### 1.3 Cookie Handling for Subdomain Authentication

**Cookie Forwarding Service**
```typescript
// modules/booking/api/services/cookie-forwarding.service.ts
import { authService } from '@/modules/auth/api/services/auth.service';

export class CookieForwardingService {
  static forwardToSubdomain(request: Request): Record<string, string> {
    const aimharderCookies = authService.getAimharderCookies();

    return {
      'Cookie': Object.entries(aimharderCookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    };
  }

  static validateCookieAuth(): boolean {
    const requiredCookies = ['PHPSESSID', 'amhrdrauth'];
    const availableCookies = authService.getAimharderCookies();

    return requiredCookies.every(cookie =>
      availableCookies[cookie] && availableCookies[cookie].length > 0
    );
  }
}
```

### 1.4 Route Structure

**Proposed Route Architecture**
```
app/
├── dashboard/
│   └── page.tsx                    # Main dashboard with box selection
├── dashboard/
│   └── [boxId]/
│       └── page.tsx                # Box-specific booking view
│       └── [date]/
│           └── page.tsx            # Date-specific booking view
└── api/
    └── bookings/
        ├── route.ts                # Main booking API
        ├── [boxId]/
        │   └── route.ts            # Box-specific endpoints
        └── actions/
            └── route.ts            # Booking actions (book/cancel)
```

## 2. Module Structure Implementation

### 2.1 Complete Module Architecture

```
modules/booking/
├── api/
│   ├── services/
│   │   ├── booking.service.ts           # Main booking API service
│   │   ├── cookie-forwarding.service.ts # Cookie handling
│   │   └── real-time.service.ts         # WebSocket/polling service
│   ├── mappers/
│   │   ├── booking.mapper.ts            # API to domain mapping
│   │   └── availability.mapper.ts       # Availability data mapping
│   └── models/
│       ├── booking.api.ts               # API request/response types
│       └── subdomain.api.ts             # Subdomain API models
├── business/
│   ├── booking.business.ts              # Core booking logic
│   ├── availability.business.ts         # Availability calculations
│   └── validation.business.ts           # Business rule validation
├── pods/
│   ├── booking-dashboard/
│   │   ├── booking-dashboard.container.tsx
│   │   ├── booking-dashboard.component.tsx
│   │   ├── booking-dashboard.test.tsx
│   │   ├── components/
│   │   │   ├── booking-card/
│   │   │   │   ├── booking-card.component.tsx
│   │   │   │   └── booking-card.test.tsx
│   │   │   ├── time-slot-grid/
│   │   │   │   ├── time-slot-grid.component.tsx
│   │   │   │   └── time-slot-grid.test.tsx
│   │   │   ├── capacity-indicator/
│   │   │   │   ├── capacity-indicator.component.tsx
│   │   │   │   └── capacity-indicator.test.tsx
│   │   │   └── date-selector/
│   │   │       ├── date-selector.component.tsx
│   │   │       └── date-selector.test.tsx
│   │   ├── hooks/
│   │   │   ├── useBookingContext.hook.tsx
│   │   │   ├── useBooking.hook.tsx
│   │   │   └── useRealTimeUpdates.hook.tsx
│   │   └── models/
│   │       ├── booking-dashboard.model.ts
│   │       └── booking-context.model.ts
│   └── box-selection/
│       ├── box-selection.container.tsx
│       ├── box-selection.component.tsx
│       └── components/
├── models/
│   ├── booking.model.ts                 # Core booking domain models
│   ├── availability.model.ts            # Availability domain models
│   └── box.model.ts                     # Box information models
├── utils/
│   ├── booking.utils.ts                 # Booking utility functions
│   ├── date.utils.ts                    # Date manipulation utilities
│   └── capacity.utils.ts                # Capacity calculation utilities
├── constants/
│   ├── booking.constants.ts             # Booking-related constants
│   ├── api.constants.ts                 # API endpoints and configs
│   └── ui.constants.ts                  # UI-related constants
└── views/
    ├── booking-page.view.tsx            # Main booking page view
    └── box-dashboard.view.tsx           # Box dashboard view
```

### 2.2 API Services Implementation

**Main Booking Service**
```typescript
// modules/booking/api/services/booking.service.ts
import { BookingApiResponse, BookingRequest } from '../models/booking.api';
import { BookingMapper } from '../mappers/booking.mapper';
import { CookieForwardingService } from './cookie-forwarding.service';

export class BookingService {
  private readonly baseUrl = 'https://crossfitcerdanyola300.aimharder.com';

  async fetchBookings(params: BookingRequest): Promise<BookingData> {
    try {
      const url = new URL(`${this.baseUrl}/api/bookings`);
      url.searchParams.set('box', params.boxId);
      url.searchParams.set('day', params.day);
      url.searchParams.set('_', Date.now().toString());

      if (params.familyId) {
        url.searchParams.set('familyId', params.familyId);
      }

      const headers = CookieForwardingService.forwardToSubdomain();

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          ...headers,
          'Accept': 'application/json',
          'User-Agent': 'AimHarder-Dashboard/1.0'
        },
        next: {
          revalidate: 60, // Cache for 1 minute
          tags: [`bookings-${params.boxId}-${params.day}`]
        }
      });

      if (!response.ok) {
        throw new BookingApiError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apiData: BookingApiResponse = await response.json();
      return BookingMapper.fromApiResponse(apiData);
    } catch (error) {
      console.error('Booking service error:', error);
      throw new BookingServiceError('Failed to fetch booking data', error);
    }
  }

  async bookClass(bookingId: string, timeId: string): Promise<BookingActionResult> {
    // Implementation for booking a class
  }

  async cancelBooking(bookingId: string): Promise<BookingActionResult> {
    // Implementation for canceling a booking
  }
}

export const bookingService = new BookingService();
```

## 3. Performance Optimization Strategy

### 3.1 Caching Strategies

**Multi-Level Caching Approach**
1. **Browser Cache**: 60-second cache for booking data
2. **React Query Cache**: 5-minute stale time with background refetch
3. **Server Cache**: Next.js cache with tag-based invalidation

```typescript
// modules/booking/hooks/useBooking.hook.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useBooking({ initialData, boxId, selectedDate }: UseBookingProps) {
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['bookings', boxId, selectedDate],
    queryFn: () => bookingService.fetchBookings({ boxId, day: selectedDate }),
    initialData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchIntervalInBackground: true,
  });

  const bookMutation = useMutation({
    mutationFn: ({ bookingId, timeId }: BookingActionParams) =>
      bookingService.bookClass(bookingId, timeId),
    onSuccess: () => {
      // Invalidate and refetch bookings
      queryClient.invalidateQueries(['bookings', boxId, selectedDate]);
    },
  });

  return {
    bookings,
    isLoading,
    error,
    refreshBookings: () => queryClient.invalidateQueries(['bookings', boxId, selectedDate]),
    handleBooking: bookMutation.mutate,
    isBooking: bookMutation.isLoading,
  };
}
```

### 3.2 Real-time Updates

**WebSocket Integration for Live Updates**
```typescript
// modules/booking/api/services/real-time.service.ts
export class RealTimeBookingService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(boxId: string, onUpdate: (booking: BookingUpdate) => void) {
    const wsUrl = `wss://crossfitcerdanyola300.aimharder.com/ws/bookings/${boxId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        onUpdate(update);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    this.ws.onclose = () => {
      this.handleReconnect(boxId, onUpdate);
    };
  }

  private handleReconnect(boxId: string, onUpdate: (booking: BookingUpdate) => void) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect(boxId, onUpdate);
      }, 1000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }
}
```

### 3.3 Mobile Performance Considerations

**Optimized Mobile Component**
```typescript
// modules/booking/pods/booking-dashboard/components/mobile-booking-grid.tsx
"use client";

import { useMemo } from 'react';
import { VirtualizedList } from '@/common/components/virtualized-list';

export function MobileBookingGrid({ bookings }: MobileBookingGridProps) {
  const optimizedBookings = useMemo(() => {
    // Pre-process booking data for mobile display
    return bookings.map(booking => ({
      ...booking,
      displayTime: formatTimeForMobile(booking.time),
      capacityStatus: calculateCapacityStatus(booking),
      isBookable: booking.enabled && booking.ocupation < booking.limit
    }));
  }, [bookings]);

  return (
    <VirtualizedList
      items={optimizedBookings}
      renderItem={({ item }) => (
        <MobileBookingCard key={item.id} booking={item} />
      )}
      itemHeight={120}
      className="booking-grid-mobile"
    />
  );
}
```

## 4. Integration Patterns

### 4.1 Authentication Integration

**Seamless Auth Integration**
```typescript
// modules/booking/hooks/useBookingAuth.hook.tsx
import { useLogin } from '@/modules/auth/pods/login/hooks/useLogin.hook';

export function useBookingAuth() {
  const { user, checkAuthStatus, getAimharderCookies } = useLogin();

  const validateBookingAccess = useCallback(async () => {
    const isAuthenticated = await checkAuthStatus();
    const cookies = getAimharderCookies();

    const hasRequiredCookies = ['PHPSESSID', 'amhrdrauth'].every(
      cookie => cookies[cookie]
    );

    return isAuthenticated && hasRequiredCookies;
  }, [checkAuthStatus, getAimharderCookies]);

  return {
    user,
    validateBookingAccess,
    isBookingReady: !!user && Object.keys(getAimharderCookies()).length > 0
  };
}
```

### 4.2 Error Boundary Implementation

**Booking-Specific Error Boundary**
```typescript
// modules/booking/components/booking-error-boundary.tsx
"use client";

import { Component, ReactNode } from 'react';
import { Button } from '@/common/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface BookingErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class BookingErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  BookingErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): BookingErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Booking component error:', error, errorInfo);
    // Send error to monitoring service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <BookingErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

function BookingErrorFallback({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">Booking System Error</h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        We're having trouble loading the booking system. This might be due to a connection issue.
      </p>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}
```

### 4.3 Type Safety Implementation

**Comprehensive Type Safety**
```typescript
// modules/booking/models/booking.model.ts
import { z } from 'zod';

export const BookingSchema = z.object({
  id: z.number(),
  time: z.string(),
  timeid: z.string(),
  className: z.string(),
  boxName: z.string(),
  boxDir: z.string(),
  boxPic: z.string().url(),
  coachName: z.string().nullable(),
  coachPic: z.string().url(),
  enabled: z.number().min(0).max(1),
  bookState: z.number().nullable(),
  limit: z.number().min(0),
  ocupation: z.number().min(0),
  waitlist: z.number().min(0),
  color: z.string(),
  classLength: z.number().min(0),
  included: z.number().min(0).max(1),
});

export const BookingResponseSchema = z.object({
  clasesDisp: z.string(),
  timetable: z.array(z.unknown()), // Define TimeSlot schema
  day: z.string(),
  bookings: z.array(BookingSchema),
  seminars: z.array(z.string()),
});

export type Booking = z.infer<typeof BookingSchema>;
export type BookingResponse = z.infer<typeof BookingResponseSchema>;

// Runtime validation in mappers
export class BookingMapper {
  static fromApiResponse(apiData: unknown): BookingData {
    const validated = BookingResponseSchema.parse(apiData);

    return {
      day: validated.day,
      bookings: validated.bookings.map(booking => ({
        ...booking,
        isBookable: booking.enabled === 1 && booking.ocupation < booking.limit,
        capacityPercentage: (booking.ocupation / booking.limit) * 100,
        hasWaitlist: booking.waitlist > 0,
        userBookingStatus: booking.bookState ? 'booked' : 'available'
      }))
    };
  }
}
```

## 5. Implementation Phases

### Phase 1: Foundation Setup
1. Create module structure
2. Implement basic API services
3. Set up authentication integration
4. Create core data models and validation

### Phase 2: Core Booking Features
1. Implement booking dashboard container and component
2. Create booking cards and time slot grid
3. Add real-time updates capability
4. Implement booking actions (book/cancel)

### Phase 3: Performance & UX
1. Add caching strategies
2. Implement mobile optimizations
3. Add error boundaries and loading states
4. Optimize for accessibility

### Phase 4: Testing & Quality Assurance
1. Implement comprehensive test coverage
2. Add integration tests for API calls
3. Performance testing and optimization
4. User acceptance testing

## 6. Key Technical Decisions

### 6.1 Architecture Choices
- **Container/Component Pattern**: Separates data fetching from UI logic
- **API Route Proxy**: Handles subdomain calls and cookie forwarding securely
- **React Query**: Provides caching, synchronization, and background updates
- **Zod Validation**: Ensures type safety and runtime validation

### 6.2 Performance Decisions
- **Multi-level Caching**: Browser, React Query, and Server caching
- **Virtual Scrolling**: For large booking lists on mobile
- **Background Refetch**: Keeps data fresh without user interaction
- **Optimistic Updates**: Immediate UI feedback for booking actions

### 6.3 UX/UI Decisions
- **Mobile-First Design**: Responsive components with touch-friendly interactions
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Error Recovery**: Graceful error handling with retry mechanisms
- **Loading States**: Skeleton screens and spinners for better perceived performance

## 7. Monitoring and Observability

### 7.1 Error Tracking
- Implement error boundaries with reporting
- Add API call monitoring and alerting
- Track booking success/failure rates
- Monitor real-time connection stability

### 7.2 Performance Monitoring
- Core Web Vitals tracking
- API response time monitoring
- Mobile performance metrics
- User interaction analytics

## Conclusion

This implementation strategy provides a robust, scalable, and maintainable solution for the CrossFit booking system. By following Next.js best practices and the established project patterns, we ensure consistency with the existing codebase while delivering a high-performance user experience.

The modular architecture allows for future enhancements and easy testing, while the comprehensive error handling and caching strategies ensure reliability even under high load or network issues.