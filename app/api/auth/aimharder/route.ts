import { NextRequest, NextResponse } from 'next/server'
import { AimharderAuthService } from '@/modules/auth/api/services/aimharder-auth.service'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fingerprint } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password format' },
        { status: 400 }
      )
    }

    // Validate fingerprint if provided
    if (fingerprint && typeof fingerprint !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid fingerprint format' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check rate limiting
    const remainingAttempts = AimharderAuthService.getRemainingAttempts(email)
    if (remainingAttempts === 0) {
      const timeUntilNext = AimharderAuthService.getTimeUntilNextAttempt(email)
      const minutesRemaining = Math.ceil(timeUntilNext / (60 * 1000))

      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Please try again in ${minutesRemaining} minutes.`,
          rateLimited: true,
          minutesRemaining
        },
        { status: 429 }
      )
    }

    console.log(`Login attempt for email: ${email}`, fingerprint ? 'with custom fingerprint' : 'using default fingerprint')

    // Attempt login with aimharder
    const result = await AimharderAuthService.login(email, password, fingerprint)

    if (result.success && result.cookies) {
      // Create response with user data
      const response = NextResponse.json({
        success: true,
        data: result.data,
        aimharderSession: true,
        aimharderToken: result.data?.token,
        cookies: result.cookies,
        cookiesUpdated: true,
        cookieCount: result.cookies.length
      })

      // Set cookies in response for browser storage
      result.cookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })
      })

      // Set a general auth cookie to indicate logged in state
      response.cookies.set('aimharder-auth', 'true', {
        httpOnly: false, // Allow client-side access for auth checks
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      })

      console.log(`Login successful for email: ${email} - Cookies updated in Supabase and browser:`, {
        cookieCount: result.cookies.length,
        cookieNames: result.cookies.map(c => c.name)
      })
      return response
    }

    // Login failed
    console.log(`Login failed for email: ${email}, error: ${result.error}`)
    return NextResponse.json(
      {
        success: false,
        error: result.error || 'Authentication failed',
        remainingAttempts: AimharderAuthService.getRemainingAttempts(email) - 1
      },
      { status: 401 }
    )

  } catch (error) {
    console.error('Authentication API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during authentication'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { email, fingerprint } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required for logout' },
        { status: 400 }
      )
    }

    // Multi-Session Logout - Delete ONLY device session, preserve background session
    // This allows background processes (like pre-bookings) to continue working
    // CRITICAL: Does NOT call AimHarder's logout API to avoid expiring all sessions

    // Delete device session from database
    await AimharderAuthService.logout(email, fingerprint)

    // Create response and clear browser cookies
    const response = NextResponse.json({ success: true })

    // Clear all aimharder-related cookies
    // CRITICAL: Must use same httpOnly value as when cookie was created
    const httpOnlyCookies = ['AWSALB', 'AWSALBCORS', 'PHPSESSID', 'amhrdrauth']

    // Clear httpOnly cookies
    httpOnlyCookies.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      })
    })

    // Clear aimharder-auth cookie (httpOnly: false to match creation)
    response.cookies.set('aimharder-auth', '', {
      httpOnly: false,  // CRITICAL: Must match the httpOnly value from creation (line 87)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })

    console.log(
      `Device logout successful for ${email}`,
      fingerprint ? `(fingerprint: ${fingerprint.substring(0, 10)}...)` : '(all devices)',
      '- Background session preserved'
    )
    return response

  } catch (error) {
    console.error('Logout API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during logout'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Get session status
    const result = await AimharderAuthService.refreshSession(email)

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        sessionValid: true
      })
    }

    return NextResponse.json({
      success: false,
      sessionValid: false,
      error: result.error
    })

  } catch (error) {
    console.error('Session check API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during session check'
      },
      { status: 500 }
    )
  }
}