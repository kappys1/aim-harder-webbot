'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BoxManagementBusiness } from '../business/box-management.business';
import type { DetectBoxesRequest } from '../api/models/box.api';
import type { BoxWithAccess } from '../models/box.model';

export function useBoxes(userEmail: string) {
  const queryClient = useQueryClient();

  // Query to fetch user boxes
  const {
    data: boxes = [],
    isLoading,
    error,
  } = useQuery<BoxWithAccess[], Error>({
    queryKey: ['boxes', userEmail],
    queryFn: () => BoxManagementBusiness.getUserBoxes(userEmail),
    enabled: !!userEmail,
  });

  // Mutation to detect boxes
  const detectBoxesMutation = useMutation({
    mutationFn: (request: DetectBoxesRequest) =>
      BoxManagementBusiness.detectBoxes(request),
    onSuccess: () => {
      // Invalidate and refetch boxes
      queryClient.invalidateQueries({ queryKey: ['boxes', userEmail] });
    },
  });

  // Mutation to update last accessed
  const updateLastAccessedMutation = useMutation({
    mutationFn: ({ boxId }: { boxId: string }) =>
      BoxManagementBusiness.updateLastAccessed(boxId, userEmail),
    onSuccess: () => {
      // Invalidate and refetch boxes
      queryClient.invalidateQueries({ queryKey: ['boxes', userEmail] });
    },
  });

  return {
    boxes,
    isLoading,
    error,
    detectBoxes: detectBoxesMutation.mutate,
    isDetecting: detectBoxesMutation.isPending,
    detectError: detectBoxesMutation.error,
    updateLastAccessed: updateLastAccessedMutation.mutate,
  };
}
