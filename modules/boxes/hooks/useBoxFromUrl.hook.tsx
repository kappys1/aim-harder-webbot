'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { BoxUrlUtils } from '../utils/url.utils';

export function useBoxFromUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const boxId = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

  const navigateToBox = useCallback(
    (newBoxId: string, path: string = '/') => {
      BoxUrlUtils.navigateWithBoxId(router, path, newBoxId);
    },
    [router]
  );

  return {
    boxId,
    navigateToBox,
  };
}
