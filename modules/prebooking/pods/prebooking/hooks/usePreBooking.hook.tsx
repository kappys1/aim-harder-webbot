"use client";

import { PreBooking } from "@/modules/prebooking/models/prebooking.model";
import { useCallback, useEffect, useState } from "react";

interface UsePreBookingResult {
  prebookings: PreBooking[];
  isLoading: boolean;
  error: string | null;
  fetchPrebookings: () => Promise<void>;
  cancelPrebooking: (id: string) => Promise<void>;
  hasActivePrebooking: (bookingId: string) => boolean;
  getActivePrebookingForSlot: (bookingId: string) => PreBooking | undefined;
  getActivePrebookingForSlotDay: (
    bookingId: string,
    day: string
  ) => PreBooking | undefined;
}

/**
 * Hook to manage prebookings for a user
 *
 * Features:
 * - Fetch user's prebookings
 * - Cancel prebookings
 * - Check if a specific slot has an active prebooking
 * - Auto-refresh every 30 seconds
 */
export function usePreBooking(userEmail?: string): UsePreBookingResult {
  const [prebookings, setPrebookings] = useState<PreBooking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrebookings = useCallback(async () => {
    if (!userEmail) {
      setPrebookings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/prebooking?user_email=${encodeURIComponent(userEmail)}`,
        {
          headers: {
            "x-user-email": userEmail,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch prebookings");
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
      console.error("[usePreBooking] Error fetching prebookings:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setPrebookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  const cancelPrebooking = useCallback(
    async (id: string) => {
      setError(null);

      try {
        const response = await fetch(`/api/prebooking?id=${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to cancel prebooking");
        }

        // Refresh prebookings after canceling
        await fetchPrebookings();
      } catch (err) {
        console.error("[usePreBooking] Error canceling prebooking:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [fetchPrebookings]
  );

  const hasActivePrebooking = useCallback(
    (bookingId: string): boolean => {
      return prebookings.some(
        (pb) =>
          pb.bookingData.id === bookingId &&
          (pb.status === "pending" || pb.status === "loaded")
      );
    },
    [prebookings]
  );

  const getActivePrebookingForSlot = useCallback(
    (bookingId: string): PreBooking | undefined => {
      return prebookings.find(
        (pb) =>
          pb.bookingData.id === bookingId &&
          (pb.status === "pending" || pb.status === "loaded")
      );
    },
    [prebookings]
  );

  const getActivePrebookingForSlotDay = useCallback(
    (bookingId: string, day: string): PreBooking | undefined => {
      const prebooking = getActivePrebookingForSlot(bookingId);

      if (prebooking) {
        return prebooking.bookingData.day === day ? prebooking : undefined;
      }
      return undefined;
    },
    [getActivePrebookingForSlot]
  );
  // Auto-fetch on mount and when userEmail changes
  useEffect(() => {
    fetchPrebookings();
  }, [fetchPrebookings]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!userEmail) return;

    // const interval = setInterval(() => {
    //   fetchPrebookings();
    // }, 30000); // 30 seconds

    // return () => clearInterval(interval);
  }, [userEmail, fetchPrebookings]);

  return {
    prebookings,
    isLoading,
    error,
    fetchPrebookings,
    cancelPrebooking,
    hasActivePrebooking,
    getActivePrebookingForSlot,
    getActivePrebookingForSlotDay,
  };
}
