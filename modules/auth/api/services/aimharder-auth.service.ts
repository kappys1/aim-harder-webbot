import { CookieService, AuthCookie } from './cookie.service'
import { HtmlParserService, TokenData } from './html-parser.service'
import { SupabaseSessionService, SessionData } from './supabase-session.service'
import { AimharderRefreshService } from './aimharder-refresh.service'

export interface AimharderLoginRequest {
  email: string
  password: string
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
    tokenData?: TokenData
  }
  cookies?: AuthCookie[]
  error?: string
}

export interface AimharderLoginAttempt {
  email: string
  timestamp: number
  success: boolean
}

export class AimharderAuthService {
  private static readonly MAX_ATTEMPTS = 5
  private static readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
  private static attempts: Map<string, AimharderLoginAttempt[]> = new Map()

  static async login(email: string, password: string, fingerprint?: string): Promise<AimharderLoginResponse> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(email)) {
        return {
          success: false,
          error: 'Too many login attempts. Please wait 15 minutes before trying again.'
        }
      }

      // Check for existing valid session, but always refresh cookies on login
      const existingSession = await SupabaseSessionService.getSession(email)
      if (existingSession && await SupabaseSessionService.isSessionValid(email)) {
        console.log('Found existing valid session for:', email, '- but will refresh cookies on login')
        // Continue with fresh login to update cookies, don't return early
      }

      // Use provided fingerprint or fallback to environment variable
      const loginFingerprint = fingerprint || process.env.AIMHARDER_FINGERPRINT || 'my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb'

      // Prepare form data for aimharder login
      const formData = new URLSearchParams({
        login: 'Iniciar sesión',
        loginfingerprint: loginFingerprint,
        loginiframe: '0',
        mail: email,
        pw: password
      })

      console.log('Attempting login to aimharder for:', email, 'with fingerprint:', loginFingerprint.substring(0, 10) + '...')

      // Make request to aimharder
      const response = await fetch(process.env.AIMHARDER_LOGIN_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        body: formData.toString()
      })

      if (!response.ok) {
        this.recordAttempt(email, false)
        return {
          success: false,
          error: `Aimharder server error: ${response.status} ${response.statusText}`
        }
      }

      // Extract cookies from response
      const cookies = CookieService.extractFromResponse(response)
      console.log('Extracted cookies:', cookies.map(c => c.name))

      // Parse HTML response
      const html = await response.text()
      console.log('Received HTML response length:', html.length)

      // Validate the response
      const validation = HtmlParserService.validateHtmlResponse(html)
      if (!validation.isValid) {
        this.recordAttempt(email, false)
        return {
          success: false,
          error: validation.errorMessage || 'Invalid credentials or login failed'
        }
      }

      // Extract token from HTML
      const tokenData = HtmlParserService.extractTokenFromIframe(html)
      if (!tokenData || !tokenData.token) {
        this.recordAttempt(email, false)
        return {
          success: false,
          error: 'Failed to extract authentication token'
        }
      }

      console.log('Successfully extracted token for:', email)

      // Validate required cookies
      const cookieValidation = CookieService.validateRequiredCookies(cookies)
      if (!cookieValidation.isValid) {
        console.warn('Missing required cookies:', cookieValidation.missing)
        // Continue but log warning - user can login but may have issues with reservations
      }

      // Store session in Supabase
      const sessionData: SessionData = {
        email,
        token: tokenData.token,
        cookies,
        tokenData,
        createdAt: new Date().toISOString()
      }

      console.log('Storing cookies in Supabase for:', email, {
        cookieCount: cookies.length,
        cookieNames: cookies.map(c => c.name),
        hasRequiredCookies: CookieService.validateRequiredCookies(cookies).isValid
      })

      await SupabaseSessionService.storeSession(sessionData)
      console.log('Cookies successfully stored in Supabase for:', email)

      // Call setrefresh to get the refresh token and update the database
      try {
        console.log('Calling setrefresh to get refresh token for:', email)
        const refreshResult = await AimharderRefreshService.refreshSession({
          token: tokenData.token,
          cookies,
          fingerprint: loginFingerprint // Pass the same fingerprint used for login
        })

        if (refreshResult.success && refreshResult.refreshToken) {
          // Update the aimharder_token field with the refresh token
          // Also store the fingerprint returned by setrefresh if available
          await SupabaseSessionService.updateRefreshToken(email, refreshResult.refreshToken, refreshResult.fingerprint)
          console.log('Refresh token updated successfully for:', email)
        } else {
          console.warn('Failed to get refresh token for:', email, refreshResult.error)
        }
      } catch (error) {
        console.error('Error calling setrefresh for:', email, error)
        // Don't fail the login if refresh token call fails
      }

      // Record successful attempt
      this.recordAttempt(email, true)

      return {
        success: true,
        data: {
          user: { id: email, email, name: email },
          token: tokenData.token,
          tokenData
        },
        cookies
      }

    } catch (error) {
      console.error('Aimharder auth error:', error)
      this.recordAttempt(email, false)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }
    }
  }

  static async logout(email: string): Promise<void> {
    try {
      await SupabaseSessionService.deleteSession(email)
      this.clearAttempts(email)
      console.log('User logged out successfully:', email)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  static async refreshSession(email: string): Promise<AimharderLoginResponse> {
    try {
      const session = await SupabaseSessionService.getSession(email)
      if (!session) {
        return {
          success: false,
          error: 'No session found'
        }
      }

      // Check if session is still valid
      if (await SupabaseSessionService.isSessionValid(email)) {
        return {
          success: true,
          data: {
            user: { id: email, email, name: email },
            token: session.token
          },
          cookies: session.cookies
        }
      }

      // Session expired, remove it
      await SupabaseSessionService.deleteSession(email)
      return {
        success: false,
        error: 'Session expired'
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      return {
        success: false,
        error: 'Failed to refresh session'
      }
    }
  }

  static async getStoredSession(email: string): Promise<SessionData | null> {
    try {
      return await SupabaseSessionService.getSession(email)
    } catch (error) {
      console.error('Get stored session error:', error)
      return null
    }
  }

  private static checkRateLimit(email: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(email) || []

    // Clean old attempts
    const recentAttempts = attempts.filter(
      attempt => now - attempt.timestamp < this.RATE_LIMIT_WINDOW
    )

    // Count failed attempts in the window
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success)

    // Update attempts array
    this.attempts.set(email, recentAttempts)

    return failedAttempts.length < this.MAX_ATTEMPTS
  }

  private static recordAttempt(email: string, success: boolean): void {
    const attempts = this.attempts.get(email) || []
    attempts.push({
      email,
      timestamp: Date.now(),
      success
    })

    this.attempts.set(email, attempts)
  }

  private static clearAttempts(email: string): void {
    this.attempts.delete(email)
  }

  static getRemainingAttempts(email: string): number {
    const attempts = this.attempts.get(email) || []
    const now = Date.now()

    const recentFailedAttempts = attempts.filter(
      attempt => !attempt.success && now - attempt.timestamp < this.RATE_LIMIT_WINDOW
    )

    return Math.max(0, this.MAX_ATTEMPTS - recentFailedAttempts.length)
  }

  static getTimeUntilNextAttempt(email: string): number {
    const attempts = this.attempts.get(email) || []
    const now = Date.now()

    const recentFailedAttempts = attempts.filter(
      attempt => !attempt.success && now - attempt.timestamp < this.RATE_LIMIT_WINDOW
    )

    if (recentFailedAttempts.length < this.MAX_ATTEMPTS) {
      return 0
    }

    const oldestAttempt = Math.min(...recentFailedAttempts.map(a => a.timestamp))
    return Math.max(0, this.RATE_LIMIT_WINDOW - (now - oldestAttempt))
  }
}