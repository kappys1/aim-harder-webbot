"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

  // Use ref to avoid stale closures
  const stateRef = useRef(state);
  const actionsRef = useRef(actions);

  useEffect(() => {
    stateRef.current = state;
    actionsRef.current = actions;
  });

  const fetchBookings = useCallback(
    async (forceRefresh = false): Promise<void> => {
      const currentState = stateRef.current;
      const currentActions = actionsRef.current;

      if (!currentState.selectedDate || !currentState.selectedBoxId) {
        currentActions.setError("Fecha o box no seleccionado");
        return;
      }

      const cacheKey = BookingUtils.getCacheKey(
        currentState.selectedDate,
        currentState.selectedBoxId
      );

      // Skip cache if forceRefresh is true
      if (!forceRefresh && enableCache && currentState.cache.has(cacheKey)) {
        const cachedData = currentState.cache.get(cacheKey);
        if (cachedData) {
          // Use setTimeout to break React batching and ensure loading state is visible
          setTimeout(() => {
            currentActions.setCurrentDay(cachedData);
          }, 0);

          return;
        }
      }

      try {
        currentActions.setLoading(true);
        currentActions.setError(null);

        const bookingDay = await bookingBusiness.getBookingsForDay(
          currentState.selectedDate,
          currentState.selectedBoxId,
          cookies
        );

        currentActions.setCurrentDay(bookingDay);
        currentActions.setLoading(false);

        if (enableCache) {
          currentActions.cacheDay(cacheKey, bookingDay);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Error desconocido";
        currentActions.setError(errorMessage);
        currentActions.setLoading(false);
        console.error("Error fetching bookings:", error);

        // Show user-friendly error toast
        if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch")
        ) {
          toast.error("Error de conexión", {
            description:
              "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
          });
        } else if (
          errorMessage.includes("auth") ||
          errorMessage.includes("unauthorized")
        ) {
          toast.error("Sesión expirada", {
            description:
              "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          });
        } else if (
          errorMessage.includes("404") ||
          errorMessage.includes("not found")
        ) {
          toast.error("Datos no encontrados", {
            description:
              "No se encontraron reservas para la fecha seleccionada.",
          });
        } else {
          toast.error("Error al cargar reservas", {
            description: "Ocurrió un error inesperado. Intenta nuevamente.",
          });
        }
      }
    },
    [enableCache, cookies, bookingBusiness]
  );

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
      fetchBookings(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedDate, state.selectedBoxId, autoFetch]);

  // Create a refetch function that forces a refresh
  const refetch = async (): Promise<void> => {
    await fetchBookings(true);
  };

  return {
    bookingDay: state.currentDay,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
    setDate,
    setBox,
    retryOnError,
    statistics,
  };
}
