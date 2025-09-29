'use client'

import { useEffect, useState } from 'react'
import { useAutoTokenRefresh } from '../login/hooks/useAutoTokenRefresh.hook'

export interface AutoTokenRefreshProps {
  /** Interval in minutes for automatic refresh. If not provided, uses NEXT_PUBLIC_TOKEN_REFRESH_INTERVAL_MINUTES env var (default: 15) */
  intervalMinutes?: number
  /** Whether to show debug information in console (default: false) */
  debugMode?: boolean
  /** Whether to enable the component (default: true) */
  enabled?: boolean
}

/**
 * AutoTokenRefresh Component
 *
 * This component automatically manages token refresh for authenticated users.
 * It should be placed at the root level of the application to ensure it runs
 * throughout the user's session.
 *
 * Features:
 * - Automatic token refresh every 15 minutes (configurable)
 * - Handles logout when session expires
 * - Provides debug logging when enabled
 * - Only runs when user is authenticated
 */
export const AutoTokenRefresh: React.FC<AutoTokenRefreshProps> = ({
  intervalMinutes,
  debugMode = false,
  enabled = true
}) => {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Load user email from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('user-email')
      setUserEmail(email)
    }
  }, [])

  const {
    isRefreshing,
    lastRefreshTime,
    nextRefreshTime,
    refreshCount,
    lastError,
    enabled: hookEnabled
  } = useAutoTokenRefresh({
    intervalMinutes,
    enabled: enabled && !!userEmail,
    onRefreshSuccess: (newToken) => {
      if (debugMode) {
        console.log('🔄 Token refresh successful:', {
          user: userEmail,
          newTokenPrefix: newToken.substring(0, 10) + '...',
          timestamp: new Date().toISOString()
        })
      }
    },
    onRefreshError: (error) => {
      if (debugMode) {
        console.error('❌ Token refresh failed:', {
          user: userEmail,
          error,
          timestamp: new Date().toISOString()
        })
      }
    },
    onLogoutRequired: () => {
      if (debugMode) {
        console.log('🚪 Logout required due to expired session:', {
          user: userEmail,
          timestamp: new Date().toISOString()
        })
      }
      // Clear user email when logout is required
      setUserEmail(null)
    }
  })

  // Debug logging
  useEffect(() => {
    if (debugMode && hookEnabled) {
      console.log('🔧 AutoTokenRefresh Status:', {
        user: userEmail,
        isAuthenticated: !!userEmail,
        hookEnabled,
        intervalMinutes,
        isRefreshing,
        refreshCount,
        lastRefreshTime: lastRefreshTime?.toISOString(),
        nextRefreshTime: nextRefreshTime?.toISOString(),
        lastError
      })
    }
  }, [
    debugMode,
    hookEnabled,
    userEmail,
    intervalMinutes,
    isRefreshing,
    refreshCount,
    lastRefreshTime,
    nextRefreshTime,
    lastError
  ])

  // Log when component mounts/unmounts
  useEffect(() => {
    if (debugMode) {
      console.log('🚀 AutoTokenRefresh component mounted:', {
        enabled,
        intervalMinutes,
        user: userEmail,
        isAuthenticated: !!userEmail
      })
    }

    return () => {
      if (debugMode) {
        console.log('🛑 AutoTokenRefresh component unmounted')
      }
    }
  }, [debugMode, enabled, intervalMinutes, userEmail])

  // This component doesn't render anything visible
  return null
}

export default AutoTokenRefresh