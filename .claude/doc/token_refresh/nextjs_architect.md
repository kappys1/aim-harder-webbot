# TokenUpdate Feature - Next.js Architectural Plan

## Overview

Implementation plan for the tokenUpdate feature to maintain active authentication sessions through automatic token refresh. This feature is **ADDITIONAL** to the existing setrefresh functionality and follows the project's established patterns.

## Architecture Analysis

### Existing Authentication Infrastructure

**Current Services:**
- `AimharderRefreshService` - Handles setrefresh endpoint (KEEP UNCHANGED)
- `SupabaseSessionService` - Database operations for auth_sessions table
- `CookieService` - Cookie extraction and management
- `AimharderAuthService` - Main authentication service

**Database Schema:**
- `auth_sessions` table with existing fields: `user_email`, `aimharder_token`, `aimharder_cookies`
- Refresh tracking: `last_refresh_date`, `refresh_count`, `last_refresh_error`

**Current Endpoints:**
- `/api/auth/refresh` - Existing refresh endpoint using setrefresh (DO NOT MODIFY)

## Implementation Plan

### 1. API Endpoint Structure

**Route**: `/app/api/tokenUpdate/route.ts` (Root level, NOT under /api/auth/)

```typescript
// POST /api/tokenUpdate
// Parameters: { fingerprint: string, token: string }
// Response: { newToken: string } | { logout: 1 }
// Headers: AWSALB, AWSALBCORS cookie updates
```

### 2. Service Layer Architecture

#### 2.1 New TokenUpdate Service

**File**: `/modules/auth/api/services/aimharder-token-update.service.ts`

**Responsibilities:**
- Make external API calls to `https://aimharder.com/api/tokenUpdate`
- Handle response parsing for newToken or logout scenarios
- Extract cookie headers (AWSALB, AWSALBCORS) from response
- Error handling and retry logic

**Interface:**
```typescript
export interface TokenUpdateRequest {
  fingerprint: string;
  token: string;
}

export interface TokenUpdateResponse {
  success: boolean;
  newToken?: string;
  logout?: boolean;
  updatedCookies?: AuthCookie[];
  error?: string;
}
```

#### 2.2 Enhanced Supabase Session Service

**Extend**: `/modules/auth/api/services/supabase-session.service.ts`

**New Methods:**
- `updateTokenAndCookies(email: string, newToken: string, cookies: AuthCookie[])`
- `getAllActiveSessionsForTokenUpdate(): Promise<SessionData[]>`
- `updateTokenUpdateData(email: string, success: boolean, error?: string)`

### 3. Database Update Strategy

#### 3.1 Token and Cookie Updates

**Atomic Operations:**
- Update `aimharder_token` with new token value
- Update `aimharder_cookies` JSONB field with AWSALB, AWSALBCORS
- Update `updated_at` timestamp
- Track token update operations separately from setrefresh

#### 3.2 New Tracking Fields (Optional Enhancement)

Consider adding to `auth_sessions` table:
- `last_token_update_date` - Track token update operations
- `token_update_count` - Count successful token updates
- `last_token_update_error` - Track token update errors

### 4. Error Handling Approach

#### 4.1 Response Scenarios

**Success Response**: `{"newToken": "69232|1766907797|f3069323e00d81750c8590bb1f5f93b6"}`
- Update database with new token
- Extract and update cookies from response headers
- Return success status

**Logout Response**: `{logout: 1}`
- Delete session from database
- Log logout event
- Return logout status for client handling

**Network/API Errors:**
- Retry logic with exponential backoff
- Log errors for monitoring
- Preserve existing session data

#### 4.2 Validation Strategy

**Input Validation:**
- Validate fingerprint format
- Validate token format and structure
- Sanitize parameters for external API call

**Response Validation:**
- Validate newToken format if present
- Validate logout flag
- Validate cookie structure from headers

### 5. GitHub Actions Workflow Design

#### 5.1 Cron Job Structure

**File**: `.github/workflows/token-update.yml`

**Schedule**: Every 15 minutes (`*/15 * * * *`)

**Workflow Steps:**
1. **Fetch Active Sessions** - Get all sessions from Supabase
2. **Token Update Loop** - Process each session individually
3. **Error Handling** - Log failures, continue processing
4. **Cleanup** - Remove expired/invalid sessions
5. **Reporting** - Summary of operations

#### 5.2 Security Considerations

**Environment Variables:**
- `SUPABASE_SERVICE_ROLE_KEY` - Database access
- `AIMHARDER_API_BASE_URL` - External API endpoint
- `TOKEN_UPDATE_SECRET` - Optional API authentication

**Rate Limiting:**
- Batch processing with delays between requests
- Respect external API rate limits
- Implement circuit breaker pattern

### 6. Integration Points

#### 6.1 Separation from Existing Refresh

**Clear Separation:**
- TokenUpdate: Automated, parameter-based (fingerprint + token)
- SetRefresh: Manual, email-based, login-required operation
- Both update the same database fields but serve different purposes

#### 6.2 Cookie Management

**Cookie Synchronization:**
- Extract AWSALB, AWSALBCORS from response headers
- Merge with existing cookies in database
- Preserve other cookie values (session cookies, etc.)

### 7. Testing Strategy

#### 7.1 Unit Tests

**Service Tests:**
- `AimharderTokenUpdateService` - Mock external API calls
- `SupabaseSessionService` extensions - Database operations
- Cookie extraction and merging logic

#### 7.2 Integration Tests

**API Endpoint Tests:**
- Valid token update scenarios
- Logout response handling
- Error scenarios and edge cases
- Database state verification

#### 7.3 GitHub Actions Tests

**Workflow Tests:**
- Mock Supabase responses
- Test batch processing logic
- Error handling and recovery
- Rate limiting compliance

### 8. Monitoring and Observability

#### 8.1 Logging Strategy

**Structured Logging:**
- Token update attempts and results
- Processing time metrics
- Error categorization and frequency
- Session lifecycle events

#### 8.2 Metrics Collection

**Key Metrics:**
- Token update success rate
- Processing time per session
- Active session count trends
- Error rate by category

### 9. Implementation Phases

#### Phase 1: Core Service Implementation
- Create `AimharderTokenUpdateService`
- Extend `SupabaseSessionService`
- Implement `/api/tokenUpdate` endpoint

#### Phase 2: GitHub Actions Integration
- Create workflow configuration
- Implement batch processing logic
- Add error handling and reporting

#### Phase 3: Monitoring and Optimization
- Add comprehensive logging
- Implement metrics collection
- Performance optimization

## File Structure

```
modules/auth/api/services/
├── aimharder-token-update.service.ts    # NEW - Token update logic
├── supabase-session.service.ts          # EXTEND - Add token update methods
├── aimharder-refresh.service.ts         # NO CHANGES - Keep existing
└── cookie.service.ts                    # POSSIBLE EXTENSION - Cookie merging

app/api/
├── tokenUpdate/
│   └── route.ts                         # NEW - Root level endpoint
└── auth/refresh/
    └── route.ts                         # NO CHANGES - Keep existing

.github/workflows/
└── token-update.yml                     # NEW - Cron job configuration
```

## Key Architectural Decisions

### 1. Root Level Endpoint
- `/api/tokenUpdate` (not `/api/auth/tokenUpdate`) as specified
- Separate from auth namespace to distinguish from manual refresh operations

### 2. Service Separation
- New service for token update logic
- Keep existing refresh service unchanged
- Shared cookie and session management utilities

### 3. Database Strategy
- Reuse existing `auth_sessions` table structure
- Add optional tracking fields for token update operations
- Atomic updates for token and cookie changes

### 4. Error Handling
- Graceful degradation on API failures
- Session preservation during temporary errors
- Automatic logout handling for invalid tokens

### 5. GitHub Actions Design
- Independent workflow from existing processes
- Batch processing with proper error isolation
- Comprehensive logging for debugging

## Clarifications Needed

Before implementation, please clarify:

1. **Fingerprint Source**: Should the fingerprint be:
   - Retrieved from environment variables (like existing setrefresh)?
   - Stored per session in database?
   - Generated dynamically?

2. **Cookie Handling Strategy**: When updating cookies, should we:
   - Replace all cookies with new AWSALB/AWSALBCORS values?
   - Merge new cookies with existing ones?
   - Preserve specific cookie types?

3. **Logout Handling**: When receiving `{logout: 1}`, should we:
   - Delete the session immediately?
   - Mark it as expired and cleanup later?
   - Notify the user somehow?

4. **Rate Limiting**: Are there specific rate limits for the external API:
   - Requests per minute/hour?
   - Concurrent request limits?
   - Required delays between requests?

5. **Monitoring Requirements**: What level of monitoring is needed:
   - Real-time alerts on failures?
   - Daily/weekly reports?
   - Integration with existing monitoring tools?

## Performance Considerations

### 1. Batch Processing
- Process sessions in manageable chunks
- Implement delays to avoid overwhelming external API
- Use parallel processing where safe

### 2. Database Optimization
- Use prepared statements for repeated operations
- Implement connection pooling
- Consider read replicas for session queries

### 3. Caching Strategy
- Cache fingerprint values if static
- Consider session data caching for frequent operations
- Implement circuit breaker for external API calls

### 4. Scalability
- Design for horizontal scaling of GitHub Actions
- Implement distributed processing if session count grows
- Consider queuing system for large-scale operations

This architectural plan provides a comprehensive foundation for implementing the tokenUpdate feature while maintaining clean separation from existing functionality and following established project patterns.