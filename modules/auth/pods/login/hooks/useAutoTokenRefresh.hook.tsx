'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { ENV } from '@/core/config/environment'

export interface UseAutoTokenRefreshProps {
  /** Interval in minutes for automatic refresh. If not provided, uses NEXT_PUBLIC_TOKEN_REFRESH_INTERVAL_MINUTES env var (default: 15) */
  intervalMinutes?: number
  /** Whether to enable automatic refresh (default: true) */
  enabled?: boolean
  /** Callback when token refresh succeeds */
  onRefreshSuccess?: (newToken: string) => void
  /** Callback when token refresh fails */
  onRefreshError?: (error: string) => void
  /** Callback when logout is required */
  onLogoutRequired?: () => void
}

export interface AutoTokenRefreshState {
  isRefreshing: boolean
  lastRefreshTime: Date | null
  nextRefreshTime: Date | null
  refreshCount: number
  lastError: string | null
}

export const useAutoTokenRefresh = ({
  intervalMinutes,
  enabled = true,
  onRefreshSuccess,
  onRefreshError,
  onLogoutRequired
}: UseAutoTokenRefreshProps = {}) => {
  // Get refresh interval from props or environment variable
  const actualIntervalMinutes = intervalMinutes ?? ENV.getFrontendRefreshIntervalMinutes()

  // Get user email from localStorage (following existing pattern)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [currentToken, setCurrentToken] = useState<string | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)

  // State tracking
  const stateRef = useRef<AutoTokenRefreshState>({
    isRefreshing: false,
    lastRefreshTime: null,
    nextRefreshTime: null,
    refreshCount: 0,
    lastError: null
  })

  const updateNextRefreshTime = useCallback(() => {
    const nextTime = new Date()
    nextTime.setMinutes(nextTime.getMinutes() + actualIntervalMinutes)
    stateRef.current.nextRefreshTime = nextTime
  }, [actualIntervalMinutes])

  // Load user email and token from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('user-email')
      setUserEmail(email)
    }
  }, [])

  // Fetch current token when user email changes
  useEffect(() => {
    const fetchCurrentToken = async () => {
      if (!userEmail) return

      try {
        // Get current session to retrieve token using the existing endpoint
        const response = await fetch(`/api/auth/refresh?email=${encodeURIComponent(userEmail)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.token) {
            setCurrentToken(data.token)
            console.log('Current token fetched for auto-refresh:', data.token.substring(0, 10) + '...')
          }
        } else {
          console.error('Failed to fetch current token:', response.status)
        }
      } catch (error) {
        console.error('Failed to fetch current token:', error)
      }
    }

    fetchCurrentToken()
  }, [userEmail])

  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current || !currentToken || !userEmail) {
      console.log('Token refresh skipped:', {
        isRefreshing: isRefreshingRef.current,
        hasToken: !!currentToken,
        hasEmail: !!userEmail
      })
      return
    }

    isRefreshingRef.current = true
    stateRef.current.isRefreshing = true
    stateRef.current.lastError = null

    try {
      console.log('Starting automatic token refresh for user:', userEmail)

      const fingerprint = ENV.getFrontendAimharderFingerprint()

      const response = await fetch('/api/tokenUpdate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fingerprint,
          token: currentToken
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Token refresh successful
        console.log('Token refresh successful:', data.newToken?.substring(0, 10) + '...')

        stateRef.current.lastRefreshTime = new Date()
        stateRef.current.refreshCount++
        updateNextRefreshTime()

        // Update current token with the new token for next refresh
        setCurrentToken(data.newToken)

        onRefreshSuccess?.(data.newToken)

        // Note: The token is automatically updated in the database
        // The frontend now uses the updated token for subsequent calls

      } else if (data.logout === 1) {
        // Logout required
        console.log('Token refresh returned logout signal - logging out user')

        stateRef.current.lastError = 'Session expired - logout required'
        onLogoutRequired?.()

        // Clear localStorage and trigger logout
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user-email')
        }
        setUserEmail(null)
        setCurrentToken(null)

      } else {
        // Refresh failed
        const errorMessage = data.error || 'Token refresh failed'
        console.error('Token refresh failed:', errorMessage)

        stateRef.current.lastError = errorMessage
        onRefreshError?.(errorMessage)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error during token refresh'
      console.error('Token refresh error:', error)

      stateRef.current.lastError = errorMessage
      onRefreshError?.(errorMessage)

    } finally {
      isRefreshingRef.current = false
      stateRef.current.isRefreshing = false
    }
  }, [currentToken, userEmail, onRefreshSuccess, onRefreshError, onLogoutRequired, updateNextRefreshTime])

  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (!enabled || !userEmail || !currentToken) {
      console.log('Auto token refresh not started:', { enabled, hasUser: !!userEmail, hasToken: !!currentToken })
      return
    }

    console.log(`Starting auto token refresh every ${actualIntervalMinutes} minutes for user:`, userEmail)

    // Set initial next refresh time
    updateNextRefreshTime()

    // Create interval for automatic refresh
    intervalRef.current = setInterval(() => {
      refreshToken()
    }, actualIntervalMinutes * 60 * 1000) // Convert minutes to milliseconds

    // Perform initial refresh after a short delay (30 seconds)
    setTimeout(() => {
      refreshToken()
    }, 30 * 1000)

  }, [enabled, userEmail, currentToken, actualIntervalMinutes, refreshToken, updateNextRefreshTime])

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      console.log('Auto token refresh stopped')
    }
    stateRef.current.nextRefreshTime = null
  }, [])

  const manualRefresh = useCallback(async () => {
    console.log('Manual token refresh triggered')
    await refreshToken()
  }, [refreshToken])

  // Setup and cleanup intervals
  useEffect(() => {
    startAutoRefresh()

    return () => {
      stopAutoRefresh()
    }
  }, [startAutoRefresh, stopAutoRefresh])

  // Stop refresh when user logs out
  useEffect(() => {
    if (!userEmail) {
      stopAutoRefresh()
    }
  }, [userEmail, stopAutoRefresh])

  return {
    // Actions
    startAutoRefresh,
    stopAutoRefresh,
    manualRefresh,

    // State
    isRefreshing: stateRef.current.isRefreshing,
    lastRefreshTime: stateRef.current.lastRefreshTime,
    nextRefreshTime: stateRef.current.nextRefreshTime,
    refreshCount: stateRef.current.refreshCount,
    lastError: stateRef.current.lastError,

    // Config
    intervalMinutes: actualIntervalMinutes,
    enabled: enabled && !!userEmail && !!currentToken
  }
}