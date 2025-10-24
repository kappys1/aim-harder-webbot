/**
 * Query Key Factory - Centralizes React Query key management
 *
 * BOILERPLATE REDUCTION: Eliminates scattered query keys across components/hooks
 * Benefits:
 * - Single source of truth for cache invalidation
 * - Type-safe query keys
 * - Easy to refactor
 * - Prevents key duplication
 *
 * Pattern based on @tanstack/react-query factory pattern
 */

export const queryKeys = {
  // Booking queries
  booking: {
    all: ["booking"] as const,
    byDay: (day: string, boxId: string) =>
      [...queryKeys.booking.all, "byDay", day, boxId] as const,
    statistics: (day: string, boxId: string) =>
      [...queryKeys.booking.byDay(day, boxId), "statistics"] as const,
  },

  // Pre-booking queries
  prebooking: {
    all: ["prebooking"] as const,
    byEmail: (email: string) =>
      [...queryKeys.prebooking.all, "byEmail", email] as const,
    active: (email: string) =>
      [...queryKeys.prebooking.byEmail(email), "active"] as const,
    pending: () => [...queryKeys.prebooking.all, "pending"] as const,
  },

  // Box queries
  box: {
    all: ["box"] as const,
    byId: (boxId: string) =>
      [...queryKeys.box.all, "byId", boxId] as const,
    byUser: (userEmail: string) =>
      [...queryKeys.box.all, "byUser", userEmail] as const,
    withAccess: (userEmail: string) =>
      [...queryKeys.box.byUser(userEmail), "withAccess"] as const,
    access: {
      all: ["box", "access"] as const,
      byBox: (boxId: string) =>
        [...queryKeys.box.access.all, "byBox", boxId] as const,
    },
  },

  // Auth queries
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
    user: () => [...queryKeys.auth.all, "user"] as const,
    cookies: () => [...queryKeys.auth.all, "cookies"] as const,
  },
};

/**
 * Helper to invalidate related queries
 * Usage: invalidateQueries(['booking', 'byDay'])
 */
export function getQueryKeyPrefix(keys: readonly (string | number)[]): readonly (string | number)[] {
  return keys.slice(0, -1);
}

/**
 * Create a new query key with additional scope
 * Usage: extendQueryKey(queryKeys.booking.byDay('2025-01-15', 'box1'), 'availability')
 */
export function extendQueryKey(
  key: readonly (string | number)[],
  ...suffixes: (string | number)[]
): readonly (string | number)[] {
  return [...key, ...suffixes] as const;
}

/**
 * Batch invalidation for related queries
 * Usage: batchInvalidateQueries(['booking', 'byDay', '2025-01-15'])
 */
export function getBatchInvalidationKeys(
  key: readonly (string | number)[]
): (readonly (string | number)[])[] {
  const keys: (readonly (string | number)[])[] = [];

  for (let i = 1; i <= key.length; i++) {
    keys.push(key.slice(0, i) as readonly (string | number)[]);
  }

  return keys;
}
