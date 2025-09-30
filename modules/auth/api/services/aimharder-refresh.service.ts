import { CookieService, AuthCookie } from './cookie.service'

export interface RefreshRequest {
  token: string
  cookies: AuthCookie[]
  fingerprint?: string // Optional browser fingerprint
}

export interface RefreshResponse {
  success: boolean
  refreshToken?: string
  fingerprint?: string
  error?: string
}

export class AimharderRefreshService {
  static async refreshSession(request: RefreshRequest): Promise<RefreshResponse> {
    try {
      const refreshUrl = this.buildRefreshUrl(request.token, request.fingerprint)
      const cookieHeaders = CookieService.formatForRequest(request.cookies)

      const response = await fetch(refreshUrl, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeaders,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Server error: ${response.status}`
        }
      }

      const html = await response.text()
      const hasRefreshScript = html.includes('localStorage.setItem("refreshToken"')

      if (!hasRefreshScript) {
        return {
          success: false,
          error: 'Invalid refresh response'
        }
      }

      // Extract refreshToken and fingerprint from JavaScript
      const refreshData = this.extractRefreshData(html)

      if (!refreshData.refreshToken) {
        return {
          success: false,
          error: 'Failed to extract refresh token from response'
        }
      }

      return {
        success: true,
        refreshToken: refreshData.refreshToken,
        fingerprint: refreshData.fingerprint
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed'
      }
    }
  }

  private static buildRefreshUrl(token: string, fingerprint?: string): string {
    const baseUrl = 'https://aimharder.com/setrefresh'
    // Use provided fingerprint or fallback to environment variable
    const usedFingerprint = fingerprint || process.env.AIMHARDER_FINGERPRINT || 'my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb'

    console.log('Building setrefresh URL with fingerprint:', usedFingerprint.substring(0, 10) + '...')

    return `${baseUrl}?token=${encodeURIComponent(token)}&fingerprint=${encodeURIComponent(usedFingerprint)}`
  }

  private static extractRefreshData(html: string): {
    refreshToken?: string
    fingerprint?: string
  } {
    try {
      // Extract refreshToken using regex
      const refreshTokenMatch = html.match(/localStorage\.setItem\("refreshToken",\s*"([^"]+)"\)/)
      const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : undefined

      // Extract fingerprint using regex
      const fingerprintMatch = html.match(/localStorage\.setItem\("fingerprint",\s*"([^"]+)"\)/)
      const fingerprint = fingerprintMatch ? fingerprintMatch[1] : undefined

      return {
        refreshToken,
        fingerprint
      }
    } catch (error) {
      console.error('Error extracting refresh data:', error)
      return {}
    }
  }
}