import * as cheerio from 'cheerio'

export interface TokenData {
  token: string
  fingerprint?: string
  user?: string
  refresh?: string
}

export class HtmlParserService {
  static extractTokenFromIframe(html: string): TokenData | null {
    try {
      const $ = cheerio.load(html)

      // Find iframe element
      const iframe = $('iframe').first()
      const src = iframe.attr('src')

      if (!src) {
        console.warn('No iframe found in HTML response')
        return null
      }

      // Parse URL and extract parameters
      const tokenData = this.parseTokenFromUrl(src)

      if (!tokenData.token) {
        console.warn('No token found in iframe src:', src)
        return null
      }

      return tokenData
    } catch (error) {
      console.error('HTML parsing error:', error)
      return null
    }
  }

  private static parseTokenFromUrl(url: string): TokenData {
    try {
      // Handle relative URLs by adding a base
      const fullUrl = url.startsWith('http') ? url : `https://aimharder.com${url}`
      const urlObj = new URL(fullUrl)

      return {
        token: urlObj.searchParams.get('token') || '',
        fingerprint: urlObj.searchParams.get('fingerprint') || undefined,
        user: urlObj.searchParams.get('user') || undefined,
        refresh: urlObj.searchParams.get('refresh') || undefined
      }
    } catch (error) {
      console.error('URL parsing error:', error)
      return { token: '' }
    }
  }

  static extractRedirectUrl(html: string): string | null {
    try {
      const $ = cheerio.load(html)

      // Look for window.location.href in script tags
      const scripts = $('script')

      for (let i = 0; i < scripts.length; i++) {
        const scriptContent = $(scripts[i]).html()
        if (scriptContent) {
          const redirectMatch = scriptContent.match(/window\.location\.href\s*=\s*["']([^"']+)["']/)
          if (redirectMatch) {
            return redirectMatch[1]
          }
        }
      }

      // Look for meta refresh redirects
      const metaRefresh = $('meta[http-equiv="refresh"]')
      if (metaRefresh.length > 0) {
        const content = metaRefresh.attr('content')
        if (content) {
          const urlMatch = content.match(/url=([^;]+)/)
          if (urlMatch) {
            return urlMatch[1]
          }
        }
      }

      return null
    } catch (error) {
      console.error('Redirect URL extraction error:', error)
      return null
    }
  }

  static isLoginSuccessful(html: string): boolean {
    try {
      const $ = cheerio.load(html)

      // Check for iframe presence (indicates successful login)
      const iframe = $('iframe')
      if (iframe.length > 0) {
        const src = iframe.attr('src')
        return src?.includes('setrefresh') || src?.includes('token') || false
      }

      // Check for redirect script
      const scripts = $('script')
      for (let i = 0; i < scripts.length; i++) {
        const scriptContent = $(scripts[i]).html()
        if (scriptContent?.includes('window.location.href')) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Login success detection error:', error)
      return false
    }
  }

  static extractErrorMessage(html: string): string | null {
    try {
      const $ = cheerio.load(html)

      // Look for common error patterns
      const errorSelectors = [
        '.error',
        '.alert-danger',
        '.login-error',
        '[class*="error"]',
        '[id*="error"]'
      ]

      for (const selector of errorSelectors) {
        const errorElement = $(selector)
        if (errorElement.length > 0) {
          const text = errorElement.text().trim()
          if (text) {
            return text
          }
        }
      }

      // Check if we're back to login page (failed login)
      const loginForm = $('form[action*="login"], input[name="mail"], input[name="pw"]')
      if (loginForm.length > 0) {
        return 'Invalid credentials or login failed'
      }

      return null
    } catch (error) {
      console.error('Error message extraction error:', error)
      return null
    }
  }

  static validateHtmlResponse(html: string): {
    isValid: boolean
    hasIframe: boolean
    hasToken: boolean
    hasRedirect: boolean
    errorMessage?: string
  } {
    const $ = cheerio.load(html)

    const iframe = $('iframe').first()
    const hasIframe = iframe.length > 0

    let hasToken = false
    let hasRedirect = false

    if (hasIframe) {
      const src = iframe.attr('src')
      hasToken = src?.includes('token') || false
    }

    const scripts = $('script')
    for (let i = 0; i < scripts.length; i++) {
      const scriptContent = $(scripts[i]).html()
      if (scriptContent?.includes('window.location.href')) {
        hasRedirect = true
        break
      }
    }

    const errorMessage = this.extractErrorMessage(html)
    const isValid = hasIframe && hasToken && hasRedirect && !errorMessage

    return {
      isValid,
      hasIframe,
      hasToken,
      hasRedirect,
      errorMessage: errorMessage || undefined
    }
  }
}