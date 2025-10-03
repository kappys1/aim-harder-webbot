# Context Session: React Query Setup for Next.js App Router

## Issue Analysis

### Current State
- **Framework**: Next.js 15.5.4 with App Router
- **React Query Version**: @tanstack/react-query v5.90.2
- **Problem**: React Query hooks are being used in Client Components without a QueryClientProvider wrapper

### Current Implementation Issues

1. **Legacy _app.tsx exists** (Pages Router pattern) at `/app/_app.tsx`
   - Contains QueryClientProvider setup
   - NOT used in App Router (App Router uses layout.tsx)
   - This file is ignored by Next.js App Router

2. **Root Layout** at `/app/layout.tsx`
   - No QueryClientProvider wrapper
   - Only includes Toaster component
   - Server Component (cannot use React Query directly)

3. **App Layout** at `/app/(app)/layout.tsx`
   - Contains Header component
   - No QueryClientProvider wrapper
   - Also a Server Component

4. **Client Components using React Query**:
   - `/modules/boxes/hooks/useBoxes.hook.tsx` - uses `useQueryClient`, `useQuery`, `useMutation`
   - `/modules/prebooking/pods/my-prebookings/hooks/useMyPrebookings.hook.tsx` - uses React Query hooks
   - `/app/(app)/dashboard/dashboard-client.tsx` - uses `useBoxes` hook

### Error
```
modules/boxes/hooks/useBoxes.hook.tsx (9:37) @ useBoxes
   8 | export function useBoxes(userEmail: string) {
>  9 |   const queryClient = useQueryClient();
     |                                     ^
```

This error occurs because the component tree doesn't have a QueryClientProvider ancestor.

## Solution Architecture

### Next.js App Router Pattern for React Query

For Next.js App Router, we need to:

1. **Create a Client Component Provider** (`/common/providers/query-provider.tsx`)
   - 'use client' directive
   - Initialize QueryClient with proper SSR settings
   - Export QueryProvider component

2. **Wrap in Root Layout** (`/app/layout.tsx`)
   - Import and use QueryProvider (Client Component)
   - Keep layout as Server Component
   - QueryProvider wraps children

3. **Optional: Add React Query Devtools** (development only)
   - Helps with debugging queries
   - Only loads in development

### Query Client Configuration

Best practices for Next.js App Router:
- `staleTime: 60 * 1000` (60 seconds) - Avoid immediate refetching on client
- `gcTime: 5 * 60 * 1000` (5 minutes) - Garbage collection time (renamed from cacheTime in v5)
- `refetchOnWindowFocus: false` - Prevent refetch on every focus
- Use `useState` to create QueryClient once per app lifecycle

## Implementation Plan

### Phase 1: Create Provider Infrastructure

1. **Create Query Provider** (`/common/providers/query-provider.tsx`)
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
               staleTime: 60 * 1000, // 1 minute
               gcTime: 5 * 60 * 1000, // 5 minutes
               refetchOnWindowFocus: false,
               retry: 1,
             },
           },
         })
     );

     return (
       <QueryClientProvider client={queryClient}>
         {children}
         {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
       </QueryClientProvider>
     );
   }
   ```

2. **Update Root Layout** (`/app/layout.tsx`)
   - Import QueryProvider
   - Wrap children with QueryProvider
   - Maintain existing structure (fonts, Toaster, etc.)

3. **Clean up legacy file**
   - Delete `/app/_app.tsx` (not used in App Router)

### Phase 2: Verify Integration

1. **Test existing hooks**:
   - `useBoxes` hook
   - `useMyPrebookings` hook
   - All components using React Query

2. **Verify no hydration issues**:
   - Check Server/Client component boundaries
   - Ensure QueryProvider is Client Component
   - Root layout remains Server Component

### Phase 3: Optional Enhancements

1. **Add prefetching support** (if needed)
   - HydrationBoundary for SSR
   - prefetchQuery in Server Components

2. **Add DevTools package** (if not installed)
   - `@tanstack/react-query-devtools`

## Architecture Considerations

### Server vs Client Components

```
app/layout.tsx (Server Component)
  └─ QueryProvider (Client Component)
      └─ children
          ├─ app/(app)/layout.tsx (Server Component)
          │   └─ Header (Client Component likely)
          │       └─ children
          │           └─ dashboard/page.tsx (Server Component)
          │               └─ DashboardClient (Client Component)
          │                   └─ useBoxes hook ✅ Has QueryClient access
          └─ (auth)/...
```

### File Structure

```
common/
  providers/
    query-provider.tsx (NEW)

app/
  layout.tsx (UPDATE - wrap with QueryProvider)
  _app.tsx (DELETE - not used in App Router)
```

### Why This Pattern?

1. **Separation of Concerns**: Provider logic separated from layout
2. **Reusability**: QueryProvider can be imported elsewhere if needed
3. **SSR Compatibility**: Proper useState usage for client-side initialization
4. **Type Safety**: Full TypeScript support
5. **Best Practices**: Follows Tanstack Query + Next.js App Router recommendations

## Dependencies Check

Current package.json includes:
- ✅ `@tanstack/react-query: ^5.90.2`
- ❓ `@tanstack/react-query-devtools` - Need to check if installed

If devtools not installed:
```bash
npm install @tanstack/react-query-devtools --save-dev
```

## Testing Strategy

1. **Manual Testing**:
   - Run dev server
   - Navigate to /dashboard
   - Verify boxes load without error
   - Check React Query DevTools (if installed)

2. **Verify all features**:
   - Box detection works
   - Prebookings load correctly
   - Mutations work (cancel prebooking, update last accessed)

3. **Check for hydration warnings**:
   - Console should be clean
   - No "Text content did not match" errors

## Migration Notes

### Breaking Changes
- None for existing code
- All existing hooks will work unchanged
- Only provider setup changes

### Rollback Plan
- Keep _app.tsx as backup initially
- Can revert layout.tsx changes if needed
- No data model changes

## Next Steps

After this implementation:
1. ✅ All React Query hooks will work
2. ✅ Proper SSR support
3. ✅ DevTools for debugging (development)
4. 🔄 Can add prefetching later if needed
5. 🔄 Can add HydrationBoundary for SSR data later

## Questions for User

None - implementation is straightforward and follows standard patterns.

## Related Files

- `/app/layout.tsx` - Root layout (needs update)
- `/app/_app.tsx` - Legacy file (to be deleted)
- `/modules/boxes/hooks/useBoxes.hook.tsx` - Uses React Query
- `/modules/prebooking/pods/my-prebookings/hooks/useMyPrebookings.hook.tsx` - Uses React Query
- `/app/(app)/dashboard/dashboard-client.tsx` - Uses hooks with React Query

## Status

- [x] Issue analyzed
- [x] Solution architecture defined
- [x] Implementation plan created
- [x] Implementation plan documented at `.claude/doc/react_query_setup/nextjs_architect.md`
- [ ] Implementation (next phase - will be done by parent agent)
- [ ] Testing (next phase)

## Architecture Plan Summary

The implementation is straightforward and consists of 3 changes:

1. **CREATE**: `/common/providers/query-provider.tsx`
   - Client Component with 'use client' directive
   - Creates QueryClient with SSR-optimized settings
   - Exports QueryProvider wrapper component

2. **UPDATE**: `/app/layout.tsx`
   - Import QueryProvider
   - Wrap children with <QueryProvider>
   - Keep everything else unchanged

3. **DELETE**: `/app/_app.tsx`
   - Legacy Pages Router file not used in App Router
   - Can be safely removed

This follows Next.js App Router best practices and React Query v5 patterns. The implementation is non-breaking - all existing hooks and components will work without modification once the provider is in place.

Full details available in: `/Users/marcosga/Documents/projects/alex/aimharder-wod-bot2/.claude/doc/react_query_setup/nextjs_architect.md`
