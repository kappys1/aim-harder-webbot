"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthCookie } from "../../auth/api/services/cookie.service";
import { BookingBusiness } from "../business/booking.business";
import { BookingDay } from "../models/booking.model";
import { BookingUtils } from "../utils/booking.utils";
import { useBookingContext } from "./useBookingContext.hook";

interface UseBookingOptions {
  autoFetch?: boolean;
  enableCache?: boolean;
  cookies?: AuthCookie[];
}

interface UseBookingReturn {
  bookingDay: BookingDay | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setDate: (date: string) => void;
  setBox: (boxId: string) => void;
  retryOnError: () => Promise<void>;
  statistics: {
    total: number;
    available: number;
    booked: number;
    full: number;
    waitlist: number;
    occupancyPercentage: number;
    availabilityPercentage: number;
    classTypes: string[];
  } | null;
}

export function useBooking(options: UseBookingOptions = {}): UseBookingReturn {
  const { autoFetch = true, enableCache = true, cookies } = options;

  const { state, actions, computed } = useBookingContext();
  const [bookingBusiness] = useState(() => new BookingBusiness());

  const fetchBookings = useCallback(async (): Promise<void> => {
    if (!state.selectedDate || !state.selectedBoxId) {
      actions.setError("Fecha o box no seleccionado");
      return;
    }

    const cacheKey = BookingUtils.getCacheKey(
      state.selectedDate,
      state.selectedBoxId
    );

    if (enableCache && state.cache.has(cacheKey)) {
      const cachedData = state.cache.get(cacheKey);
      if (cachedData) {
        actions.setCurrentDay(cachedData);
        return;
      }
    }

    try {
      actions.setLoading(true);
      actions.setError(null);

      const bookingDay = await bookingBusiness.getBookingsForDay(
        state.selectedDate,
        state.selectedBoxId,
        cookies
      );
      actions.setLoading(false);
      actions.setCurrentDay(bookingDay);

      if (enableCache) {
        actions.cacheDay(cacheKey, bookingDay);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      actions.setError(errorMessage);
      console.error("Error fetching bookings:", error);
    }
  }, [state, actions, bookingBusiness, enableCache, cookies]);

  const setDate = useCallback(
    (date: string): void => {
      actions.setSelectedDate(date);
    },
    [actions]
  );

  const setBox = useCallback(
    (boxId: string): void => {
      actions.setSelectedBox(boxId);
    },
    [actions]
  );

  const retryOnError = useCallback(async (): Promise<void> => {
    if (state.error) {
      await fetchBookings();
    }
  }, [state.error, fetchBookings]);

  const statistics =
    computed.hasBookings && state.currentDay
      ? bookingBusiness.getBookingStatistics(state.currentDay.bookings)
      : null;

  useEffect(() => {
    if (autoFetch) {
      fetchBookings();
    }
  }, [state.selectedDate, state.selectedBoxId, autoFetch]);

  return {
    bookingDay: state.currentDay,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchBookings,
    setDate,
    setBox,
    retryOnError,
    statistics,
  };
}
