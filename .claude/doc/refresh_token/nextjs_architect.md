# Next.js Refresh Token System - Implementation Plan

## Overview

Implementation plan for aimharder refresh token system to maintain active sessions automatically. This system supports both client-side daily refresh and server-side automated refresh for background reservations.

## Current Architecture Analysis

### Existing Auth Module Structure
```
modules/auth/
├── api/
│   ├── services/
│   │   ├── aimharder-auth.service.ts       # Main auth service
│   │   ├── supabase-session.service.ts     # Session management
│   │   ├── html-parser.service.ts          # HTML parsing utilities
│   │   └── cookie.service.ts               # Cookie management
│   ├── mappers/
│   └── models/
├── pods/login/
└── views/
```

### Database Schema (auth_sessions table)
- `user_email`: User identifier
- `aimharder_token`: Current session token
- `aimharder_cookies`: Stored cookies array
- `created_at`: Session creation timestamp
- `updated_at`: Last update timestamp

## Implementation Plan

### Phase 1: Core Refresh Infrastructure

#### 1.1 Database Schema Updates

**Required columns for refresh tracking:**
```sql
ALTER TABLE auth_sessions ADD COLUMN last_refresh_date TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN refresh_count INTEGER DEFAULT 0;
ALTER TABLE auth_sessions ADD COLUMN last_refresh_error TEXT;
ALTER TABLE auth_sessions ADD COLUMN auto_refresh_enabled BOOLEAN DEFAULT true;
```

#### 1.2 Refresh Token Service

**New service: `aimharder-refresh.service.ts`**
- GET request to `https://aimharder.com/setrefresh`
- Parameters: `token` and `fingerprint`
- Use stored cookies from database
- Parse HTML response for localStorage.setItem calls
- Update session refresh tracking

#### 1.3 Enhanced Session Service

**Extend `SupabaseSessionService`:**
- Add refresh tracking methods
- Update session validity logic to consider refresh dates
- Add batch operations for server-side refresh

### Phase 2: API Routes Implementation

#### 2.1 Manual Refresh Endpoint
**Route: `/api/auth/refresh/route.ts`**
- POST method for manual refresh
- GET method for refresh status check
- Input validation and rate limiting
- Client-side accessible

#### 2.2 Automated Refresh Endpoint
**Route: `/api/internal/refresh-sessions/route.ts`**
- POST method for batch refresh
- Internal-only access (API key protection)
- Background job compatible
- Batch processing with error handling

#### 2.3 Session Management Updates
**Enhance `/api/auth/aimharder/route.ts`:**
- Add refresh status to session checks
- Include refresh recommendations

### Phase 3: Client-Side Integration

#### 3.1 Refresh Hook
**New hook: `useRefreshToken.hook.tsx`**
- Daily refresh check logic
- Manual refresh trigger
- Refresh status tracking
- Error handling and user feedback

#### 3.2 Auth Context Updates
**Enhance existing auth context:**
- Include refresh state
- Automatic daily refresh logic
- Session health monitoring

#### 3.3 UI Components
**Refresh indicators and controls:**
- Refresh status display
- Manual refresh button
- Last refresh timestamp
- Error notifications

### Phase 4: Server-Side Automation

#### 4.1 Background Job Service
**New service: `refresh-automation.service.ts`**
- Scheduled refresh execution
- Batch processing logic
- Error aggregation and reporting
- Performance monitoring

#### 4.2 Cron Job Implementation
**Options:**
1. **Vercel Cron Jobs** (if using Vercel)
2. **Next.js API route with external cron service**
3. **Supabase Edge Functions** (alternative)

#### 4.3 Monitoring and Alerting
- Refresh success/failure metrics
- Session health dashboard
- Automated alerts for system issues

## Technical Specifications

### 1. Refresh Token Service Implementation

```typescript
// modules/auth/api/services/aimharder-refresh.service.ts
export interface RefreshRequest {
  email: string;
  token: string;
  fingerprint: string;
  cookies: AuthCookie[];
}

export interface RefreshResponse {
  success: boolean;
  refreshed: boolean;
  newToken?: string;
  newFingerprint?: string;
  error?: string;
}

export class AimharderRefreshService {
  static async refreshSession(request: RefreshRequest): Promise<RefreshResponse>
  static async parseRefreshResponse(html: string): Promise<{token?: string, fingerprint?: string}>
  static async validateRefreshResponse(html: string): boolean
}
```

### 2. Enhanced Session Service

```typescript
// Extend SupabaseSessionService with refresh methods
export interface SessionData {
  // ... existing fields
  lastRefreshDate?: string;
  refreshCount?: number;
  lastRefreshError?: string;
  autoRefreshEnabled?: boolean;
}

export class SupabaseSessionService {
  // ... existing methods
  static async updateRefreshTracking(email: string, refreshData: RefreshTrackingData): Promise<void>
  static async getSessionsNeedingRefresh(): Promise<SessionData[]>
  static async batchRefreshSessions(sessions: SessionData[]): Promise<RefreshResult[]>
}
```

### 3. API Route Structure

```typescript
// app/api/auth/refresh/route.ts
export async function POST(request: NextRequest) {
  // Manual refresh for authenticated users
  // Validate user session
  // Perform refresh
  // Return updated session status
}

export async function GET(request: NextRequest) {
  // Get refresh status for user
  // Return last refresh date, next refresh due, etc.
}

// app/api/internal/refresh-sessions/route.ts
export async function POST(request: NextRequest) {
  // Batch refresh for automation
  // Validate API key
  // Process all sessions needing refresh
  // Return summary results
}
```

### 4. Client-Side Hook

```typescript
// modules/auth/pods/refresh/hooks/useRefreshToken.hook.tsx
export interface RefreshTokenState {
  lastRefreshDate?: Date;
  isRefreshing: boolean;
  needsRefresh: boolean;
  error?: string;
  canRefresh: boolean;
}

export function useRefreshToken() {
  // Auto-refresh logic
  // Manual refresh function
  // Refresh status management
  // Error handling
}
```

## Architecture Considerations

### 1. Cookie Management Strategy
- **Storage**: Continue using Supabase for cookie persistence
- **Refresh Process**: Use stored cookies for refresh requests
- **Updates**: Update cookies only if changed during refresh
- **Security**: Maintain existing httpOnly and secure flags

### 2. Session Validity Logic
- **Current**: 7-day validity based on creation date
- **Enhanced**: Consider refresh dates for extended validity
- **Background**: Auto-refresh extends session life
- **Manual**: User activity triggers refresh check

### 3. Error Handling Strategy
- **Network Errors**: Retry with exponential backoff
- **Auth Errors**: Mark session as invalid, require re-login
- **Rate Limiting**: Implement refresh rate limits
- **Partial Failures**: Continue with successful refreshes in batch

### 4. Performance Considerations
- **Batch Processing**: Process multiple sessions efficiently
- **Rate Limiting**: Respect aimharder server limits
- **Caching**: Cache refresh results temporarily
- **Database**: Optimize queries for large session counts

### 5. Security Considerations
- **API Protection**: Secure internal endpoints with API keys
- **User Privacy**: Log only necessary information
- **Session Isolation**: Prevent cross-user session access
- **Error Information**: Avoid exposing sensitive data in errors

## Environment Configuration

### Required Environment Variables
```bash
# Existing
AIMHARDER_LOGIN_URL=https://aimharder.com/login
AIMHARDER_FINGERPRINT=my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb

# New for refresh
AIMHARDER_REFRESH_URL=https://aimharder.com/setrefresh
INTERNAL_API_KEY=your-secure-api-key-for-internal-endpoints
REFRESH_CRON_ENABLED=true
REFRESH_BATCH_SIZE=10
```

### Deployment Considerations
- **Vercel**: Use Vercel Cron for scheduled refreshes
- **Docker**: Ensure cron service is configured
- **Edge Functions**: Consider Supabase Edge Functions for automation
- **Monitoring**: Set up logging and alerting

## Success Criteria

### Functional Requirements
- ✅ Manual refresh works from client-side
- ✅ Automatic server refresh maintains all active sessions
- ✅ Failed refreshes are properly logged and handled
- ✅ Database tracks refresh history and statistics
- ✅ Background reservation system has always-valid cookies

### Performance Requirements
- ✅ Refresh request completes within 10 seconds
- ✅ Batch refresh processes 100+ sessions efficiently
- ✅ Client-side refresh doesn't block UI
- ✅ Database operations are optimized

### Security Requirements
- ✅ Internal endpoints are properly secured
- ✅ User sessions remain isolated
- ✅ Error messages don't expose sensitive data
- ✅ Rate limiting prevents abuse

## Implementation Priority

### Phase 1 (Core): High Priority
1. Database schema updates
2. Refresh token service
3. Enhanced session service
4. Manual refresh API route

### Phase 2 (Client): Medium Priority
1. Client-side refresh hook
2. Auth context updates
3. UI components for refresh status

### Phase 3 (Automation): Medium Priority
1. Automated refresh API route
2. Background job service
3. Batch processing logic

### Phase 4 (Monitoring): Low Priority
1. Monitoring dashboard
2. Performance metrics
3. Automated alerting

## Next Steps

1. **Implement Phase 1** core infrastructure
2. **Test manual refresh** end-to-end
3. **Implement client-side integration**
4. **Set up server-side automation**
5. **Add monitoring and alerts**

## Questions for Clarification

1. **Refresh Frequency**: How often should automatic refresh run? (suggested: every 4-6 hours)
2. **Session Expiry**: Should refreshed sessions have extended validity beyond 7 days?
3. **Error Handling**: What should happen when refresh fails multiple times?
4. **Batch Size**: How many sessions should be processed in each batch? (suggested: 10-20)
5. **Monitoring**: What level of monitoring/alerting is needed for production?
6. **Fallback**: Should there be a manual override for users when auto-refresh fails?

## Risk Mitigation

### Technical Risks
- **API Changes**: aimharder.com changes refresh endpoint
- **Rate Limiting**: Too many refresh requests blocked
- **Performance**: Large number of sessions causes slowdown

### Mitigation Strategies
- **Monitoring**: Set up alerts for refresh failures
- **Fallback**: Manual refresh always available
- **Rate Limiting**: Implement intelligent batching
- **Testing**: Comprehensive test coverage for all scenarios