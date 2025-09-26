// Simple API client setup - can be enhanced with axios or other libraries later
class ApiClient {
  private baseURL: string

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL
  }

  async post<T>(endpoint: string, data?: any): Promise<{ data: T }> {
    // For now, simulate API calls
    // In real implementation, this would use fetch or axios
    console.log(`API POST ${this.baseURL}${endpoint}`, data)

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Mock response for development
    return {
      data: {
        success: true,
        data: {
          user: { id: '1', email: data?.email || 'user@example.com' },
          token: 'mock-jwt-token'
        }
      } as T
    }
  }

  async get<T>(endpoint: string): Promise<{ data: T }> {
    console.log(`API GET ${this.baseURL}${endpoint}`)

    await new Promise(resolve => setTimeout(resolve, 500))

    return {
      data: {} as T
    }
  }
}

export const apiClient = new ApiClient()