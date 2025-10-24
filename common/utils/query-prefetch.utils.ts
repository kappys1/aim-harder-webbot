/**
 * Server-side utilities for prefetching React Query data
 * Helps reduce waterfalls by fetching data on the server and passing to client
 */

export interface PrefetchOptions {
  staleTime?: number;
  gcTime?: number;
}

/**
 * Prefetch data for a React Query key on the server
 * This reduces network waterfalls by fetching data server-side
 *
 * Usage in Server Component:
 * ```tsx
 * const boxesPrefetch = await prefetchBoxes(userEmail);
 * ```
 *
 * Then pass to client component:
 * ```tsx
 * <BookingDashboardComponent boxesPrefetch={boxesPrefetch} />
 * ```
 *
 * On client side, use useQuery with initialData:
 * ```tsx
 * const { data: boxes } = useQuery({
 *   queryKey: ['boxes', userEmail],
 *   queryFn: () => BoxManagementBusiness.getUserBoxes(userEmail),
 *   initialData: boxesPrefetch,
 * });
 * ```
 */

export async function prefetchBoxes(userEmail: string) {
  try {
    if (!userEmail) return null;

    const response = await fetch(`http://localhost:3000/api/boxes?userEmail=${userEmail}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Server-side fetch should not cache to avoid stale data
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('Failed to prefetch boxes:', response.status);
      return null;
    }

    const data = await response.json();
    return data.boxes || null;
  } catch (error) {
    console.warn('Error prefetching boxes:', error);
    return null;
  }
}

/**
 * Utility to track prefetch performance
 * Helps measure the impact of prefetching optimizations
 */
export class PrefetchMetrics {
  private static metrics = new Map<string, { start: number; duration: number }>();

  static start(key: string) {
    this.metrics.set(key, { start: Date.now(), duration: 0 });
  }

  static end(key: string) {
    const metric = this.metrics.get(key);
    if (metric) {
      metric.duration = Date.now() - metric.start;
      console.log(`[Prefetch] ${key}: ${metric.duration}ms`);
    }
  }

  static get(key: string) {
    return this.metrics.get(key);
  }
}
