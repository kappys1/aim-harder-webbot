"use client";

import { useQuery } from "@tanstack/react-query";
import { BookingMapper } from "../api/mappers/booking.mapper";
import { BookingService } from "../api/services/booking.service";
import { BookingDay } from "../models/booking.model";
import { BookingUtils } from "../utils/booking.utils";

/**
 * TanStack Query hook for fetching booking data
 *
 * Features:
 * - Auto-refetch on window focus (PWA support)
 * - Automatic caching and stale time management
 * - Handles loading, error, and data states
 * - Automatically refetches when data becomes stale
 *
 * @param date - Selected date in YYYY-MM-DD format
 * @param boxId - Box UUID
 * @returns Query object with booking data and refetch function
 */
export function useBookingsQuery(date: string, boxId: string) {
  const bookingService = new BookingService();

  return useQuery<BookingDay>({
    queryKey: ["bookings", date, boxId],
    queryFn: async (): Promise<BookingDay> => {
      // Format date for API
      const apiDate = BookingUtils.formatDateForApi(date);

      // Fetch booking data from API
      const response = await bookingService.getBookings(
        {
          day: apiDate,
          boxId,
          _: BookingUtils.generateCacheTimestamp(),
        },
        undefined
      );

      // Map API response to domain model
      const bookingDay = BookingMapper.mapBookingDay(response);

      return bookingDay;
    },
    // Only run query if date and boxId are provided
    enabled: !!date && !!boxId,

    // How long data is considered "fresh" before being marked as stale
    // After this time, the data will be refetched on mount or when focus returns to window
    staleTime: 15 * 1000, // 30 seconds

    // How long cached data is kept in memory before being garbage collected
    gcTime: 5 * 60 * 1000, // 5 minutes

    // 🎯 AUTO-REFRESH ON WINDOW FOCUS - PWA Support
    // When the user returns to this tab/window, TanStack Query will automatically
    // check if data is stale and refetch if needed
    // This is the key feature that replaces custom visibility event listeners!
    refetchOnWindowFocus: true,

    // Refetch stale data when component mounts
    // true means only refetch if data is stale (respects staleTime)
    refetchOnMount: true,

    // Retry failed requests once
    retry: 1,
  });
}
