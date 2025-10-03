"use client";

import { PreBooking } from "@/modules/prebooking/models/prebooking.model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PrebookingsResponse {
  success: boolean;
  prebookings: Array<{
    id: string;
    bookingData: any;
    availableAt: string;
    status: string;
    result?: any;
    errorMessage?: string;
    createdAt: string;
    executedAt?: string;
  }>;
}

/**
 * Hook to manage user's prebookings
 * - Fetches prebookings for the current user
 * - Provides cancel mutation
 * - Auto-refetches every 60 seconds
 * - Optimistic updates
 */
export function useMyPrebookings(userEmail: string | null) {
  const queryClient = useQueryClient();

  // Fetch prebookings
  const {
    data: prebookings = [],
    isLoading,
    error,
    refetch,
  } = useQuery<PreBooking[]>({
    queryKey: ["my-prebookings", userEmail],
    queryFn: async () => {
      if (!userEmail) {
        return [];
      }

      const response = await fetch(
        `/api/prebooking?user_email=${encodeURIComponent(userEmail)}`
      );

      if (!response.ok) {
        throw new Error("Error al cargar pre-reservas");
      }

      const data: PrebookingsResponse = await response.json();

      // Transform API response to domain model
      return data.prebookings.map((pb) => ({
        id: pb.id,
        userEmail: userEmail,
        boxId: pb.bookingData?.boxId || "",
        bookingData: pb.bookingData,
        availableAt: new Date(pb.availableAt),
        status: pb.status as any,
        result: pb.result,
        errorMessage: pb.errorMessage,
        createdAt: new Date(pb.createdAt),
        executedAt: pb.executedAt ? new Date(pb.executedAt) : undefined,
      }));
    },
    enabled: !!userEmail,
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Cancel prebooking mutation
  const cancelMutation = useMutation({
    mutationFn: async (prebookingId: string) => {
      const response = await fetch(`/api/prebooking?id=${prebookingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al cancelar pre-reserva");
      }

      return response.json();
    },
    // Optimistic update
    onMutate: async (prebookingId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["my-prebookings", userEmail],
      });

      // Snapshot the previous value
      const previousPrebookings = queryClient.getQueryData<PreBooking[]>([
        "my-prebookings",
        userEmail,
      ]);

      // Optimistically remove the prebooking
      queryClient.setQueryData<PreBooking[]>(
        ["my-prebookings", userEmail],
        (old) => old?.filter((pb) => pb.id !== prebookingId) || []
      );

      return { previousPrebookings };
    },
    onError: (error, _prebookingId, context) => {
      // Rollback on error
      if (context?.previousPrebookings) {
        queryClient.setQueryData(
          ["my-prebookings", userEmail],
          context.previousPrebookings
        );
      }
      toast.error(
        error instanceof Error ? error.message : "Error al cancelar pre-reserva"
      );
    },
    onSuccess: () => {
      toast.success("Pre-reserva cancelada correctamente");
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["my-prebookings", userEmail],
      });
    },
  });

  return {
    prebookings,
    isLoading,
    error,
    refetch,
    cancelPrebooking: cancelMutation.mutate,
    isCanceling: cancelMutation.isPending,
  };
}
