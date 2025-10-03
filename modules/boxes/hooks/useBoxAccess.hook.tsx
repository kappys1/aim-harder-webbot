"use client";

import { useEffect, useState } from "react";
import { BoxManagementBusiness } from "../business/box-management.business";

export function useBoxAccess(boxId: string | null, userEmail: string) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!boxId || !userEmail) {
      setHasAccess(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function validateAccess() {
      try {
        setIsLoading(true);
        setError(null);

        // TypeScript narrowing: boxId is guaranteed to be string here due to early return
        if (!boxId) throw new Error("Invalid boxId");

        const access = await BoxManagementBusiness.validateAccess(
          boxId,
          userEmail
        );

        if (isMounted) {
          setHasAccess(access);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error("Failed to validate access")
          );
          setHasAccess(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [boxId, userEmail]);

  return {
    hasAccess,
    isLoading,
    error,
  };
}
