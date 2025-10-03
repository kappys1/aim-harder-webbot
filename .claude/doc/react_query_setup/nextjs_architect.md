# React Query Setup Implementation Plan - Next.js Architect

## Executive Summary

This document outlines the implementation plan for properly setting up @tanstack/react-query in a Next.js App Router application. The current issue is that React Query hooks are being used in Client Components without the required QueryClientProvider wrapper.

## Problem Statement

### Current Error
```
modules/boxes/hooks/useBoxes.hook.tsx (9:37) @ useBoxes
   8 | export function useBoxes(userEmail: string) {
>  9 |   const queryClient = useQueryClient();
     |                                     ^
Error: useQueryClient must be used within a QueryClientProvider
```

### Root Cause
The application has:
1. A legacy `_app.tsx` file (Pages Router pattern) that is not used in App Router
2. No QueryClientProvider in the current layout hierarchy
3. Multiple Client Components using React Query hooks without a provider

## Solution Architecture

### Next.js App Router + React Query Pattern

```
app/layout.tsx (Server Component)
  └─ <QueryProvider> (Client Component) ← NEW
      └─ {children}
          └─ All child components can now use React Query hooks ✅
```

### Files to Create/Modify

#### 1. CREATE: `/common/providers/query-provider.tsx`
**Purpose**: Client Component that provides React Query context to the entire app

**Implementation**:
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance once per component lifecycle
  // Using useState ensures it's created only once on the client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, set staleTime to avoid immediate refetch on client
            staleTime: 60 * 1000, // 1 minute

            // Garbage collection time (v5 renamed from cacheTime)
            gcTime: 5 * 60 * 1000, // 5 minutes

            // Prevent refetch on every window focus
            refetchOnWindowFocus: false,

            // Retry failed requests once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Architecture Notes**:
- `'use client'` directive makes this a Client Component
- `useState` ensures QueryClient is created only once (not on every render)
- Configuration optimized for SSR to prevent hydration issues
- `staleTime: 60s` prevents immediate refetch after SSR
- `gcTime` (formerly cacheTime in v4) controls cache cleanup

#### 2. UPDATE: `/app/layout.tsx`
**Purpose**: Wrap the entire app with QueryProvider

**Current Implementation**:
```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="top-right" expand={true} />
      </body>
    </html>
  );
}
```

**New Implementation**:
```typescript
import { QueryProvider } from "@/common/providers/query-provider";
import { Toaster } from "@/common/ui/sonner";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AimHarder - CrossFit Class Reservations",
  description: "Automatically book CrossFit classes when they become available",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e40af" },
    { media: "(prefers-color-scheme: dark)", color: "#3b82f6" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster position="top-right" expand={true} />
      </body>
    </html>
  );
}
```

**Architecture Notes**:
- RootLayout remains a Server Component
- QueryProvider (Client Component) is imported and wraps children
- Toaster stays outside QueryProvider (no dependency)
- All existing metadata and fonts preserved

#### 3. DELETE: `/app/_app.tsx`
**Purpose**: Remove legacy Pages Router file that is not used in App Router

**Reason for Deletion**:
- Next.js App Router doesn't use `_app.tsx`
- File is ignored but causes confusion
- QueryProvider in layout.tsx replaces this functionality

**Current Content** (to be deleted):
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

export default function MyApp({ Component, pageProps }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
    </QueryClientProvider>
  );
}
```

## Component Hierarchy After Implementation

```
app/layout.tsx (Server Component)
├─ metadata: Metadata
├─ fonts: Geist, Geist_Mono
└─ <html>
    └─ <body>
        ├─ <QueryProvider> (Client Component) ← NEW WRAPPER
        │   └─ {children}
        │       ├─ app/(app)/layout.tsx (Server Component)
        │       │   └─ <Header /> (Client Component)
        │       │       └─ {children}
        │       │           └─ dashboard/page.tsx (Server Component)
        │       │               └─ <DashboardClient /> (Client Component)
        │       │                   ├─ useBoxes() ✅ Works now!
        │       │                   └─ useBoxFromUrl() ✅ Works now!
        │       └─ app/(auth)/...
        └─ <Toaster />
```

## Affected Components (No Changes Needed)

All these components will work automatically after QueryProvider is added:

1. **`/modules/boxes/hooks/useBoxes.hook.tsx`**
   - Uses: `useQuery`, `useMutation`, `useQueryClient`
   - ✅ Will work after provider setup

2. **`/modules/prebooking/pods/my-prebookings/hooks/useMyPrebookings.hook.tsx`**
   - Uses: `useQuery`, `useMutation`, `useQueryClient`
   - ✅ Will work after provider setup

3. **`/app/(app)/dashboard/dashboard-client.tsx`**
   - Uses: `useBoxes` hook
   - ✅ Will work after provider setup

4. **Any future components using React Query**
   - ✅ Will work automatically (no additional setup needed)

## Query Client Configuration Explained

### Default Options

```typescript
{
  queries: {
    staleTime: 60 * 1000,          // 1 minute
    gcTime: 5 * 60 * 1000,         // 5 minutes
    refetchOnWindowFocus: false,   // Don't refetch on focus
    retry: 1,                       // Retry once on failure
  }
}
```

### Why These Settings?

1. **`staleTime: 60 * 1000` (1 minute)**
   - Data is considered fresh for 1 minute
   - Prevents immediate refetch after SSR hydration
   - Reduces unnecessary network requests
   - Can be overridden per-query if needed

2. **`gcTime: 5 * 60 * 1000` (5 minutes)**
   - Renamed from `cacheTime` in v5
   - How long unused data stays in cache
   - Helps with back navigation (cached data available)

3. **`refetchOnWindowFocus: false`**
   - Prevents refetch every time user focuses window
   - Reduces server load
   - Better UX (no loading flickers)
   - Individual queries can override if needed

4. **`retry: 1`**
   - Retry failed queries once before showing error
   - Handles temporary network issues
   - Prevents infinite retry loops

## Testing Plan

### 1. Build Test
```bash
npm run build
```
Expected: Clean build with no errors

### 2. Development Test
```bash
npm run dev
```
Expected: Server starts without errors

### 3. Functional Tests

Navigate to: `http://localhost:3000/dashboard`

**Test Cases**:
1. ✅ Dashboard loads without React Query error
2. ✅ Boxes are fetched and displayed
3. ✅ Loading states work correctly
4. ✅ Error states work correctly
5. ✅ Mutations work (update last accessed, detect boxes)
6. ✅ Navigate to different pages and back (cache should work)

### 4. Browser Console Check
- No hydration warnings
- No "useQueryClient must be used within QueryClientProvider" errors
- No "Text content did not match" errors

## Implementation Steps

### Step 1: Create Provider Directory
```bash
mkdir -p /Users/marcosga/Documents/projects/alex/aimharder-wod-bot2/common/providers
```

### Step 2: Create QueryProvider
Create file: `/common/providers/query-provider.tsx`
(Content provided in section "Files to Create/Modify")

### Step 3: Update Root Layout
Edit file: `/app/layout.tsx`
- Import QueryProvider
- Wrap children with QueryProvider

### Step 4: Delete Legacy File
Delete file: `/app/_app.tsx`

### Step 5: Test
```bash
npm run dev
```
Navigate to dashboard and verify all features work

## Rollback Plan

If issues occur:

1. **Immediate Rollback**:
   - Revert `/app/layout.tsx` to original
   - Restore `/app/_app.tsx` from git history
   - Delete `/common/providers/query-provider.tsx`

2. **Git Commands**:
   ```bash
   git checkout app/layout.tsx
   git checkout app/_app.tsx
   rm common/providers/query-provider.tsx
   ```

## Benefits of This Implementation

1. **Follows Next.js Best Practices**
   - App Router pattern
   - Proper Server/Client component separation
   - SSR-compatible

2. **Type Safe**
   - Full TypeScript support
   - No type casting needed

3. **Scalable**
   - All future components get React Query for free
   - Centralized configuration
   - Easy to add features (prefetching, hydration, etc.)

4. **Maintainable**
   - Single source of truth for QueryClient config
   - Clear provider separation
   - Easy to debug

5. **Performance Optimized**
   - Proper cache management
   - Prevents unnecessary refetches
   - SSR-friendly settings

## Future Enhancements (Optional)

### 1. Add React Query DevTools (Development Only)

**Install**:
```bash
npm install @tanstack/react-query-devtools --save-dev
```

**Update QueryProvider**:
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

**Benefits**:
- Visual query inspector
- See all queries and their states
- Debug cache behavior
- Monitor mutations
- Only loads in development (zero production impact)

### 2. Add Server-Side Prefetching (If Needed)

For pages that need SSR data:

**Create utility**:
```typescript
// common/utils/query-client-server.ts
import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

export const getQueryClient = cache(() => new QueryClient());
```

**Use in Server Components**:
```typescript
// app/dashboard/page.tsx
import { getQueryClient } from '@/common/utils/query-client-server';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

export default async function DashboardPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['boxes', userEmail],
    queryFn: () => BoxManagementBusiness.getUserBoxes(userEmail),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
```

**Benefits**:
- Faster initial page load
- No loading state on first render
- Better SEO

**Note**: This is optional and not needed for the current fix.

### 3. Add Custom Query Configurations

For specific use cases:

```typescript
// common/config/query-config.ts
export const queryConfig = {
  // Real-time data (refetch often)
  realtime: {
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // 30 seconds
  },

  // Static data (rarely changes)
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  },

  // User-specific data
  user: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  },
};
```

**Usage**:
```typescript
useQuery({
  queryKey: ['realtime-data'],
  queryFn: fetchRealtimeData,
  ...queryConfig.realtime,
});
```

## Dependencies

### Required (Already Installed)
- ✅ `@tanstack/react-query: ^5.90.2`

### Optional (Not Required for Fix)
- ❌ `@tanstack/react-query-devtools` - Helpful for debugging (see Future Enhancements)

## Summary

This implementation:
1. **Creates** `/common/providers/query-provider.tsx` - Client Component wrapper
2. **Updates** `/app/layout.tsx` - Adds QueryProvider wrapper
3. **Deletes** `/app/_app.tsx` - Removes unused Pages Router file

After implementation:
- ✅ All React Query hooks will work throughout the app
- ✅ No changes needed to existing hooks/components
- ✅ SSR-compatible and performant
- ✅ Follows Next.js App Router best practices
- ✅ Type-safe and maintainable

## Questions & Clarifications

No questions - the implementation is straightforward and follows standard patterns for Next.js App Router + React Query v5.

## Related Documentation

- [Tanstack Query v5 Docs](https://tanstack.com/query/latest)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React Query with Next.js App Router](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)

## Implementation Checklist

- [ ] Create `/common/providers/query-provider.tsx`
- [ ] Update `/app/layout.tsx` to import and use QueryProvider
- [ ] Delete `/app/_app.tsx`
- [ ] Test build: `npm run build`
- [ ] Test dev: `npm run dev`
- [ ] Test dashboard functionality
- [ ] Verify no console errors
- [ ] Verify all React Query features work
- [ ] (Optional) Install and configure DevTools
- [ ] (Optional) Add prefetching if needed

## Notes

- This is a **non-breaking change** - all existing code continues to work
- Zero impact on data models, business logic, or API contracts
- Pure infrastructure improvement
- Can be implemented and tested in under 10 minutes
- Rollback is simple if needed
