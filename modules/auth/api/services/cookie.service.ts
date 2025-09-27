import { serialize, parse } from 'cookie'

export interface AuthCookie {
  name: string
  value: string
  options?: any
}

export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  maxAge?: number
  path?: string
}

export class CookieService {
  private static readonly REQUIRED_COOKIES = ['AWSALB', 'AWSALBCORS', 'PHPSESSID', 'amhrdrauth']

  static extractFromResponse(response: Response): AuthCookie[] {
    const setCookieHeaders = response.headers.getSetCookie?.() || []

    if (setCookieHeaders.length === 0) {
      const singleCookieHeader = response.headers.get('set-cookie')
      if (singleCookieHeader) {
        return this.parseCookieHeader(singleCookieHeader)
      }
    }

    return setCookieHeaders
      .flatMap(cookieHeader => this.parseCookieHeader(cookieHeader))
      .filter(cookie => this.REQUIRED_COOKIES.includes(cookie.name))
  }

  private static parseCookieHeader(cookieHeader: string): AuthCookie[] {
    const cookies: AuthCookie[] = []
    const parts = cookieHeader.split(',')

    for (const part of parts) {
      const trimmedPart = part.trim()
      const [nameValue] = trimmedPart.split(';')

      if (nameValue && nameValue.includes('=')) {
        const [name, ...valueParts] = nameValue.split('=')
        const value = valueParts.join('=')

        if (name && value) {
          cookies.push({
            name: name.trim(),
            value: value.trim()
          })
        }
      }
    }

    return cookies.filter(cookie => this.REQUIRED_COOKIES.includes(cookie.name))
  }

  static formatForRequest(cookies: AuthCookie[]): string {
    return cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ')
  }

  static serializeForResponse(name: string, value: string, options: CookieOptions = {}): string {
    const defaultOptions: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    }

    return serialize(name, value, { ...defaultOptions, ...options })
  }

  static parseFromRequest(cookieHeader: string): AuthCookie[] {
    if (!cookieHeader) return []

    const parsedCookies = parse(cookieHeader)

    return Object.entries(parsedCookies)
      .filter(([name]) => this.REQUIRED_COOKIES.includes(name))
      .map(([name, value]) => ({ name, value: value || '' }))
  }

  static validateRequiredCookies(cookies: AuthCookie[]): { isValid: boolean; missing: string[] } {
    const cookieNames = cookies.map(c => c.name)
    const missing = this.REQUIRED_COOKIES.filter(required => !cookieNames.includes(required))

    return {
      isValid: missing.length === 0,
      missing
    }
  }

  static getCookieByName(cookies: AuthCookie[], name: string): AuthCookie | undefined {
    return cookies.find(cookie => cookie.name === name)
  }

  static mergeCookies(existing: AuthCookie[], newCookies: AuthCookie[]): AuthCookie[] {
    const merged = [...existing]

    for (const newCookie of newCookies) {
      const existingIndex = merged.findIndex(c => c.name === newCookie.name)
      if (existingIndex >= 0) {
        merged[existingIndex] = newCookie
      } else {
        merged.push(newCookie)
      }
    }

    return merged
  }
}