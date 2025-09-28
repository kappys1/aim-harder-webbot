# Frontend Business Logic Architecture for Booking System

## Overview

This document defines the business logic architecture for the CrossFit booking system frontend, following the established patterns observed in the auth module and adhering to the project's feature-based architecture principles.

## 1. Business Logic Layer Structure

### 1.1 Core Business Services

```typescript
// modules/booking/business/booking.business.ts
import { BookingData, BookingAction, BookingValidationResult } from '../models/booking.model';
import { bookingService } from '../api/services/booking.service';

export class BookingBusinessLogic {
  // Core booking validation rules
  static validateBookingEligibility(booking: Booking, user: User): BookingValidationResult {
    const validations: ValidationCheck[] = [
      {
        rule: 'time_check',
        valid: this.isBookingTimeValid(booking),
        message: 'Cannot book classes that have already started'
      },
      {
        rule: 'capacity_check',
        valid: booking.ocupation < booking.limit,
        message: 'Class is at full capacity'
      },
      {
        rule: 'membership_check',
        valid: booking.included === 1,
        message: 'This class is not included in your membership'
      },
      {
        rule: 'duplicate_check',
        valid: booking.bookState === null,
        message: 'You are already booked for this class'
      },
      {
        rule: 'enabled_check',
        valid: booking.enabled === 1,
        message: 'This class is currently unavailable for booking'
      }
    ];

    const failedValidations = validations.filter(v => !v.valid);

    return {
      isValid: failedValidations.length === 0,
      canJoinWaitlist: this.canJoinWaitlist(booking, failedValidations),
      errors: failedValidations.map(v => v.message),
      warnings: this.generateWarnings(booking)
    };
  }

  // Booking time validation
  private static isBookingTimeValid(booking: Booking): boolean {
    const [startTime] = booking.time.split(' - ');
    const bookingDateTime = this.parseBookingDateTime(booking.date, startTime);
    const now = new Date();

    // Cannot book classes that start in less than 30 minutes
    const minimumBookingWindow = 30 * 60 * 1000; // 30 minutes in milliseconds
    return bookingDateTime.getTime() - now.getTime() > minimumBookingWindow;
  }

  // Waitlist eligibility check
  private static canJoinWaitlist(booking: Booking, failedValidations: ValidationCheck[]): boolean {
    const blockers = ['time_check', 'enabled_check', 'duplicate_check'];
    const hasBlockingErrors = failedValidations.some(v => blockers.includes(v.rule));

    return !hasBlockingErrors && booking.ocupation >= booking.limit;
  }

  // Business rule for capacity status calculation
  static calculateCapacityStatus(booking: Booking): CapacityStatus {
    const percentage = (booking.ocupation / booking.limit) * 100;

    if (percentage >= 100) return 'full';
    if (percentage >= 80) return 'almost_full';
    if (percentage >= 60) return 'filling';
    if (percentage >= 30) return 'available';
    return 'low_demand';
  }

  // Business logic for booking action prioritization
  static determineBookingAction(booking: Booking, user: User): BookingAction {
    const validation = this.validateBookingEligibility(booking, user);

    if (!validation.isValid && validation.canJoinWaitlist) {
      return {
        type: 'waitlist',
        available: true,
        label: 'Join Waitlist',
        priority: 'secondary'
      };
    }

    if (!validation.isValid) {
      return {
        type: 'unavailable',
        available: false,
        label: 'Unavailable',
        priority: 'disabled',
        reason: validation.errors[0]
      };
    }

    if (booking.bookState) {
      return {
        type: 'cancel',
        available: true,
        label: 'Cancel Booking',
        priority: 'destructive'
      };
    }

    return {
      type: 'book',
      available: true,
      label: 'Book Class',
      priority: 'primary'
    };
  }

  // Parse booking date and time
  private static parseBookingDateTime(date: string, time: string): Date {
    // Implementation for parsing YYYYMMDD format and HH:MM time
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(date.substring(6, 8));
    const [hours, minutes] = time.split(':').map(Number);

    return new Date(year, month, day, hours, minutes);
  }

  // Generate user-friendly warnings
  private static generateWarnings(booking: Booking): string[] {
    const warnings: string[] = [];

    const capacityPercentage = (booking.ocupation / booking.limit) * 100;
    if (capacityPercentage >= 80) {
      warnings.push('This class is filling up quickly');
    }

    if (booking.waitlist > 0) {
      warnings.push(`${booking.waitlist} people are on the waitlist`);
    }

    const bookingTime = this.parseBookingDateTime(booking.date, booking.time.split(' - ')[0]);
    const hoursUntilClass = (bookingTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilClass < 2) {
      warnings.push('This class starts soon');
    }

    return warnings;
  }
}
```

### 1.2 State Management Business Logic

```typescript
// modules/booking/business/booking-state.business.ts
export class BookingStateBusinessLogic {
  // Optimistic update logic
  static applyOptimisticUpdate(
    currentBookings: Booking[],
    action: BookingActionRequest
  ): Booking[] {
    return currentBookings.map(booking => {
      if (booking.id !== action.bookingId) return booking;

      switch (action.type) {
        case 'book':
          return {
            ...booking,
            bookState: 1,
            ocupation: booking.ocupation + 1,
            _isOptimistic: true
          };

        case 'cancel':
          return {
            ...booking,
            bookState: null,
            ocupation: Math.max(0, booking.ocupation - 1),
            _isOptimistic: true
          };

        case 'waitlist':
          return {
            ...booking,
            waitlist: booking.waitlist + 1,
            _isOptimistic: true
          };

        default:
          return booking;
      }
    });
  }

  // Rollback optimistic updates on error
  static rollbackOptimisticUpdate(
    optimisticBookings: Booking[],
    originalBookings: Booking[]
  ): Booking[] {
    return optimisticBookings.map(booking => {
      if (!booking._isOptimistic) return booking;

      const original = originalBookings.find(b => b.id === booking.id);
      return original ? { ...original } : booking;
    });
  }

  // Merge real-time updates with current state
  static mergeRealTimeUpdate(
    currentBookings: Booking[],
    update: BookingUpdate
  ): Booking[] {
    return currentBookings.map(booking => {
      if (booking.id !== update.bookingId) return booking;

      return {
        ...booking,
        ocupation: update.ocupation,
        waitlist: update.waitlist,
        bookState: update.bookState,
        _isOptimistic: false,
        _lastUpdated: new Date().toISOString()
      };
    });
  }
}
```

## 2. Hook Architecture

### 2.1 Core Booking Hook

```typescript
// modules/booking/hooks/useBooking.hook.tsx
import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookingBusinessLogic } from '../business/booking.business';
import { BookingStateBusinessLogic } from '../business/booking-state.business';

export function useBooking({
  initialData,
  boxId,
  selectedDate
}: UseBookingProps) {
  const [optimisticBookings, setOptimisticBookings] = useState<Booking[]>([]);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const originalDataRef = useRef<Booking[]>([]);

  // Query for booking data
  const {
    data: bookings = initialData?.bookings || [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['bookings', boxId, selectedDate],
    queryFn: async () => {
      const result = await bookingService.fetchBookings({
        boxId,
        day: selectedDate
      });
      originalDataRef.current = result.bookings;
      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds
    onSuccess: (data) => {
      originalDataRef.current = data.bookings;
      setOptimisticBookings([]); // Clear optimistic updates on fresh data
    }
  });

  // Mutation for booking actions
  const bookingMutation = useMutation({
    mutationFn: async (actionRequest: BookingActionRequest) => {
      return await bookingService.performBookingAction(actionRequest);
    },
    onMutate: async (actionRequest) => {
      // Apply optimistic update
      await queryClient.cancelQueries(['bookings', boxId, selectedDate]);

      const optimisticUpdate = BookingStateBusinessLogic.applyOptimisticUpdate(
        bookings,
        actionRequest
      );

      setOptimisticBookings(optimisticUpdate);
      setPendingActions(prev => new Set(prev).add(actionRequest.bookingId));

      return { actionRequest };
    },
    onError: (error, actionRequest, context) => {
      // Rollback optimistic update
      const rolledBack = BookingStateBusinessLogic.rollbackOptimisticUpdate(
        optimisticBookings,
        originalDataRef.current
      );

      setOptimisticBookings(rolledBack);
      setPendingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionRequest.bookingId);
        return newSet;
      });

      console.error('Booking action failed:', error);
    },
    onSuccess: (result, actionRequest) => {
      // Clear pending state and refresh data
      setPendingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionRequest.bookingId);
        return newSet;
      });

      // Invalidate queries to get fresh data
      queryClient.invalidateQueries(['bookings', boxId, selectedDate]);
    }
  });

  // Get final bookings (optimistic or real)
  const finalBookings = optimisticBookings.length > 0 ? optimisticBookings : bookings;

  // Enhanced booking action handler with business logic validation
  const handleBookingAction = useCallback(async (
    booking: Booking,
    actionType: BookingActionType,
    user: User
  ) => {
    // Apply business validation
    const validation = BookingBusinessLogic.validateBookingEligibility(booking, user);

    if (!validation.isValid && actionType !== 'cancel') {
      throw new BookingValidationError(validation.errors[0]);
    }

    const actionRequest: BookingActionRequest = {
      bookingId: booking.id,
      timeid: booking.timeid,
      type: actionType,
      boxId,
      date: selectedDate
    };

    await bookingMutation.mutateAsync(actionRequest);
  }, [bookingMutation, boxId, selectedDate]);

  // Get booking action info for a specific booking
  const getBookingAction = useCallback((booking: Booking, user: User): BookingAction => {
    return BookingBusinessLogic.determineBookingAction(booking, user);
  }, []);

  // Check if booking action is pending
  const isActionPending = useCallback((bookingId: string): boolean => {
    return pendingActions.has(bookingId);
  }, [pendingActions]);

  // Refresh bookings manually
  const refreshBookings = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    bookings: finalBookings,
    isLoading,
    error,
    handleBookingAction,
    getBookingAction,
    isActionPending,
    refreshBookings,
    isAnyActionPending: pendingActions.size > 0
  };
}
```

### 2.2 Real-time Updates Hook

```typescript
// modules/booking/hooks/useRealTimeUpdates.hook.tsx
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookingStateBusinessLogic } from '../business/booking-state.business';

export function useRealTimeUpdates(boxId: string, selectedDate: string) {
  const queryClient = useQueryClient();

  const handleBookingUpdate = useCallback((update: BookingUpdate) => {
    queryClient.setQueryData(
      ['bookings', boxId, selectedDate],
      (oldData: BookingData | undefined) => {
        if (!oldData) return oldData;

        const updatedBookings = BookingStateBusinessLogic.mergeRealTimeUpdate(
          oldData.bookings,
          update
        );

        return {
          ...oldData,
          bookings: updatedBookings
        };
      }
    );
  }, [queryClient, boxId, selectedDate]);

  useEffect(() => {
    // Set up WebSocket or Server-Sent Events connection
    const eventSource = new EventSource(
      `/api/bookings/stream?box=${boxId}&date=${selectedDate}`
    );

    eventSource.onmessage = (event) => {
      try {
        const update: BookingUpdate = JSON.parse(event.data);
        handleBookingUpdate(update);
      } catch (error) {
        console.error('Failed to parse booking update:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Booking updates connection error:', error);
      // Implement reconnection logic
    };

    return () => {
      eventSource.close();
    };
  }, [boxId, selectedDate, handleBookingUpdate]);

  return {
    isConnected: true, // Implement actual connection status
  };
}
```

## 3. Context Architecture

### 3.1 Booking Context Provider

```typescript
// modules/booking/hooks/useBookingContext.hook.tsx
import { createContext, useContext, ReactNode } from 'react';
import { useBooking } from './useBooking.hook';
import { useBookingAuth } from './useBookingAuth.hook';
import { useRealTimeUpdates } from './useRealTimeUpdates.hook';

interface BookingContextValue {
  // Booking data and actions
  bookings: Booking[];
  isLoading: boolean;
  error: Error | null;
  handleBookingAction: (booking: Booking, action: BookingActionType) => Promise<void>;
  getBookingAction: (booking: Booking) => BookingAction;
  isActionPending: (bookingId: string) => boolean;
  refreshBookings: () => Promise<void>;

  // Authentication
  user: User | null;
  isBookingReady: boolean;

  // Real-time updates
  isConnected: boolean;

  // UI state
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  boxId: string;
}

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

interface BookingProviderProps {
  children: ReactNode;
  initialData?: BookingData;
  boxId: string;
  defaultDate: string;
}

export function BookingProvider({
  children,
  initialData,
  boxId,
  defaultDate
}: BookingProviderProps) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const { user, isBookingReady } = useBookingAuth();

  const bookingHook = useBooking({
    initialData,
    boxId,
    selectedDate
  });

  const { isConnected } = useRealTimeUpdates(boxId, selectedDate);

  const contextValue: BookingContextValue = {
    ...bookingHook,
    user,
    isBookingReady,
    isConnected,
    selectedDate,
    setSelectedDate,
    boxId
  };

  return (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookingContext(): BookingContextValue {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBookingContext must be used within a BookingProvider');
  }
  return context;
}
```

## 4. Error Handling Business Logic

### 4.1 Error Classification and Recovery

```typescript
// modules/booking/business/error-handling.business.ts
export class BookingErrorHandling {
  static classifyError(error: unknown): BookingErrorType {
    if (error instanceof BookingValidationError) {
      return {
        type: 'validation',
        severity: 'warning',
        recoverable: true,
        userMessage: error.message
      };
    }

    if (error instanceof BookingAuthError) {
      return {
        type: 'authentication',
        severity: 'error',
        recoverable: true,
        userMessage: 'Please log in again to continue booking classes',
        action: 'redirect_to_login'
      };
    }

    if (error instanceof BookingNetworkError) {
      return {
        type: 'network',
        severity: 'error',
        recoverable: true,
        userMessage: 'Connection problem. Please check your internet and try again.',
        action: 'retry'
      };
    }

    if (error instanceof BookingCapacityError) {
      return {
        type: 'capacity',
        severity: 'info',
        recoverable: false,
        userMessage: 'This class is now full. You can join the waitlist.',
        action: 'show_waitlist_option'
      };
    }

    return {
      type: 'unknown',
      severity: 'error',
      recoverable: false,
      userMessage: 'Something went wrong. Please try again later.',
      action: 'contact_support'
    };
  }

  static getRecoveryStrategy(errorType: BookingErrorType): RecoveryStrategy {
    switch (errorType.type) {
      case 'validation':
        return {
          autoRetry: false,
          showRetryButton: false,
          showAlternativeAction: false
        };

      case 'authentication':
        return {
          autoRetry: false,
          showRetryButton: false,
          redirectToAuth: true
        };

      case 'network':
        return {
          autoRetry: true,
          retryAttempts: 3,
          retryDelay: 1000,
          showRetryButton: true
        };

      case 'capacity':
        return {
          autoRetry: false,
          showRetryButton: false,
          showAlternativeAction: true,
          alternativeAction: 'waitlist'
        };

      default:
        return {
          autoRetry: false,
          showRetryButton: true,
          contactSupport: true
        };
    }
  }
}
```

## 5. Data Transformation Business Logic

### 5.1 Booking Data Enhancement

```typescript
// modules/booking/business/data-enhancement.business.ts
export class BookingDataEnhancement {
  static enhanceBookingData(bookings: Booking[]): EnhancedBooking[] {
    return bookings.map(booking => ({
      ...booking,

      // Enhanced capacity information
      capacityStatus: BookingBusinessLogic.calculateCapacityStatus(booking),
      capacityPercentage: (booking.ocupation / booking.limit) * 100,
      spotsRemaining: Math.max(0, booking.limit - booking.ocupation),

      // Time-based information
      isUpcoming: this.isUpcomingClass(booking),
      hoursUntilClass: this.calculateHoursUntilClass(booking),
      isBookingWindowOpen: this.isBookingWindowOpen(booking),

      // User interaction state
      isBookable: this.determineBookability(booking),
      recommendedAction: this.getRecommendedAction(booking),

      // Display helpers
      displayTime: this.formatDisplayTime(booking.time),
      displayCapacity: this.formatCapacityDisplay(booking),
      statusColor: this.getStatusColor(booking),

      // Accessibility
      ariaLabel: this.generateAriaLabel(booking),
      screenReaderText: this.generateScreenReaderText(booking)
    }));
  }

  private static isUpcomingClass(booking: Booking): boolean {
    const classTime = this.parseBookingTime(booking);
    return classTime.getTime() > Date.now();
  }

  private static calculateHoursUntilClass(booking: Booking): number {
    const classTime = this.parseBookingTime(booking);
    return Math.max(0, (classTime.getTime() - Date.now()) / (1000 * 60 * 60));
  }

  private static isBookingWindowOpen(booking: Booking): boolean {
    const hoursUntil = this.calculateHoursUntilClass(booking);
    return hoursUntil > 0.5; // 30 minutes minimum
  }

  private static determineBookability(booking: Booking): boolean {
    return booking.enabled === 1 &&
           booking.ocupation < booking.limit &&
           this.isBookingWindowOpen(booking) &&
           booking.bookState === null;
  }

  private static getRecommendedAction(booking: Booking): BookingRecommendation {
    if (!this.isUpcomingClass(booking)) {
      return { type: 'none', reason: 'past_class' };
    }

    if (booking.bookState) {
      return { type: 'cancel', reason: 'already_booked' };
    }

    if (!this.isBookingWindowOpen(booking)) {
      return { type: 'none', reason: 'booking_window_closed' };
    }

    if (booking.ocupation >= booking.limit) {
      return { type: 'waitlist', reason: 'class_full' };
    }

    if (booking.enabled === 0) {
      return { type: 'none', reason: 'class_disabled' };
    }

    return { type: 'book', reason: 'available' };
  }

  private static formatDisplayTime(timeRange: string): string {
    const [start, end] = timeRange.split(' - ');
    return `${start} - ${end}`;
  }

  private static formatCapacityDisplay(booking: Booking): string {
    if (booking.waitlist > 0) {
      return `${booking.ocupation}/${booking.limit} (+${booking.waitlist} waitlist)`;
    }
    return `${booking.ocupation}/${booking.limit}`;
  }

  private static getStatusColor(booking: Booking): string {
    const capacity = (booking.ocupation / booking.limit) * 100;

    if (capacity >= 100) return 'red';
    if (capacity >= 80) return 'orange';
    if (capacity >= 60) return 'yellow';
    return 'green';
  }

  private static generateAriaLabel(booking: Booking): string {
    const action = this.getRecommendedAction(booking);
    const capacity = this.formatCapacityDisplay(booking);

    return `${booking.className} class at ${booking.time}, ${capacity} capacity, ${action.type} available`;
  }

  private static generateScreenReaderText(booking: Booking): string {
    const parts = [
      `${booking.className} class`,
      `Time: ${booking.time}`,
      `Capacity: ${this.formatCapacityDisplay(booking)}`,
      booking.coachName ? `Coach: ${booking.coachName}` : null,
      booking.waitlist > 0 ? `${booking.waitlist} people on waitlist` : null
    ].filter(Boolean);

    return parts.join(', ');
  }

  private static parseBookingTime(booking: Booking): Date {
    // Parse booking date and time - implementation depends on date format
    // This is a simplified version
    const [startTime] = booking.time.split(' - ');
    const today = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);

    const bookingDate = new Date(today);
    bookingDate.setHours(hours, minutes, 0, 0);

    return bookingDate;
  }
}
```

## 6. Performance Business Logic

### 6.1 Data Optimization

```typescript
// modules/booking/business/performance.business.ts
export class BookingPerformanceOptimizer {
  // Memoization for expensive calculations
  private static capacityCache = new Map<string, CapacityStatus>();
  private static displayCache = new Map<string, string>();

  static optimizeBookingList(bookings: Booking[]): OptimizedBooking[] {
    return bookings.map(booking => {
      const cacheKey = `${booking.id}-${booking.ocupation}-${booking.limit}`;

      // Use cached capacity status if available
      let capacityStatus = this.capacityCache.get(cacheKey);
      if (!capacityStatus) {
        capacityStatus = BookingBusinessLogic.calculateCapacityStatus(booking);
        this.capacityCache.set(cacheKey, capacityStatus);
      }

      return {
        ...booking,
        capacityStatus,
        _optimized: true
      };
    });
  }

  // Virtualization helpers for mobile
  static getVisibleBookings(
    bookings: Booking[],
    startIndex: number,
    endIndex: number
  ): Booking[] {
    return bookings.slice(startIndex, endIndex + 1);
  }

  // Debounced search functionality
  static debounceSearch = debounce((
    bookings: Booking[],
    searchTerm: string,
    callback: (results: Booking[]) => void
  ) => {
    const filtered = this.filterBookings(bookings, searchTerm);
    callback(filtered);
  }, 300);

  private static filterBookings(bookings: Booking[], searchTerm: string): Booking[] {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return bookings;

    return bookings.filter(booking =>
      booking.className.toLowerCase().includes(term) ||
      booking.time.includes(term) ||
      booking.coachName?.toLowerCase().includes(term)
    );
  }

  // Clear caches when needed
  static clearCache(): void {
    this.capacityCache.clear();
    this.displayCache.clear();
  }
}
```

## 7. Integration Points

### 7.1 Authentication Business Logic

```typescript
// modules/booking/business/auth-integration.business.ts
export class BookingAuthIntegration {
  static async validateBookingSession(): Promise<BookingSessionValidation> {
    try {
      const authStatus = await authService.isAuthenticated();
      if (!authStatus) {
        return {
          isValid: false,
          reason: 'not_authenticated',
          action: 'redirect_to_login'
        };
      }

      const cookies = authService.getAimharderCookies();
      const requiredCookies = ['PHPSESSID', 'amhrdrauth'];

      const missingCookies = requiredCookies.filter(
        cookie => !cookies[cookie] || cookies[cookie].trim() === ''
      );

      if (missingCookies.length > 0) {
        return {
          isValid: false,
          reason: 'missing_booking_cookies',
          action: 'refresh_session',
          details: { missingCookies }
        };
      }

      return {
        isValid: true,
        user: await this.getCurrentUser(),
        bookingCookies: cookies
      };
    } catch (error) {
      return {
        isValid: false,
        reason: 'validation_error',
        action: 'contact_support',
        error: error.message
      };
    }
  }

  private static async getCurrentUser(): Promise<User> {
    // Get user from auth service or local storage
    const userEmail = localStorage.getItem('user-email');
    if (!userEmail) throw new Error('No user email found');

    const sessionCheck = await authService.checkSession(userEmail);
    if (!sessionCheck.isValid || !sessionCheck.user) {
      throw new Error('Invalid session');
    }

    return sessionCheck.user;
  }
}
```

## Conclusion

This business logic architecture provides:

1. **Clear Separation of Concerns**: Business rules are isolated from UI and API layers
2. **Validation and Error Handling**: Comprehensive validation with user-friendly error messages
3. **Performance Optimization**: Caching, memoization, and optimization strategies
4. **State Management**: Optimistic updates and real-time synchronization
5. **Authentication Integration**: Seamless integration with existing auth system
6. **Accessibility**: Built-in support for screen readers and keyboard navigation

The architecture follows the established patterns from the auth module while providing booking-specific business logic that ensures a robust and user-friendly booking experience.