# Token Refresh Feature - Context Session

## Initial Analysis

### Feature Overview
Implementing an automatic token refresh system to maintain active authentication sessions.

### Requirements
1. **Endpoint Implementation**: POST `/api/tokenUpdate`
   - Parameters: `fingerprint`, `token` (from supabase aimharder_token)
   - Success Response (200): `{"newToken": "69232|1766907797|f3069323e00d81750c8590bb1f5f93b6"}`
   - Error Response: `{logout: 1}`

2. **Database Updates**:
   - Update `aimharder_token` with new token value
   - Update cookie headers: `AWSALB` and `AWSALBCORS` from response

3. **Automation**:
   - Token expires every 1.5 hours
   - Cron job every 15 minutes via GitHub Actions
   - Automatic endpoint calling

### Current Codebase Analysis - COMPLETED

**Authentication Structure:**
- `AimharderAuthService` - Main auth service with login, logout, refresh methods
- `SupabaseSessionService` - Database operations for auth_sessions table
- `AimharderRefreshService` - Existing refresh mechanism using setrefresh endpoint (MANTENER)
- `CookieService` - Cookie extraction and management
- Token stored in Supabase as `aimharder_token` field

**Database Schema:**
- `auth_sessions` table with: `user_email`, `aimharder_token`, `aimharder_cookies` (JSONB)
- Support for refresh tracking: `last_refresh_date`, `refresh_count`, `last_refresh_error`

**Existing API Structure:**
- `/api/auth/refresh` - Current refresh endpoint (requires email parameter)
- Uses existing `AimharderRefreshService.refreshSession()` method
- Calls `setrefresh` endpoint - **OBLIGATORIO en cada login - NO TOCAR**

**New tokenUpdate Implementation:**
- **ADICIONAL** al setrefresh existente
- Endpoint: POST `/api/tokenUpdate`
- Parameters: `fingerprint` + `token` (from aimharder_token in Supabase)
- Response: `{"newToken":"xxx"}` or `{logout: 1}`
- Update: `aimharder_token` + cookie headers (AWSALB, AWSALBCORS)
- Automated: Cron job every 15 minutes via GitHub Actions
- Purpose: Keep session alive (token expires every 1.5 hours)

## Architectural Plan - COMPLETED

### Implementation Strategy

**NextJS Architect Consultation:**
- Analyzed existing authentication infrastructure and patterns
- Reviewed project's feature-based architecture with hexagonal principles
- Identified separation requirements from existing setrefresh functionality

**Technical Architecture Defined:**

1. **API Endpoint Structure**
   - Route: `/app/api/tokenUpdate/route.ts` (Root level as specified)
   - Input: `{ fingerprint: string, token: string }`
   - Output: `{ newToken: string } | { logout: 1 }`
   - Cookie header updates: AWSALB, AWSALBCORS

2. **Service Layer Architecture**
   - New `AimharderTokenUpdateService` for external API calls
   - Extension of `SupabaseSessionService` for database operations
   - Reuse existing `CookieService` for cookie management
   - Complete separation from existing `AimharderRefreshService`

3. **Database Update Strategy**
   - Atomic updates to `aimharder_token` and `aimharder_cookies`
   - Optional new tracking fields for token update operations
   - Preserve existing refresh tracking for setrefresh functionality

4. **GitHub Actions Workflow**
   - Cron schedule: Every 15 minutes (`*/15 * * * *`)
   - Batch processing of all active sessions
   - Error handling with session preservation
   - Comprehensive logging and monitoring

5. **Error Handling Approach**
   - Success: Update token and cookies in database
   - Logout response: Delete session from database
   - Network errors: Retry with exponential backoff
   - Input validation and response sanitization

### Key Architectural Decisions

1. **Clean Separation**: TokenUpdate is completely separate from setrefresh
2. **Root Level Endpoint**: `/api/tokenUpdate` not under auth namespace
3. **Service Pattern**: Follow existing service layer architecture
4. **Database Reuse**: Extend existing auth_sessions table structure
5. **Automation Design**: GitHub Actions with proper error isolation

### Implementation Plan Created

Comprehensive architectural documentation created at:
**`.claude/doc/token_refresh/nextjs_architect.md`**

This document includes:
- Detailed service layer design
- Database update strategies
- GitHub Actions workflow configuration
- Error handling approaches
- Testing strategies
- Monitoring and observability plans
- File structure and implementation phases

### Clarifications Needed

Before implementation begins, the following need clarification:
1. **Fingerprint source** - Environment variable vs per-session storage
2. **Cookie handling strategy** - Replace vs merge approach
3. **Logout handling** - Immediate deletion vs marking expired
4. **Rate limiting** - External API constraints and requirements
5. **Monitoring requirements** - Level of observability needed

### Ready for Implementation

The architectural foundation is complete and ready for the implementation phase. All patterns follow the project's established conventions and maintain clean separation from existing functionality.

## Implementation Plan - FINAL

### Phase 1: Core Implementation
1. **Create AimharderTokenUpdateService** - Handle external API calls to aimharder.com/api/tokenUpdate
2. **Extend SupabaseSessionService** - Add methods for token update operations
3. **Create API endpoint** - `/app/api/tokenUpdate/route.ts` with POST method
4. **Cookie handling** - Extract and update AWSALB, AWSALBCORS headers

### Phase 2: Database & Service Layer
1. **Database extensions** - Add token update tracking fields if needed
2. **Service integration** - Connect API endpoint to service layer
3. **Error handling** - Implement comprehensive error responses
4. **Input validation** - Validate fingerprint and token parameters

### Phase 3: Automation
1. **GitHub Actions workflow** - Create cron job for every 15 minutes
2. **Batch processing** - Handle all active sessions automatically
3. **Monitoring** - Add logging and error tracking
4. **Testing** - Integration tests for automation

### Phase 4: Testing & Validation
1. **Unit tests** - Service layer and API endpoint tests
2. **Integration tests** - Database operations and external API calls
3. **E2E tests** - Full workflow including cron job
4. **QA validation** - Final acceptance criteria verification

### Ready to Execute
- All architectural decisions are finalized
- Service layer design is complete
- Database strategy is defined
- Automation plan is ready
- Testing approach is established

**Status: IMPLEMENTATION COMPLETED**

## Final Implementation Summary

### ✅ Core Implementation Completed
1. **AimharderTokenUpdateService** - Service for external API calls to aimharder.com/api/tokenUpdate
2. **Extended SupabaseSessionService** - Added token update methods and session filtering
3. **API Endpoint** - `/app/api/tokenUpdate/route.ts` with POST and GET methods
4. **Cookie handling** - AWSALB and AWSALBCORS header extraction and updates

### ✅ Database & Service Layer Completed
1. **Database extensions** - Added `updateTokenAndCookies()`, `getSessionsNeedingTokenUpdate()` methods
2. **Service integration** - API endpoint connected to service layer with error handling
3. **Optimized updates** - Only sessions not updated in last 15 minutes are processed
4. **Input validation** - Comprehensive parameter validation and response sanitization

### ✅ Frontend Auto-Refresh Completed
1. **useAutoTokenRefresh Hook** - Custom hook for automatic token refresh every 15 minutes
2. **AutoTokenRefresh Component** - Silent component for integration into app root
3. **localStorage Integration** - Uses existing user-email pattern from project
4. **Automatic Logout** - Handles session expiration and cleanup

### ✅ Automation Completed
1. **GitHub Actions workflow** - `/github/workflows/token-refresh.yml` with cron job every 15 minutes
2. **Batch processing** - Optimized to handle only sessions needing updates
3. **Comprehensive monitoring** - Logging, statistics, and failure notifications
4. **Manual triggers** - Support for manual testing via workflow_dispatch

### Key Features Implemented

**Frontend Auto-Refresh (Every 15 minutes for active users):**
- Automatic token refresh for logged-in users
- Session validation and cleanup
- Error handling with automatic logout
- Debug mode for development

**Backend Optimization:**
- Only updates sessions not refreshed in last 15 minutes
- Efficient database queries with proper filtering
- Maintains separation from existing setrefresh functionality
- Complete cookie management (AWSALB, AWSALBCORS)

**Automation:**
- GitHub Actions cron job every 15 minutes
- Processes only sessions needing updates
- Comprehensive error handling and monitoring
- Discord notifications on failures (optional)

### Integration Points

**To integrate the frontend auto-refresh:**
1. Import `AutoTokenRefresh` component in app root layout
2. Add `<AutoTokenRefresh />` to render tree
3. Component automatically starts when user is logged in
4. Uses existing `user-email` localStorage pattern

**Environment Variables Required:**
- `NEXT_PUBLIC_AIMHARDER_FINGERPRINT` - For frontend calls
- `AIMHARDER_FINGERPRINT` - For backend calls
- `APP_URL` - For GitHub Actions
- `DISCORD_WEBHOOK_URL` - For failure notifications (optional)

### Status: READY FOR TESTING & QA VALIDATION