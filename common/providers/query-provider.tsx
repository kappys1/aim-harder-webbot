'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance per request to avoid sharing state between users
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus in production
            refetchOnWindowFocus: false,
            // Keep data fresh for 30 seconds for real-time data (booking availability changes frequently)
            staleTime: 30 * 1000,
            // Retry failed queries once
            retry: 1,
            // Cache data for 5 minutes in the background
            gcTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
