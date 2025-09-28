'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { BookingDay, Booking, BookingFilter } from '../models/booking.model';

interface BookingState {
  currentDay: BookingDay | null;
  selectedDate: string;
  selectedBoxId: string;
  filter: BookingFilter | null;
  isLoading: boolean;
  error: string | null;
  cache: Map<string, BookingDay>;
}

type BookingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_DAY'; payload: BookingDay }
  | { type: 'SET_SELECTED_DATE'; payload: string }
  | { type: 'SET_SELECTED_BOX'; payload: string }
  | { type: 'SET_FILTER'; payload: BookingFilter | null }
  | { type: 'CLEAR_CACHE' }
  | { type: 'CACHE_DAY'; payload: { key: string; data: BookingDay } }
  | { type: 'RESET' };

interface BookingContextType {
  state: BookingState;
  actions: {
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setCurrentDay: (day: BookingDay) => void;
    setSelectedDate: (date: string) => void;
    setSelectedBox: (boxId: string) => void;
    setFilter: (filter: BookingFilter | null) => void;
    clearCache: () => void;
    cacheDay: (key: string, data: BookingDay) => void;
    reset: () => void;
  };
  computed: {
    hasBookings: boolean;
    filteredBookings: Booking[];
    availableBookings: Booking[];
    userBookings: Booking[];
    isFilterActive: boolean;
  };
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const initialState: BookingState = {
  currentDay: null,
  selectedDate: new Date().toISOString().split('T')[0],
  selectedBoxId: '10122', // CrossFit Cerdanyola
  filter: null,
  isLoading: false,
  error: null,
  cache: new Map(),
};

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_CURRENT_DAY':
      return {
        ...state,
        currentDay: action.payload,
        isLoading: false,
        error: null
      };

    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.payload };

    case 'SET_SELECTED_BOX':
      return { ...state, selectedBoxId: action.payload };

    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    case 'CLEAR_CACHE':
      return { ...state, cache: new Map() };

    case 'CACHE_DAY':
      const newCache = new Map(state.cache);
      newCache.set(action.payload.key, action.payload.data);
      return { ...state, cache: newCache };

    case 'RESET':
      return { ...initialState, cache: new Map() };

    default:
      return state;
  }
}

function applyFilter(bookings: Booking[], filter: BookingFilter | null): Booking[] {
  if (!filter) return bookings;

  return bookings.filter(booking => {
    if (filter.classTypes && filter.classTypes.length > 0) {
      if (!filter.classTypes.includes(booking.class.name)) {
        return false;
      }
    }

    if (filter.timeRange) {
      const [startHour] = booking.timeSlot.startTime.split(':').map(Number);
      const [filterStartHour] = filter.timeRange.start.split(':').map(Number);
      const [filterEndHour] = filter.timeRange.end.split(':').map(Number);

      if (startHour < filterStartHour || startHour >= filterEndHour) {
        return false;
      }
    }

    if (filter.availabilityOnly) {
      if (booking.status !== 'available') {
        return false;
      }
    }

    if (filter.includeWaitlist === false) {
      if (booking.status === 'waitlist') {
        return false;
      }
    }

    return true;
  });
}

interface BookingProviderProps {
  children: ReactNode;
  initialDate?: string;
  initialBoxId?: string;
}

export function BookingProvider({
  children,
  initialDate,
  initialBoxId,
}: BookingProviderProps) {
  const [state, dispatch] = useReducer(bookingReducer, {
    ...initialState,
    selectedDate: initialDate || initialState.selectedDate,
    selectedBoxId: initialBoxId || initialState.selectedBoxId,
  });

  const actions = {
    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    setCurrentDay: useCallback((day: BookingDay) => {
      dispatch({ type: 'SET_CURRENT_DAY', payload: day });
    }, []),

    setSelectedDate: useCallback((date: string) => {
      dispatch({ type: 'SET_SELECTED_DATE', payload: date });
    }, []),

    setSelectedBox: useCallback((boxId: string) => {
      dispatch({ type: 'SET_SELECTED_BOX', payload: boxId });
    }, []),

    setFilter: useCallback((filter: BookingFilter | null) => {
      dispatch({ type: 'SET_FILTER', payload: filter });
    }, []),

    clearCache: useCallback(() => {
      dispatch({ type: 'CLEAR_CACHE' });
    }, []),

    cacheDay: useCallback((key: string, data: BookingDay) => {
      dispatch({ type: 'CACHE_DAY', payload: { key, data } });
    }, []),

    reset: useCallback(() => {
      dispatch({ type: 'RESET' });
    }, []),
  };

  const computed = {
    hasBookings: Boolean(state.currentDay?.bookings?.length),

    filteredBookings: state.currentDay
      ? applyFilter(state.currentDay.bookings, state.filter)
      : [],

    availableBookings: state.currentDay
      ? state.currentDay.bookings.filter(booking =>
          booking.status === 'available' || booking.status === 'waitlist'
        )
      : [],

    userBookings: state.currentDay
      ? state.currentDay.bookings.filter(booking => booking.userBookingId !== null)
      : [],

    isFilterActive: Boolean(state.filter),
  };

  const contextValue: BookingContextType = {
    state,
    actions,
    computed,
  };

  return (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookingContext(): BookingContextType {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBookingContext must be used within a BookingProvider');
  }
  return context;
}