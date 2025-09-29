import { CookieService, AuthCookie } from './cookie.service'
import { ENV } from '@/core/config/environment'

export interface TokenUpdateRequest {
  fingerprint: string
  token: string
}

export interface TokenUpdateResponse {
  success: boolean
  newToken?: string
  updatedCookies?: AuthCookie[]
  logout?: boolean
  error?: string
}

export class AimharderTokenUpdateService {
  private static readonly TOKEN_UPDATE_URL = 'https://aimharder.com/api/tokenUpdate'

  static async updateToken(request: TokenUpdateRequest): Promise<TokenUpdateResponse> {
    try {
      console.log('Attempting token update for token:', request.token.substring(0, 10) + '...')

      // Prepare form data for the POST request
      const formData = new URLSearchParams({
        fingerprint: request.fingerprint,
        token: request.token
      })

      // Make request to aimharder tokenUpdate endpoint
      const response = await fetch(this.TOKEN_UPDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        body: formData.toString()
      })

      if (!response.ok) {
        console.error('Token update server error:', response.status, response.statusText)
        return {
          success: false,
          error: `Server error: ${response.status} ${response.statusText}`
        }
      }

      // Extract cookies from response headers
      const updatedCookies = CookieService.extractFromResponse(response)
      console.log('Extracted cookies from token update:', updatedCookies.map(c => c.name))

      // Parse JSON response
      const responseData = await response.json()
      console.log('Token update response:', responseData)

      // Handle logout response
      if (responseData.logout === 1) {
        console.log('Token update returned logout signal')
        return {
          success: false,
          logout: true,
          error: 'Session expired - logout required'
        }
      }

      // Handle success response with new token
      if (responseData.newToken) {
        console.log('Token update successful, new token received')
        return {
          success: true,
          newToken: responseData.newToken,
          updatedCookies
        }
      }

      // Unexpected response format
      console.error('Unexpected token update response format:', responseData)
      return {
        success: false,
        error: 'Unexpected response format from token update service'
      }

    } catch (error) {
      console.error('Token update error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token update failed'
      }
    }
  }

  static async updateTokenForAllActiveSessions(): Promise<{
    processed: number
    successful: number
    failed: number
    loggedOut: number
    skipped: number
    errors: Array<{ email: string; error: string }>
  }> {
    const { SupabaseSessionService } = await import('./supabase-session.service')

    try {
      console.log('Starting bulk token update for sessions needing update')

      // Get only sessions that need token update (not updated in last 15 minutes)
      const sessionsToUpdate = await SupabaseSessionService.getSessionsNeedingTokenUpdate()
      console.log(`Found ${sessionsToUpdate.length} sessions needing token update`)

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        loggedOut: 0,
        skipped: 0,
        errors: [] as Array<{ email: string; error: string }>
      }

      // Process each session that needs update
      for (const session of sessionsToUpdate) {
        results.processed++

        try {
          const fingerprint = ENV.getAimharderFingerprint()

          const updateResult = await this.updateToken({
            fingerprint,
            token: session.token
          })

          if (updateResult.success && updateResult.newToken) {
            // Update the session with new token and cookies
            await SupabaseSessionService.updateTokenAndCookies(
              session.email,
              updateResult.newToken,
              updateResult.updatedCookies || []
            )
            results.successful++
            console.log(`Token updated successfully for: ${session.email}`)

          } else if (updateResult.logout) {
            // Delete session if logout is required
            await SupabaseSessionService.deleteSession(session.email)
            results.loggedOut++
            console.log(`Session logged out for: ${session.email}`)

          } else {
            results.failed++
            results.errors.push({
              email: session.email,
              error: updateResult.error || 'Unknown error'
            })
            console.error(`Token update failed for ${session.email}:`, updateResult.error)
          }

        } catch (sessionError) {
          results.failed++
          const errorMessage = sessionError instanceof Error ? sessionError.message : 'Unknown session error'
          results.errors.push({
            email: session.email,
            error: errorMessage
          })
          console.error(`Session processing error for ${session.email}:`, sessionError)
        }

        // Add small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log('Bulk token update completed:', results)
      return results

    } catch (error) {
      console.error('Bulk token update error:', error)
      throw error
    }
  }
}