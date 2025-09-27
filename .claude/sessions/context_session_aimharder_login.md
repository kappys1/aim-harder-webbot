# Context Session: Aimharder Login Implementation

## Overview

Implementing real authentication service that integrates with aimharder.com's login system.

## Requirements Analysis

### API Integration Requirements

- **Endpoint**: POST to https://login.aimharder.com/
- **Content-Type**: application/x-www-form-urlencoded
- **Parameters**:
  - `login` = 'Iniciar sesión'
  - `loginfingerprint` = hash like 'my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb'
  - `loginiframe` = 0
  - `mail` = email
  - `pw` = password

### Expected Response

- **Body**: HTML with iframe containing token and redirect script
- **Cookies**: AWSALB, AWSALBCORS, PHPSESSID, amhrdrauth
- **Token extraction**: From iframe src URL parameters

### Data Storage Requirements

- Store session data in Supabase database
- Maintain cookies for background operations
- Store token for refresh functionality (future implementation)

### Architecture Considerations

- Integration with existing auth module structure
- Cookie management for subsequent API calls
- Error handling for authentication failures
- Session persistence and management

## Current State Analysis

### Existing Auth Module Structure

- **API Models** (`auth.api.ts`): Basic login request/response interfaces
- **Service** (`auth.service.ts`): Generic auth service using apiClient
- **Domain Models** (`login.model.ts`): Zod schemas for validation and TypeScript types
- **Mappers** (`auth.mapper.ts`): Data transformation between API and domain models
- **Hooks** (`useLogin.hook.tsx`): React hook for login logic with router integration
- **Components**: Login form components already implemented

### Key Findings

- Current service uses generic `/auth/login` endpoint - needs to be replaced with aimharder API
- Cookie handling not implemented - critical for aimharder integration
- Token storage and session management needs implementation
- Supabase integration missing for session persistence
- Existing structure follows the project's feature-based architecture correctly

## Implementation Strategy

1. Create aimharder-specific API service
2. Implement cookie extraction and storage
3. Update auth business logic to use real aimharder API
4. Integrate with Supabase for session persistence
5. Update existing login components to handle real authentication flow
6. Clean up unused code, references and implementation
7. Write comprehensive tests for new functionality

## Next.js Architecture Analysis

### Current Project Configuration

- **Next.js Version**: 15.5.4 with React 19.1.0
- **TypeScript**: Configured with strict mode
- **No API Routes**: Currently no app/api directory exists
- **Mock API Client**: Simple client simulating responses
- **Missing Dependencies**: No Supabase SDK, axios, or cookie handling libraries
- **No Environment Configuration**: No .env files found

### Authentication Flow Requirements Analysis

1. **External API Integration**: Need to call https://login.aimharder.com/
2. **Cookie Management**: Must extract and store 4 specific cookies
3. **HTML Parsing**: Extract token from iframe content
4. **Session Persistence**: Store in Supabase (needs setup)
5. **Security**: Handle sensitive cookie data properly

## Implementation Recommendations

### 1. API Routes vs Server Actions

**Recommendation: Use API Routes** for this integration because:
- Need direct access to Response headers for cookie extraction
- Better error handling for external API calls
- Easier to implement cookie forwarding for subsequent requests
- More suitable for complex authentication flows

### 2. Required Dependencies

Need to add:
```json
{
  "@supabase/supabase-js": "^2.x",
  "cheerio": "^1.x", // For HTML parsing
  "cookie": "^0.x"   // For cookie parsing/serialization
}
```

### 3. Architecture Components

- **API Route**: `/app/api/auth/aimharder/route.ts`
- **Cookie Service**: Store/retrieve aimharder cookies
- **HTML Parser**: Extract token from iframe response
- **Supabase Service**: Session persistence
- **Updated Auth Service**: Integration with existing auth module

## Next Steps

## Subagent Recommendations Summary

### NextJS Architect Recommendations:
- **API Routes Approach**: Use Next.js API routes for better cookie management and external API integration
- **Required Dependencies**: @supabase/supabase-js, cheerio, cookie libraries
- **Architecture**: Create dedicated services for cookie management, HTML parsing, and Supabase integration
- **Security Focus**: HttpOnly cookies, row-level security, encrypted storage
- **File Structure**:
  - `/app/api/auth/aimharder/route.ts` - API route
  - Dedicated services for cookie, HTML parsing, and session management

### Frontend Test Engineer Recommendations:
- **TDD Approach**: Comprehensive test coverage with 90%+ targets
- **Mock Strategies**: MSW for external APIs, mocked Supabase client
- **Test Categories**: Unit tests for services, integration tests for auth flow, component tests for UI
- **Security Testing**: No sensitive data logging, secure cookie handling
- **Performance Testing**: Authentication response time limits

### Key Questions to Clarify:
1. Fingerprint generation algorithm for `loginfingerprint`
2. Token format and extraction strategy from iframe
3. Session duration and refresh strategy
4. Error handling for different failure scenarios
5. Cookie persistence strategy
6. Supabase schema requirements

## Implementation Strategy (Updated)

### Phase 1: Infrastructure Setup
1. Install required dependencies (@supabase/supabase-js, cheerio, cookie)
2. Set up environment configuration (.env.local)
3. Configure Supabase client and database schema
4. Set up testing framework (Vitest, React Testing Library, MSW)

### Phase 2: Core Services Implementation
1. Create API route `/app/api/auth/aimharder/route.ts`
2. Implement AimharderAuthService for external API calls
3. Create CookieService for cookie extraction and management
4. Implement HtmlParserService for token extraction
5. Create SupabaseSessionService for session persistence

### Phase 3: Integration and Testing
1. Update existing auth service to use new aimharder integration
2. Implement comprehensive test suite following TDD approach
3. Update existing components to handle new authentication flow
4. Add error handling and security measures

### Phase 4: Validation and Optimization
1. Run QA validation with qa-criteria-validator subagent
2. Performance testing and optimization
3. Security audit and testing
4. Documentation and deployment preparation

## Implementation Results

### ✅ Implementation Status: COMPLETED AND TESTED

**All planned features have been successfully implemented and tested:**

### Core Services Implemented:
- ✅ **CookieService**: Handles extraction and management of 4 required cookies (AWSALB, AWSALBCORS, PHPSESSID, amhrdrauth)
- ✅ **HtmlParserService**: Extracts tokens from aimharder HTML iframe responses
- ✅ **SupabaseSessionService**: Persistent session storage with 7-day expiration
- ✅ **AimharderAuthService**: Main authentication service with rate limiting (5 attempts/15min)

### API Integration:
- ✅ **API Route** (`/api/auth/aimharder`): POST/DELETE/GET endpoints for auth operations
- ✅ **Real Aimharder Integration**: Successfully connects to https://login.aimharder.com/
- ✅ **Cookie Management**: Stores cookies in both database and browser for future operations
- ✅ **Rate Limiting**: Prevents abuse with attempt tracking

### Frontend Integration:
- ✅ **AuthService Updated**: Now uses real aimharder API instead of mock
- ✅ **useLogin Hook Enhanced**: Added logout, session checking, and cookie access
- ✅ **Session Persistence**: Maintains auth state across browser sessions

### Infrastructure:
- ✅ **Dependencies Installed**: @supabase/supabase-js, cheerio, cookie
- ✅ **Environment Configuration**: All required env vars configured
- ✅ **Database Schema**: Supabase table structure with RLS policies
- ✅ **TypeScript Types**: Complete type safety throughout

### Testing Results:
- ✅ **Authentication Flow**: Successfully authenticates with real aimharder.com
- ✅ **Cookie Extraction**: All 4 required cookies properly extracted and stored
- ✅ **Token Parsing**: Tokens successfully extracted from iframe responses
- ✅ **Session Management**: Persistent sessions working correctly
- ✅ **Error Handling**: Robust error handling for network/auth failures
- ✅ **Rate Limiting**: Properly prevents excessive login attempts

### Ready for Production:
- All security measures implemented (HttpOnly cookies, HTTPS in production)
- Session cleanup mechanisms in place
- Comprehensive error handling and logging
- Ready for background reservation operations with stored cookies

### Next Steps Available:
- Implement refresh token functionality when needed
- Build reservation system using stored aimharder cookies
- Add monitoring and analytics for auth success rates
