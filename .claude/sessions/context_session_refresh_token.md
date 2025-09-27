# Context Session: Refresh Token Implementation

## Overview
Implementing refresh token functionality to maintain active aimharder sessions automatically, both from client-side (daily user access) and server-side (automated background reservations).

## Requirements Analysis

### API Integration Requirements
- **Endpoint**: GET to https://aimharder.com/setrefresh
- **Parameters**:
  - `token`: Current session token from database
  - `fingerprint`: Fixed value 'my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb'
- **Required Cookies**: Use stored AWSALB, AWSALBCORS, PHPSESSID, amhrdrauth from database
- **Content-Type**: Standard GET request with query parameters

### Expected Response
- **Success Response**: HTML with script containing:
  ```html
  <script>
      localStorage.setItem("refreshToken", "69232|1766731601|03485f300f1a53a7e34143a0af9d2592");
      localStorage.setItem("fingerprint", "my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb");
  </script>
  ```
- **Result**: Same token and fingerprint values (no update needed)
- **Purpose**: Extends session validity period

### Use Cases

#### 1. Client-Side Refresh
- **Trigger**: Daily when user accesses application
- **Purpose**: Keep user sessions active for manual operations
- **Implementation**: Check last refresh date, auto-refresh if needed

#### 2. Server-Side Automatic Refresh
- **Trigger**: Automated background process for reservation system
- **Purpose**: Maintain sessions for automatic reservations when:
  - Reservations can't be made immediately (4-day rule)
  - Background reservation system needs active cookies
- **Implementation**: Scheduled job to refresh all active sessions

### Architecture Considerations
- **Cookie Management**: Use existing stored cookies from Supabase
- **Session Tracking**: Update last_refresh_date in database
- **Error Handling**: Handle refresh failures and session expiration
- **Automation**: Server-side cron job or scheduled function
- **Logging**: Track refresh success/failure rates

## Implementation Strategy

### Phase 1: Core Refresh Service
1. Create RefreshTokenService for aimharder refresh calls
2. Extend SupabaseSessionService to track refresh dates
3. Add refresh token parsing from HTML response

### Phase 2: API Routes
1. Create `/api/auth/refresh` endpoint for manual refresh
2. Create `/api/internal/refresh-sessions` for automated refresh
3. Implement proper error handling and logging

### Phase 3: Client Integration
1. Add refresh logic to useLogin hook
2. Implement automatic daily refresh check
3. Add manual refresh button for testing

### Phase 4: Server Automation
1. Create scheduled background job
2. Implement batch refresh for all active sessions
3. Add monitoring and alerting for failed refreshes

### Phase 5: Database Updates
1. Add refresh tracking fields to auth_sessions table
2. Update session management to handle refresh data
3. Add cleanup for failed refresh sessions

## Technical Requirements

### Database Schema Updates
```sql
ALTER TABLE auth_sessions ADD COLUMN last_refresh_date TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN refresh_count INTEGER DEFAULT 0;
ALTER TABLE auth_sessions ADD COLUMN last_refresh_error TEXT;
```

### Environment Variables
- Existing AIMHARDER_LOGIN_URL base for refresh endpoint
- Existing AIMHARDER_FINGERPRINT for refresh calls

### Dependencies
- Use existing cheerio for HTML parsing
- Use existing cookie management services
- Use existing Supabase integration

## Success Criteria
- ✅ Manual refresh works from client
- ✅ Automatic server refresh maintains all active sessions
- ✅ Failed refreshes are properly logged and handled
- ✅ Database tracks refresh history and statistics
- ✅ Background reservation system has always-valid cookies

## Subagent Recommendations Summary

### NextJS Architect Recommendations:
- **Database Schema Extensions**: Add refresh tracking fields (last_refresh_date, refresh_count, last_refresh_error, auto_refresh_enabled)
- **Service Layer**: New AimharderRefreshService + enhanced SupabaseSessionService
- **API Route Strategy**:
  - Manual: `/api/auth/refresh/route.ts`
  - Automated: `/api/internal/refresh-sessions/route.ts` with API key protection
- **Background Automation**: Vercel Cron Jobs or external cron service
- **Performance**: Batch processing (10-20 sessions), rate limiting, exponential backoff

### Frontend Test Engineer Recommendations:
- **TDD Approach**: Complete test framework setup needed (Vitest, RTL, MSW)
- **Critical Test Areas**: HTML parsing for localStorage extraction, cookie validation, batch processing
- **Mock Strategy**: MSW for realistic API responses, factory patterns for test data
- **Coverage Targets**: 80% overall, 95% for critical paths, 90% error handling

### Key Questions to Clarify:
1. **Refresh Frequency**: How often should automatic refresh run? (Recommended: 4-6 hours)
2. **Session Extension**: Should refreshed sessions extend beyond 7-day limit?
3. **Batch Size**: How many sessions per batch? (Recommended: 10-20)
4. **Error Recovery**: What happens when refresh fails multiple times?
5. **Monitoring Level**: What monitoring/alerting is needed?

## Implementation Status (Updated)

### Phase 1: Core Infrastructure ✅ COMPLETED
1. ✅ Database schema updates with refresh tracking fields
2. ✅ AimharderRefreshService implementation
3. ✅ Enhanced SupabaseSessionService with refresh methods
4. ✅ Manual refresh API route (`/api/auth/refresh`)

### Phase 2: Client Integration ✅ COMPLETED
1. ✅ useRefreshToken hook implementation
2. ❌ Auth context enhancements (No existing context found)
3. ✅ UI components for refresh indicators
4. ✅ Client-side daily refresh logic (auto-refresh in hook)

### Phase 3: Server Automation ✅ COMPLETED
1. ✅ Automated refresh API route (`/api/internal/refresh-sessions`)
2. ✅ Background job service with batch processing
3. ✅ Cron job configuration (GitHub Actions - FREE alternative)
4. ✅ Rate limiting and retry strategies

### Phase 4: Testing & Monitoring ⏳ PENDING
1. ⏳ Comprehensive test suite following TDD approach
2. ⏳ Performance testing for batch operations
3. ⏳ Error monitoring and alerting
4. ⏳ Health check endpoints and metrics

## Implementation Complete Features
- Database schema with refresh tracking fields
- Simple and efficient refresh service (KISS principle)
- Manual refresh API endpoint with proper error handling
- Automated batch refresh API for background jobs
- React hook for client-side refresh management
- UI component with status indicators and manual refresh
- Auto-refresh functionality built into the hook

## Next Steps for Production
1. Set up cron job for automated refresh (every 6 hours recommended)
2. Add environment variable INTERNAL_API_KEY for batch refresh security
3. Test end-to-end refresh flow
4. Monitor refresh success rates and adjust thresholds if needed

## NextJS Architect Analysis

### Current Architecture Strengths
- **Well-structured auth module** with service layer pattern
- **Existing session management** via SupabaseSessionService
- **HTML parsing capabilities** already implemented
- **Cookie management** service in place
- **API route structure** follows Next.js App Router pattern

### Recommended Implementation Approach

#### 1. Database Schema Extensions
- Add refresh tracking fields to existing `auth_sessions` table
- Fields: `last_refresh_date`, `refresh_count`, `last_refresh_error`, `auto_refresh_enabled`
- Maintain backward compatibility with existing schema

#### 2. Service Layer Architecture
- **New Service**: `AimharderRefreshService` for refresh-specific operations
- **Enhanced Service**: Extend `SupabaseSessionService` with refresh methods
- **Reuse**: Leverage existing `HtmlParserService` for response parsing
- **Pattern**: Follow established service layer patterns

#### 3. API Route Strategy
- **Manual Refresh**: `/api/auth/refresh/route.ts` for client-side operations
- **Automated Refresh**: `/api/internal/refresh-sessions/route.ts` for server-side batch operations
- **Security**: Internal API key protection for automation endpoints
- **Pattern**: Follow existing `/api/auth/aimharder/route.ts` structure

#### 4. Client-Side Integration
- **Hook**: `useRefreshToken.hook.tsx` for refresh state management
- **Context**: Enhance existing auth context with refresh capabilities
- **UI**: Add refresh status indicators and manual refresh controls
- **Pattern**: Follow existing auth context and hook patterns

#### 5. Server-Side Automation
- **Background Service**: `refresh-automation.service.ts` for batch processing
- **Cron Integration**: Vercel Cron Jobs or external cron service
- **Batch Processing**: Handle multiple sessions efficiently
- **Error Handling**: Comprehensive error tracking and recovery

### Key Architectural Decisions

#### Cookie Management Strategy
- **Reuse existing** cookie storage in Supabase
- **Maintain security** with httpOnly and secure flags
- **Update selectively** only when cookies change during refresh

#### Session Validity Logic
- **Current**: 7-day validity based on creation date
- **Enhanced**: Consider refresh dates for extended validity
- **Automatic**: Background refresh extends session life
- **Manual**: User activity triggers refresh checks

#### Error Handling Approach
- **Network Errors**: Retry with exponential backoff
- **Auth Errors**: Mark session invalid, require re-login
- **Rate Limiting**: Implement intelligent refresh scheduling
- **Partial Failures**: Continue processing successful refreshes

#### Performance Optimization
- **Batch Processing**: Process 10-20 sessions per batch
- **Rate Limiting**: Respect aimharder server constraints
- **Database Optimization**: Efficient queries for session management
- **Caching**: Temporary result caching for recent refreshes

### Implementation Priority

#### Phase 1: Core Infrastructure (High Priority)
1. Database schema updates
2. `AimharderRefreshService` implementation
3. Enhanced `SupabaseSessionService` with refresh methods
4. Manual refresh API route (`/api/auth/refresh`)

#### Phase 2: Client Integration (Medium Priority)
1. `useRefreshToken` hook implementation
2. Auth context enhancements
3. UI components for refresh status
4. Client-side daily refresh logic

#### Phase 3: Server Automation (Medium Priority)
1. Automated refresh API route (`/api/internal/refresh-sessions`)
2. Background job service implementation
3. Cron job configuration
4. Batch processing optimization

#### Phase 4: Monitoring (Low Priority)
1. Refresh metrics collection
2. Error monitoring and alerting
3. Performance dashboards
4. Health check endpoints

### Questions for Client Clarification
1. **Refresh Frequency**: How often should automatic refresh run? (Recommended: every 4-6 hours)
2. **Session Extension**: Should refreshed sessions extend beyond 7-day limit?
3. **Error Recovery**: What happens when refresh fails multiple times?
4. **Batch Size**: How many sessions per batch? (Recommended: 10-20)
5. **Monitoring Level**: What monitoring/alerting is needed?
6. **Manual Override**: Should users have manual refresh option when auto-refresh fails?

### Risk Mitigation Strategies
- **API Changes**: Monitor aimharder endpoint for changes
- **Rate Limiting**: Implement intelligent batching and spacing
- **Performance**: Optimize database queries and batch sizes
- **Fallback**: Ensure manual refresh always available
- **Testing**: Comprehensive test coverage for all scenarios