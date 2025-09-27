# Next.js Architect Implementation Plan: Aimharder Authentication

## Overview

This document provides a comprehensive Next.js implementation strategy for integrating with aimharder.com's authentication system. The implementation maintains the existing feature-based architecture while adding external API integration capabilities.

## Current State Analysis

### Existing Auth Module Structure
- **API Models** (`auth.api.ts`): Basic login interfaces - needs extension for aimharder
- **Service** (`auth.service.ts`): Mock implementation using generic apiClient
- **Domain Models** (`login.model.ts`): Zod schemas for validation - compatible with extension
- **Mappers** (`auth.mapper.ts`): API/domain transformation - needs aimharder mappers
- **Business Logic** (`useLogin.hook.tsx`): React hook with router integration - needs update
- **UI Components**: Login form components - compatible with new flow

### Project Configuration
- **Next.js**: 15.5.4 with React 19.1.0
- **TypeScript**: Strict mode enabled
- **Current API**: Mock client implementation
- **Missing**: Supabase SDK, cookie handling, HTML parsing libraries

## Implementation Strategy

### Phase 1: Infrastructure Setup

#### 1.1 Required Dependencies
```bash
npm install @supabase/supabase-js cheerio cookie
npm install --save-dev @types/cookie
```

#### 1.2 Environment Configuration
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AIMHARDER_LOGIN_URL=https://login.aimharder.com/
```

#### 1.3 Supabase Configuration
Create `/core/database/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
```

### Phase 2: Core Services Implementation

#### 2.1 API Route Structure
**File**: `/app/api/auth/aimharder/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { AimharderAuthService } from '@/modules/auth/api/services/aimharder-auth.service'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const result = await AimharderAuthService.login(email, password)

    if (result.success) {
      // Set cookies in response
      const response = NextResponse.json(result)

      result.cookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        })
      })

      return response
    }

    return NextResponse.json(result, { status: 401 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
```

#### 2.2 Aimharder Authentication Service
**File**: `/modules/auth/api/services/aimharder-auth.service.ts`

```typescript
import { AimharderLoginRequest, AimharderLoginResponse } from '../models/aimharder-auth.api'
import { CookieService } from './cookie.service'
import { HtmlParserService } from './html-parser.service'
import { SupabaseSessionService } from './supabase-session.service'

export class AimharderAuthService {
  static async login(email: string, password: string): Promise<AimharderLoginResponse> {
    try {
      // Generate fingerprint (implement proper generation logic)
      const loginfingerprint = this.generateFingerprint()

      // Prepare form data
      const formData = new URLSearchParams({
        login: 'Iniciar sesión',
        loginfingerprint,
        loginiframe: '0',
        mail: email,
        pw: password
      })

      // Make request to aimharder
      const response = await fetch(process.env.AIMHARDER_LOGIN_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      })

      if (!response.ok) {
        return { success: false, error: 'Authentication failed' }
      }

      // Extract cookies
      const cookies = CookieService.extractFromResponse(response)

      // Parse HTML for token
      const html = await response.text()
      const token = HtmlParserService.extractTokenFromIframe(html)

      if (!token) {
        return { success: false, error: 'Token extraction failed' }
      }

      // Store session in Supabase
      await SupabaseSessionService.storeSession({
        email,
        token,
        cookies: cookies.map(c => ({ name: c.name, value: c.value })),
        createdAt: new Date().toISOString()
      })

      return {
        success: true,
        data: {
          user: { id: email, email, name: email },
          token
        },
        cookies
      }

    } catch (error) {
      console.error('Aimharder auth error:', error)
      return { success: false, error: 'Authentication failed' }
    }
  }

  private static generateFingerprint(): string {
    // Implement fingerprint generation logic
    // This should match aimharder's expected format
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15)
  }
}
```

#### 2.3 Cookie Management Service
**File**: `/modules/auth/api/services/cookie.service.ts`

```typescript
import { serialize, parse } from 'cookie'

export interface AuthCookie {
  name: string
  value: string
  options?: any
}

export class CookieService {
  static extractFromResponse(response: Response): AuthCookie[] {
    const setCookieHeaders = response.headers.getSetCookie()
    const requiredCookies = ['AWSALB', 'AWSALBCORS', 'PHPSESSID', 'amhrdrauth']

    return setCookieHeaders
      .map(cookieHeader => {
        const [nameValue] = cookieHeader.split(';')
        const [name, value] = nameValue.split('=')
        return { name: name.trim(), value: value.trim() }
      })
      .filter(cookie => requiredCookies.includes(cookie.name))
  }

  static formatForRequest(cookies: AuthCookie[]): string {
    return cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ')
  }

  static serializeForResponse(name: string, value: string, options: any = {}): string {
    return serialize(name, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      ...options
    })
  }
}
```

#### 2.4 HTML Parser Service
**File**: `/modules/auth/api/services/html-parser.service.ts`

```typescript
import * as cheerio from 'cheerio'

export class HtmlParserService {
  static extractTokenFromIframe(html: string): string | null {
    try {
      const $ = cheerio.load(html)

      // Find iframe element
      const iframe = $('iframe').first()
      const src = iframe.attr('src')

      if (!src) return null

      // Extract token from URL parameters
      const url = new URL(src, 'https://dummy.com') // Base URL for relative URLs
      const token = url.searchParams.get('token') ||
                   url.searchParams.get('access_token') ||
                   url.searchParams.get('auth_token')

      return token
    } catch (error) {
      console.error('HTML parsing error:', error)
      return null
    }
  }
}
```

#### 2.5 Supabase Session Service
**File**: `/modules/auth/api/services/supabase-session.service.ts`

```typescript
import { supabase } from '@/core/database/supabase'

export interface SessionData {
  email: string
  token: string
  cookies: Array<{ name: string; value: string }>
  createdAt: string
}

export class SupabaseSessionService {
  static async storeSession(sessionData: SessionData): Promise<void> {
    const { error } = await supabase
      .from('auth_sessions')
      .upsert({
        user_email: sessionData.email,
        aimharder_token: sessionData.token,
        aimharder_cookies: sessionData.cookies,
        created_at: sessionData.createdAt,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Session storage error:', error)
      throw new Error('Failed to store session')
    }
  }

  static async getSession(email: string): Promise<SessionData | null> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('user_email', email)
      .single()

    if (error || !data) return null

    return {
      email: data.user_email,
      token: data.aimharder_token,
      cookies: data.aimharder_cookies,
      createdAt: data.created_at
    }
  }

  static async deleteSession(email: string): Promise<void> {
    await supabase
      .from('auth_sessions')
      .delete()
      .eq('user_email', email)
  }
}
```

### Phase 3: API Models and Types

#### 3.1 Aimharder API Models
**File**: `/modules/auth/api/models/aimharder-auth.api.ts`

```typescript
import { AuthCookie } from '../services/cookie.service'

export interface AimharderLoginRequest {
  login: string
  loginfingerprint: string
  loginiframe: string
  mail: string
  pw: string
}

export interface AimharderLoginResponse {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      name?: string
    }
    token: string
  }
  cookies?: AuthCookie[]
  error?: string
}
```

#### 3.2 Update Existing API Models
**File**: `/modules/auth/api/models/auth.api.ts` (extend existing)

```typescript
// Extend existing interfaces
export interface LoginApiRequest {
  email: string
  password: string
}

export interface LoginApiResponse {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      name?: string
    }
    token: string
  }
  error?: string
  // Add aimharder-specific fields
  aimharderSession?: boolean
  cookies?: Array<{ name: string; value: string }>
}
```

### Phase 4: Update Business Logic

#### 4.1 Update Auth Service
**File**: `/modules/auth/api/services/auth.service.ts`

```typescript
import { apiClient } from "@/core/api/client"
import {
  LoginRequest,
  LoginResponse,
} from "@/modules/auth/pods/login/models/login.model"
import { AuthMapper } from "../mappers/auth.mapper"
import { LoginApiRequest, LoginApiResponse } from "../models/auth.api"

class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Use the new aimharder API route
      const response = await fetch('/api/auth/aimharder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: request.email,
          password: request.password
        })
      })

      const data: LoginApiResponse = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Login failed. Please try again.",
        }
      }

      return AuthMapper.fromLoginApiResponse(data)
    } catch (error) {
      console.error("Login error:", error)
      return {
        success: false,
        error: "Login failed. Please try again.",
      }
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error("Logout error:", error)
    }
  }
}

export const authService = new AuthService()
```

### Phase 5: Database Schema

#### 5.1 Supabase Table Creation
Create table `auth_sessions`:

```sql
CREATE TABLE auth_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  aimharder_token TEXT NOT NULL,
  aimharder_cookies JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_auth_sessions_email ON auth_sessions(user_email);

-- RLS policies (adjust based on your security requirements)
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions" ON auth_sessions
  FOR ALL USING (auth.email() = user_email);
```

## Security Considerations

### 1. Cookie Security
- **HttpOnly**: Prevent XSS attacks
- **Secure**: HTTPS only in production
- **SameSite**: CSRF protection
- **Short expiration**: Limit exposure window

### 2. Session Storage
- **Encrypted storage**: Consider encrypting sensitive data in Supabase
- **Row Level Security**: Ensure users can only access their own sessions
- **Regular cleanup**: Implement session cleanup for expired sessions

### 3. API Security
- **Rate limiting**: Implement rate limiting on auth endpoints
- **CORS configuration**: Restrict origins
- **Input validation**: Validate all inputs with Zod schemas

### 4. Error Handling
- **No information leakage**: Generic error messages
- **Logging**: Secure logging of auth attempts
- **Monitoring**: Alert on unusual auth patterns

## Integration Points

### 1. Existing Auth Module
- **Minimal changes**: Preserve existing interfaces
- **Backward compatibility**: Maintain current API contracts
- **Progressive enhancement**: Add aimharder features without breaking existing flow

### 2. UI Components
- **No changes required**: Existing login components compatible
- **Enhanced feedback**: Add loading states for external API calls
- **Error handling**: Display aimharder-specific error messages

### 3. Navigation
- **Router integration**: Maintain existing navigation patterns
- **Session management**: Integrate with existing session state

## Testing Strategy

### 1. Unit Tests
- Cookie extraction and parsing
- HTML token extraction
- Session storage/retrieval
- Error handling scenarios

### 2. Integration Tests
- End-to-end login flow
- Session persistence
- Cookie management
- API route functionality

### 3. Security Tests
- Authentication bypass attempts
- Session hijacking prevention
- XSS/CSRF protection
- Rate limiting effectiveness

## Deployment Considerations

### 1. Environment Variables
- Secure storage of Supabase credentials
- Environment-specific configurations
- Production vs development settings

### 2. Performance
- Connection pooling for Supabase
- Caching strategies for sessions
- Optimized cookie handling

### 3. Monitoring
- Authentication success/failure rates
- Session duration analytics
- Error tracking and alerting

## Migration Path

### Phase 1: Infrastructure
1. Set up Supabase database and table
2. Install required dependencies
3. Create environment configuration

### Phase 2: Core Services
1. Implement API route
2. Create aimharder auth service
3. Add cookie and HTML parsing services

### Phase 3: Integration
1. Update existing auth service
2. Test integration with existing components
3. Add comprehensive error handling

### Phase 4: Production
1. Security review and testing
2. Performance optimization
3. Monitoring and alerting setup

## Acceptance Criteria

### Core Functionality
- [ ] Successfully authenticate with aimharder.com
- [ ] Extract and store all required cookies
- [ ] Parse token from HTML iframe response
- [ ] Store session data in Supabase
- [ ] Maintain session across requests

### Security
- [ ] Secure cookie handling implementation
- [ ] Row-level security for session data
- [ ] No sensitive data exposure in client
- [ ] Proper error handling without information leakage

### Integration
- [ ] Seamless integration with existing auth module
- [ ] No breaking changes to existing interfaces
- [ ] Proper TypeScript typing throughout
- [ ] Comprehensive test coverage (80%+)

### Performance
- [ ] Fast authentication response times
- [ ] Efficient session storage and retrieval
- [ ] Minimal impact on existing functionality
- [ ] Proper error recovery mechanisms

## Things to Clarify with User

1. **Fingerprint Generation**: How should the `loginfingerprint` be generated? Is there a specific algorithm or format required by aimharder.com?

2. **Token Format**: What is the expected format of the token in the iframe? Is it in URL parameters, and what parameter name should we look for?

3. **Session Duration**: How long should aimharder sessions be maintained? Should they sync with aimharder's expiration?

4. **Error Scenarios**: What specific error responses does aimharder.com return for different failure cases (wrong credentials, rate limiting, etc.)?

5. **Subsequent API Calls**: Will we need to make other API calls to aimharder.com using the stored cookies? If so, what endpoints and patterns should we prepare for?

6. **User Data**: Does aimharder.com return additional user information that should be stored or displayed?

7. **Production Environment**: What are the Supabase credentials and URL for the production environment?