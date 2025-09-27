// API request models
export interface LoginApiRequest {
  email: string
  password: string
}

// API response models
export interface LoginApiResponse {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      name?: string
    }
    token: string
    tokenData?: {
      token: string
      fingerprint?: string
      user?: string
      refresh?: string
    }
  }
  error?: string
  // Aimharder-specific fields
  aimharderSession?: boolean
  cookies?: Array<{ name: string; value: string }>
  rateLimited?: boolean
  minutesRemaining?: number
  remainingAttempts?: number
  sessionValid?: boolean
}

