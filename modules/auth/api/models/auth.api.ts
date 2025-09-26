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
  }
  error?: string
}

export interface OAuthApiResponse {
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
}