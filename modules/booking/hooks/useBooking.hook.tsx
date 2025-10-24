"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthCookie } from "../../auth/api/services/cookie.service";
import { BookingBusiness } from "../business/booking.business";
import { BookingDay } from "../models/booking.model";
import { useBookingContext } from "./useBookingContext.hook";
import { useBookingsQuery } from "./useBookingsQuery.hook";

interface UseBookingOptions {
  autoFetch?: boolean;
  enableCache?: boolean;
  cookies?: AuthCookie[];
  onRefetch?: () => Promise<void>;
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
  const { onRefetch } = options;

  const { state, actions } = useBookingContext();
  const [bookingBusiness] = useState(() => new BookingBusiness());

  // Use TanStack Query for data fetching and caching
  // This automatically handles:
  // - Caching with 30s stale time
  // - Auto-refetch on window focus (PWA support)
  // - Loading and error states
  // - Garbage collection after 5 minutes
  const {
    data: bookingDayData,
    isLoading,
    isRefetching,
    error: queryError,
    refetch: tanstackRefetch,
  } = useBookingsQuery(state.selectedDate, state.selectedBoxId);

  // Safely extract booking day data
  const bookingDay: BookingDay | null = (bookingDayData as BookingDay) || null;

  // Convert query error to string message
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Error desconocido"
    : null;

  // Handle error display
  useEffect(() => {
    if (error) {
      console.error("Error fetching bookings:", error);

      // Show user-friendly error toast
      if (error.includes("network") || error.includes("fetch")) {
        toast.error("Error de conexión", {
          description:
            "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
        });
      } else if (error.includes("auth") || error.includes("unauthorized")) {
        toast.error("Sesión expirada", {
          description:
            "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
        });
      } else if (error.includes("404") || error.includes("not found")) {
        toast.error("Datos no encontrados", {
          description: "No se encontraron reservas para la fecha seleccionada.",
        });
      } else {
        toast.error("Error al cargar reservas", {
          description: "Ocurrió un error inesperado. Intenta nuevamente.",
        });
      }
    }
  }, [error]);

  const setDate = useCallback(
    (date: string): void => {
      actions.setSelectedDate(date);
    },
    // actions.setSelectedDate is memoized in useBookingContext, safe to depend on
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const setBox = useCallback(
    (boxId: string): void => {
      actions.setSelectedBox(boxId);
    },
    // actions.setSelectedBox is memoized in useBookingContext, safe to depend on
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Refetch function that triggers TanStack Query refetch + optional callback
  const refetch = useCallback(async (): Promise<void> => {
    try {
      // TanStack Query handles the actual refetch
      await tanstackRefetch();

      // Call optional callback (e.g., to refetch prebookings)
      if (onRefetch) {
        await onRefetch();
      }
    } catch (error) {
      console.error("Error refetching bookings:", error);
      toast.error("Error al actualizar reservas", {
        description: "No se pudieron cargar los datos actualizados.",
      });
    }
  }, [tanstackRefetch, onRefetch]);

  // Retry on error
  const retryOnError = useCallback(async (): Promise<void> => {
    if (error) {
      await refetch();
    }
  }, [error, refetch]);

  // Compute statistics from booking data
  const statistics =
    bookingDay && bookingDay.bookings.length > 0
      ? bookingBusiness.getBookingStatistics(bookingDay.bookings)
      : null;

  return {
    bookingDay,
    isLoading: isLoading || isRefetching,
    error,
    refetch,
    setDate,
    setBox,
    retryOnError,
    statistics,
  };
}
