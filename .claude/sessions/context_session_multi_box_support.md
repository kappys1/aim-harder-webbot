# Multi-Box Support - Context Session

**Feature**: Automatic Box Detection and Multi-Box Management
**Date**: 2025-10-03
**Status**: Planning Phase

## Overview

Extend the application to support multiple boxes per user by automatically detecting boxes assigned to logged-in users and storing this information in the database for dynamic multi-box operations.

## Problem Statement

Currently, the application is hardcoded to work with a single box (CrossFit Cerdanyola - ID: 10122). Users may have access to multiple boxes, and we need to:
1. Automatically detect all boxes a user has access to
2. Store box information in the database
3. Allow users to switch between boxes via query parameters
4. Make all booking/pre-booking operations dynamic based on selected box
5. Validate user access to boxes when displaying bookings and pre-bookings

## Requirements

### Core Functionality

1. **Automatic Box Detection (First Login)**
   - When a new user logs in for the first time, automatically detect their boxes
   - Fetch boxes from `https://aimharder.com/home` after successful authentication
   - Parse subdomain links (e.g., `crossfitcerdanyola300.aimharder.com`)
   - For each detected subdomain, fetch box ID from `https://[subdomain].aimharder.com/schedule?cl`
   - Parse HTML to find pattern: `box: [id]` (e.g., `box: 10122`)
   - Scrape additional box info from `https://[subdomain].aimharder.com`

2. **Box Information Storage**
   - Store detected boxes in database
   - **Reuse existing box data** if box already exists (avoid duplicate scraping)
   - Only create new box records when box doesn't exist in database
   - Create user-box relationships

3. **Box Data to Collect**
   From navigation/subdomain detection:
   - Subdomain (e.g., `crossfitcerdanyola300`)
   - Box name (e.g., `CrossFit Cerdanyola`)

   From `/schedule?cl` page:
   - Box ID (e.g., `10122`)

   From box homepage `https://[subdomain].aimharder.com`:
   - Phone number
   - Email
   - Address
   - Website URL
   - Logo/Image URL

4. **Manual Box Refresh**
   - "Actualizar boxes" button in dashboard
   - Re-detects boxes for current user
   - Adds newly found boxes to user's list
   - Does NOT remove existing boxes
   - Shows loading state and toast notifications

5. **Session Management**
   - One session cookie per user (not per box)
   - User session grants access to all their assigned boxes

6. **Box Selection & Navigation**
   - Use query parameter to specify selected box: `?boxId=<uuid>`
   - When user clicks on a box card: navigate to `/?boxId=<uuid>`
   - Read `boxId` from query params to determine active box
   - If no `boxId` in query params: use first box or last active box
   - Store last active box selection in user preferences

7. **Access Control & Validation**
   - When displaying bookings: verify user has access to the selected box
   - When displaying pre-bookings: verify user has access to the selected box
   - If user doesn't have access: show error and redirect to their boxes
   - Filter bookings/pre-bookings by selected box

### User Flow

1. **New User First Login**:
   ```
   Login → Verify credentials → Check if user has boxes in DB
   → If no boxes: Trigger automatic detection
   → Detect boxes → Store in DB → Mark first box as active
   → Redirect to dashboard with ?boxId=<first-box-uuid>
   ```

2. **Returning User Login**:
   ```
   Login → Verify credentials → Load user's boxes from DB
   → Get last active box or first box
   → Redirect to dashboard with ?boxId=<box-uuid>
   ```

3. **Box Selection (Click on Box Card)**:
   ```
   Dashboard → Click on box card
   → Navigate to /?boxId=<selected-box-uuid>
   → Load bookings/pre-bookings for selected box
   → Show box-specific content
   ```

4. **Manual Box Update**:
   ```
   Dashboard → Click "Actualizar boxes" button
   → Show loading → Detect boxes → Add new boxes
   → Show success toast → Auto-refresh box list
   → Maintain current boxId in URL
   ```

5. **Booking/Pre-booking Display**:
   ```
   Load page → Read boxId from query params
   → Verify user has access to box
   → If access denied: show error + redirect
   → If access granted: fetch bookings/pre-bookings filtered by box
   → Display box-specific content
   ```

## Technical Discoveries (Playwright Navigation)

### Box Detection Flow

**Step 1**: Navigate to `https://aimharder.com/home` (after login)
- **Found**: Link to box in navigation: `CrossFit Cerdanyola` → `https://crossfitcerdanyola300.aimharder.com`
- **Pattern**: Look for links containing `.aimharder.com` subdomain (excluding main `aimharder.com`)

**Step 2**: Navigate to `https://crossfitcerdanyola300.aimharder.com/schedule?cl`
- **Found**: Box ID in JavaScript: `box: 10122`
- **Location**: Inside `<script>` tags
- **Pattern**: Regex: `/box:\s*(\d+)/`

**Step 3**: Navigate to `https://crossfitcerdanyola300.aimharder.com`
- **Found Box Information**:
  - Name: "CrossFit Cerdanyola"
  - Phone: "665208762"
  - Email: "info@crossfitcerdanyola.com"
  - Address: "Carrer de Sant Ramon, 300, 08290 Cerdanyola del Vallès, Barcelona"
  - Website: "https://www.crossfitcerdanyola.com/"
  - Logo: (Available on page)

### HTML Parsing Strategy

- Use **cheerio** for server-side HTML parsing (lightweight, fast)
- Patterns to extract:
  - Box ID: `/box:\s*(\d+)/` in `<script>` tags
  - Subdomain: Extract from URL using regex `/https:\/\/([^.]+)\.aimharder\.com/`
  - Box details: Direct text extraction from structured HTML

## Database Schema Design

### Proposed Schema (2 Tables)

```sql
-- Table 1: boxes (shared box information)
CREATE TABLE boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id TEXT UNIQUE NOT NULL,              -- Aimharder box ID (e.g., "10122")
  subdomain TEXT UNIQUE NOT NULL,            -- e.g., "crossfitcerdanyola300"
  name TEXT NOT NULL,                        -- e.g., "CrossFit Cerdanyola"
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  logo_url TEXT,
  base_url TEXT NOT NULL,                    -- e.g., "https://crossfitcerdanyola300.aimharder.com"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: user_boxes (user-box relationships)
CREATE TABLE user_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES auth_sessions(user_email) ON DELETE CASCADE,
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  last_accessed_at TIMESTAMPTZ,             -- Last time user accessed this box
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, box_id)                -- One relationship per user-box pair
);

-- Indexes for performance
CREATE INDEX idx_user_boxes_user_email ON user_boxes(user_email);
CREATE INDEX idx_user_boxes_last_accessed ON user_boxes(last_accessed_at DESC);
CREATE INDEX idx_boxes_box_id ON boxes(box_id);
CREATE INDEX idx_boxes_subdomain ON boxes(subdomain);

-- Update existing prebookings table to reference boxes
ALTER TABLE prebookings ADD COLUMN box_id UUID REFERENCES boxes(id);
ALTER TABLE prebookings ADD COLUMN box_subdomain TEXT;
ALTER TABLE prebookings ADD COLUMN box_aimharder_id TEXT; -- Aimharder's box ID for API calls

-- Add index for filtering prebookings by box
CREATE INDEX idx_prebookings_box_id ON prebookings(box_id);
CREATE INDEX idx_prebookings_user_box ON prebookings(user_email, box_id);
```

**Key Points**:
- `boxes` table stores global box information (deduplicated)
- `user_boxes` creates many-to-many relationship between users and boxes
- `last_accessed_at` tracks which box was used most recently (for default selection)
- Pre-bookings store `box_id`, `box_subdomain`, and `box_aimharder_id` for fast execution without DB lookups
- Bookings are filtered by `box_id` when fetching

## Architecture Design

### Module Structure

```
modules/
  boxes/
    api/
      services/
        box-detection.service.ts     -- Scraping & detection logic
        box.service.ts                -- CRUD operations for boxes
        box-access.service.ts         -- Validate user access to boxes
      mappers/
        box.mapper.ts                 -- API ↔ App model transformation
      models/
        box.api.ts                    -- API request/response models
    business/
      box-detection.business.ts       -- Business logic for detection
      box-management.business.ts      -- Box selection, activation logic
      box-access.business.ts          -- Access control logic
    models/
      box.model.ts                    -- App-level box models
    utils/
      html-parser.utils.ts            -- Cheerio-based HTML parsing
      url.utils.ts                    -- Query param helpers
    constants/
      box.constants.ts                -- Regex patterns, selectors
```

### API Endpoints

```typescript
// Box detection and management
POST   /api/boxes/detect              -- Detect and store user's boxes (auto on first login)
GET    /api/boxes                     -- Get all boxes for logged-in user
GET    /api/boxes/:id                 -- Get specific box (with access validation)
GET    /api/boxes/:id/validate-access -- Validate user has access to box
PATCH  /api/boxes/:id/track-access    -- Update last_accessed_at timestamp

// Bookings with box filtering
GET    /api/bookings?boxId=<uuid>     -- Get bookings for specific box (validates access)

// Pre-bookings with box filtering
GET    /api/prebookings?boxId=<uuid>  -- Get pre-bookings for specific box (validates access)
POST   /api/prebookings               -- Create pre-booking (includes boxId in body)
```

### Integration Points

**Changes Required**:

1. **Constants** (`modules/booking/constants/booking.constants.ts`):
   ```typescript
   // BEFORE (hardcoded)
   EXTERNAL_BASE_URL: 'https://crossfitcerdanyola300.aimharder.com'
   BOX_IDS: { CROSSFIT_CERDANYOLA: '10122' }

   // AFTER (dynamic from context/state)
   // Remove hardcoded values, fetch from active box
   ```

2. **Booking Service** (`modules/booking/api/services/booking.service.ts`):
   - Accept `boxSubdomain` and `boxId` as parameters
   - Build URLs dynamically: `https://${boxSubdomain}.aimharder.com/...`
   - Add `getBookingsByBox(boxId: string)` method with access validation

3. **Pre-booking Model** (`modules/prebooking/models/prebooking.model.ts`):
   ```typescript
   interface PreBooking {
     // ... existing fields
     boxId: string;              // UUID reference to boxes table
     boxSubdomain: string;       // For fast URL construction
     boxAimharderId: string;     // Aimharder's box ID (e.g., "10122")
   }
   ```

4. **Pre-booking Service** (`modules/prebooking/api/services/prebooking.service.ts`):
   - Add `getPreBookingsByBox(boxId: string)` method with access validation
   - Include box data when creating pre-bookings

5. **Auth Flow** (`modules/auth/`):
   - After successful login, check if user has boxes
   - If no boxes: trigger box detection
   - Get first box or last accessed box
   - Redirect to dashboard with `?boxId=<uuid>`

6. **URL/Query Parameter Management**:
   - Create utility to read/write `boxId` from/to URL
   - Create hook: `useBoxFromUrl()` to get current box from query params
   - Create utility to navigate with box selection: `navigateToBox(boxId: string)`

7. **Access Validation Middleware**:
   - Server-side: Validate user has access to box in API routes
   - Client-side: Validate before rendering box-specific content
   - Redirect to user's boxes if access denied

## UI/UX Design

### Dashboard Integration

**Current State**: Dashboard shows hardcoded "CrossFit Cerdanyola" card

**Proposed Changes**:

1. **Box Cards Display**:
   - Replace hardcoded card with dynamic box cards (one per user's boxes)
   - Each card shows: box name, address, logo
   - Cards are clickable to switch boxes
   - Visual highlight for currently selected box (from query param)

2. **Box Selection Flow**:
   ```
   User clicks box card
   → Update URL: navigate to /?boxId=<selected-box-uuid>
   → Update last_accessed_at in backend
   → Reload bookings/pre-bookings for selected box
   → Update UI to show selected box content
   ```

3. **Query Parameter Integration**:
   - Read `?boxId=<uuid>` from URL on page load
   - If no `boxId`: redirect to `?boxId=<default-box-uuid>`
   - If invalid `boxId` or no access: show error + redirect to valid box
   - Keep `boxId` in URL when navigating between pages

4. **"Actualizar Boxes" Button**:
   - Location: Dashboard header or box section
   - Shows loading spinner during detection
   - Toast notification on success/error
   - Maintains current `boxId` in URL after refresh

5. **Bookings/Pre-bookings Display**:
   - Filter by `boxId` from query params
   - Show box name in section header
   - If user has no access: show error message + redirect
   - Empty state if no bookings/pre-bookings for selected box

**UI Components Needed**:
- Box card component (clickable, shows active state)
- Box selector indicator (shows current box in header)
- "Actualizar boxes" button with loading state
- Toast notifications for success/error feedback
- Access denied error message component

**Note**: NO new dedicated "boxes" section/page for now. All box management happens within dashboard.

### URL Structure Examples

```
# Default (first load, no box selected)
/ → redirects to → /?boxId=abc-123-def

# Box selected
/?boxId=abc-123-def

# After clicking another box
/?boxId=xyz-789-ghi

# Invalid box or no access
/?boxId=invalid → shows error → redirects to /?boxId=<user-first-box>
```

## Clean Code Principles

- **DRY**: Single source of truth for box data (database)
- **KISS**: Simple detection flow, minimal complexity
- **YAGNI**: Only implement what's needed now (no admin panel, no advanced box management)
- **Separation of Concerns**: Detection logic separate from storage, UI separate from business logic
- **Loose Coupling**: Box detection service independent of auth/booking services
- **Single Responsibility**: Access validation logic isolated in dedicated service

## Implementation Plan

### Phase 1: Planning & Architecture (CURRENT)
- ✅ Research detection flow with Playwright
- ✅ Design database schema
- ✅ Define API endpoints
- ✅ Define query parameter strategy
- ✅ Define access validation requirements
- 🔄 Consult with sub-agents:
  - nextjs-architect: Architecture validation
  - shadcn-ui-architect: UI/UX design for box cards and switcher
  - frontend-test-engineer: Test strategy

### Phase 2: Database & Backend
1. Create Supabase migration for `boxes` and `user_boxes` tables
2. Implement box detection service (HTML scraping with cheerio)
3. Implement box CRUD service
4. Implement box access validation service
5. Create API routes (`/api/boxes/*`)
6. Update auth flow to trigger box detection on first login
7. Update booking/prebooking API routes to filter by box and validate access

### Phase 3: Frontend Integration
1. Create box models and mappers
2. Implement box context/hooks for state management
3. Create `useBoxFromUrl()` hook to read boxId from query params
4. Create URL navigation utilities for box selection
5. Update booking/prebooking to use dynamic box data
6. Remove all hardcoded references to `crossfitcerdanyola300` and `10122`
7. Implement access validation on client-side

### Phase 4: UI Implementation
1. Design and implement box card component
2. Add "Actualizar boxes" button to dashboard
3. Implement box switching via query parameters
4. Add URL-based box selection logic
5. Add loading states and toast notifications
6. Implement access denied error UI
7. Add visual indicators for selected box

### Phase 5: Testing & Validation
1. Test box detection with real user account
2. Test box switching via query parameters
3. Test access validation (both server and client side)
4. Test prebooking execution with different boxes
5. Test URL edge cases (invalid boxId, no access, etc.)
6. Validate data consistency

## Security & Access Control

### Access Validation Rules

1. **Server-side (API Routes)**:
   ```typescript
   // Example middleware/validation
   async function validateBoxAccess(userEmail: string, boxId: string): Promise<boolean> {
     const userBox = await db.user_boxes.findOne({ user_email: userEmail, box_id: boxId });
     return !!userBox;
   }
   ```

2. **Client-side (UI)**:
   ```typescript
   // Example hook
   const { hasAccess, isLoading } = useBoxAccess(boxId);
   if (!hasAccess) return <AccessDeniedError />;
   ```

3. **Booking/Pre-booking Filtering**:
   ```sql
   -- Only return bookings/prebookings for boxes user has access to
   SELECT * FROM prebookings
   WHERE user_email = $1
   AND box_id IN (SELECT box_id FROM user_boxes WHERE user_email = $1)
   AND box_id = $2;
   ```

## Open Questions

None at this time. All requirements have been clarified.

## Architecture Validation & Recommendations

### Next.js Architecture Decisions

1. **Server Components Strategy**:
   - Box detection: Server Action in `app/api/boxes/detect/route.ts`
   - Box listing: Server Component with direct DB access
   - Access validation: Server-side middleware
   - Client-side interactions: Client Components with `'use client'`

2. **Data Fetching Pattern**:
   - Use Server Actions for mutations (detect boxes, update access)
   - Use `fetch` with Next.js cache for reading boxes
   - Implement revalidation tags for cache invalidation
   - Use React Query for client-side state management

3. **URL State Management**:
   - Use Next.js `useSearchParams()` hook for reading `boxId`
   - Use `useRouter()` for navigation with query params
   - Implement parallel routes for box-specific content
   - Server-side redirect for invalid `boxId`

4. **Performance Optimizations**:
   - Cache box data with `next/cache` tags
   - Prefetch box data on hover (box cards)
   - Implement optimistic UI updates for box switching
   - Use Suspense boundaries for box-dependent content

### UI/UX Component Design

**Components to Create** (using shadcn/ui):

1. **Box Card** (`BoxCard.tsx`):
   ```tsx
   // Uses: Card, Badge, Avatar components
   // Props: box, isActive, onClick
   // Features: Hover effect, active state, loading skeleton
   ```

2. **Box Selector** (`BoxSelector.tsx`):
   ```tsx
   // Uses: DropdownMenu or Tabs components
   // Shows current box name in header
   // Allows quick switching between boxes
   ```

3. **Update Boxes Button** (`UpdateBoxesButton.tsx`):
   ```tsx
   // Uses: Button, Loader components
   // Shows loading state during detection
   // Triggers toast on success/error
   ```

4. **Access Denied Error** (`AccessDeniedError.tsx`):
   ```tsx
   // Uses: Alert, AlertTitle, AlertDescription components
   // Shows when user lacks access
   // Provides navigation to valid boxes
   ```

**Visual Design**:
- Active box: Primary color border + background tint
- Box cards: Grid layout (responsive: 1 col mobile, 2 cols tablet, 3+ cols desktop)
- Loading states: Skeleton loaders for box cards
- Transitions: Smooth fade between box content changes

### Test Strategy

**Test Coverage Plan**:

1. **Unit Tests** (Vitest + React Testing Library):
   ```
   - box-detection.service.ts: HTML parsing, pattern matching
   - box.mapper.ts: Data transformation
   - useBoxFromUrl.hook.ts: Query param extraction
   - url.utils.ts: URL construction utilities
   - BoxCard.component.tsx: Rendering, click handlers
   - UpdateBoxesButton.component.tsx: Loading states, error handling
   ```

2. **Integration Tests**:
   ```
   - /api/boxes/detect: End-to-end detection flow
   - /api/boxes: CRUD operations with DB
   - /api/boxes/:id/validate-access: Access validation
   - Box switching: URL update → content refresh
   - Auth flow: Login → box detection → redirect
   ```

3. **Mock Strategies**:
   ```typescript
   // Mock Supabase client
   vi.mock('@/core/database/supabase')

   // Mock HTML responses for cheerio parsing
   const mockBoxHTML = '<script>box: 10122</script>'

   // Mock useSearchParams
   vi.mock('next/navigation')
   ```

4. **Edge Cases to Test**:
   - Invalid `boxId` in URL → redirect to first box
   - User has no boxes → show onboarding
   - Box detection network failure → error handling
   - User tries to access another user's box → 403
   - Duplicate box detection → reuse existing box
   - Empty box name/data → validation errors

5. **Testing Utilities**:
   ```typescript
   // test/utils/box-test-helpers.ts
   export const createMockBox = (overrides?: Partial<Box>) => ({ ... })
   export const mockBoxDetection = () => { ... }
   export const createMockUserBoxes = (count: number) => { ... }
   ```

**Coverage Targets**:
- Services: 90%+ (critical business logic)
- Components: 80%+ (UI interactions)
- Hooks: 85%+ (state management)
- Overall: 80%+ (project requirement)

## Implementation Checklist

### Phase 1: Planning & Architecture ✅
- ✅ Research detection flow with Playwright
- ✅ Design database schema
- ✅ Define API endpoints
- ✅ Define query parameter strategy
- ✅ Define access validation requirements
- ✅ Architecture validation (Next.js patterns)
- ✅ UI/UX component design (shadcn/ui)
- ✅ Test strategy definition

### Phase 2: Database & Backend ✅
- ✅ Create migration: `004_create_boxes_table.sql`
- ✅ Create migration: `005_create_user_boxes_table.sql`
- ✅ Create migration: `006_alter_prebookings_add_box_fields.sql`
- ✅ Install cheerio (already installed)
- ✅ Implement `modules/boxes/api/services/box-detection.service.ts`
- ✅ Implement `modules/boxes/api/services/box.service.ts`
- ✅ Implement `modules/boxes/api/services/box-access.service.ts`
- ✅ Create API route: `app/api/boxes/detect/route.ts`
- ✅ Create API route: `app/api/boxes/route.ts`
- ✅ Create API route: `app/api/boxes/[id]/route.ts`
- ✅ Create API route: `app/api/boxes/[id]/validate-access/route.ts`
- [ ] Update auth flow to trigger box detection

### Phase 3: Frontend Models & Business Logic (NEXT)
- ✅ Create `modules/boxes/models/box.model.ts`
- ✅ Create `modules/boxes/api/models/box.api.ts`
- ✅ Create `modules/boxes/api/mappers/box.mapper.ts`
- ✅ Create `modules/boxes/utils/html-parser.utils.ts`
- ✅ Create `modules/boxes/utils/url.utils.ts`
- ✅ Create `modules/boxes/constants/box.constants.ts`
- [ ] Create `modules/boxes/business/box-management.business.ts`
- [ ] Create hook: `modules/boxes/hooks/useBoxFromUrl.hook.ts`
- [ ] Create hook: `modules/boxes/hooks/useBoxAccess.hook.ts`

### Phase 4: UI Components
- [ ] Create `modules/boxes/pods/box-card/box-card.component.tsx`
- [ ] Create `modules/boxes/pods/box-selector/box-selector.component.tsx`
- [ ] Create `modules/boxes/pods/update-boxes-button/update-boxes-button.component.tsx`
- [ ] Create `common/components/access-denied-error/access-denied-error.component.tsx`
- [ ] Update dashboard to render dynamic box cards
- [ ] Add "Actualizar boxes" button to dashboard

### Phase 5: Integration & Refactoring
- [ ] Update `modules/booking/api/services/booking.service.ts` (dynamic URLs)
- [ ] Update `modules/prebooking/models/prebooking.model.ts` (add box fields)
- [ ] Update `modules/prebooking/api/services/prebooking.service.ts` (filter by box)
- [ ] Remove hardcoded constants from `booking.constants.ts`
- [ ] Update booking/prebooking displays to filter by `boxId`
- [ ] Implement access validation in booking/prebooking routes

### Phase 6: Testing
- [ ] Write unit tests for box detection service
- [ ] Write unit tests for box CRUD service
- [ ] Write unit tests for access validation service
- [ ] Write unit tests for `useBoxFromUrl` hook
- [ ] Write component tests for box cards
- [ ] Write integration tests for API routes
- [ ] Write E2E test for box switching flow
- [ ] Verify 80%+ coverage

### Phase 7: Final Validation
- [ ] Test with real credentials (multiple boxes)
- [ ] Verify box detection accuracy
- [ ] Test access validation edge cases
- [ ] Test query parameter edge cases
- [ ] Verify prebooking execution with different boxes
- [ ] Performance check (box switching speed)
- [ ] Security audit (access control)

## Next Steps

**Immediate Actions**:
1. Create database migrations (boxes, user_boxes, prebookings update)
2. Install cheerio dependency
3. Implement box detection service
4. Create API routes for box management

---

**Last Updated**: 2025-10-03
**Phase**: Implementation - Frontend Hooks & Business Logic

## Progress Summary

### Completed ✅
- ✅ Database schema design and migrations (boxes, user_boxes, prebookings.box_id)
- ✅ Database types updated with new tables
- ✅ Box detection service with Cheerio HTML parsing
- ✅ Box CRUD service with Supabase
- ✅ Box access validation service
- ✅ API routes for box management (`/api/boxes/*`)
- ✅ Frontend models, mappers, and utilities
- ✅ Business logic layer for box management
- ✅ React hooks: `useBoxes`, `useBoxFromUrl`, `useBoxAccess`
- ✅ QStash payload updated to include box data (subdomain, aimharderId)
- ✅ PreBooking model updated with `boxId` reference
- ✅ PreBooking service updated to accept and filter by `boxId`
- ✅ Booking service updated to accept dynamic `boxSubdomain`
- ✅ Booking API route updated to pass boxId and box data to QStash
- ✅ Execute-prebooking API updated to use box data from QStash payload
- ✅ Prebooking API updated to filter by `boxId`

### UI & Auth Integration ✅
- ✅ Auth flow updated to detect boxes in background after login
- ✅ BoxCard component created with shadcn/ui
- ✅ UpdateBoxesButton component created with loading states
- ✅ AccessDeniedError component created
- ✅ Dashboard updated to show dynamic box cards
- ✅ Dashboard allows user to choose box (no automatic redirect)
- ✅ Box navigation via query parameters implemented
- ✅ Session API route created (`GET /api/auth/session`)

### Testing & Validation (Pending)
- ⏳ Test box detection on first login
- ⏳ Test box switching via cards
- ⏳ Test "Actualizar boxes" button
- ⏳ Test prebooking creation with box data
- ⏳ Test prebooking execution with QStash payload
- ⏳ End-to-end validation with real user

### Implementation Details

**Box Data in QStash Payload**:
- Box subdomain and aimharderId are now included in QStash payload
- No need to store box data in prebookings table (only box_id reference)
- QStash payload structure:
  ```json
  {
    "prebookingId": "uuid",
    "boxSubdomain": "crossfitcerdanyola300",
    "boxAimharderId": "10122"
  }
  ```

**Prebooking Changes**:
- Added `boxId` field to PreBooking model (for filtering and access validation)
- Updated `CreatePreBookingInput` to require `boxId`
- Updated `findByUser` to optionally filter by `boxId`
- Removed `box_subdomain` and `box_aimharder_id` from migration (data lives in QStash)

### Next Steps
1. Update booking API route to pass boxId and box data when creating prebooking
2. Update execute-prebooking API to use box data from QStash payload
3. Update auth flow for automatic box detection on first login
4. Create UI components (box cards, selector, update button)
5. Integrate box selection via query parameters in dashboard
