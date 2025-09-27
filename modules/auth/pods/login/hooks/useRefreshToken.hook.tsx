import { useState, useCallback } from 'react'

export interface RefreshTokenState {
  lastRefreshDate?: Date
  isRefreshing: boolean
  needsRefresh: boolean
  error?: string
  refreshCount: number
}

export function useRefreshToken() {
  const [state, setState] = useState<RefreshTokenState>({
    isRefreshing: false,
    needsRefresh: false,
    refreshCount: 0
  })

  const checkRefreshStatus = useCallback(async (email: string) => {
    try {
      const response = await fetch(`/api/auth/refresh?email=${encodeURIComponent(email)}`)
      const data = await response.json()

      if (data.success) {
        setState(prev => ({
          ...prev,
          needsRefresh: data.needsRefresh,
          lastRefreshDate: data.lastRefreshDate ? new Date(data.lastRefreshDate) : undefined,
          refreshCount: data.refreshCount || 0,
          error: undefined
        }))
        return data.needsRefresh
      } else {
        setState(prev => ({
          ...prev,
          error: data.error
        }))
        return false
      }
    } catch (error) {
      console.error('Refresh status check error:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to check refresh status'
      }))
      return false
    }
  }, [])

  const refreshNow = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isRefreshing: true, error: undefined }))

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.success) {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          needsRefresh: false,
          lastRefreshDate: new Date(data.lastRefreshDate),
          refreshCount: prev.refreshCount + 1,
          error: undefined
        }))
        return true
      } else {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          error: data.error || 'Refresh failed'
        }))
        return false
      }
    } catch (error) {
      console.error('Refresh error:', error)
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: 'Network error during refresh'
      }))
      return false
    }
  }, [])

  const autoRefreshIfNeeded = useCallback(async (email: string) => {
    const needsRefresh = await checkRefreshStatus(email)

    if (needsRefresh) {
      console.log('Auto-refreshing session for:', email)
      return await refreshNow(email)
    }

    return true
  }, [checkRefreshStatus, refreshNow])

  return {
    ...state,
    checkRefreshStatus,
    refreshNow,
    autoRefreshIfNeeded
  }
}