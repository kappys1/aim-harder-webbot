"use client"

import { Button } from "@/common/ui/button"
import { useRefreshToken } from "../hooks/useRefreshToken.hook"
import { useEffect } from "react"
import { cn } from "@/common/lib/utils"

interface RefreshIndicatorProps {
  email: string
  className?: string
  autoRefresh?: boolean
}

export function RefreshIndicator({
  email,
  className,
  autoRefresh = true
}: RefreshIndicatorProps) {
  const {
    isRefreshing,
    needsRefresh,
    lastRefreshDate,
    refreshCount,
    error,
    checkRefreshStatus,
    refreshNow,
    autoRefreshIfNeeded
  } = useRefreshToken()

  useEffect(() => {
    if (email) {
      checkRefreshStatus(email)
    }
  }, [email, checkRefreshStatus])

  useEffect(() => {
    if (autoRefresh && needsRefresh && email && !isRefreshing) {
      autoRefreshIfNeeded(email)
    }
  }, [autoRefresh, needsRefresh, email, isRefreshing, autoRefreshIfNeeded])

  const handleManualRefresh = () => {
    if (email && !isRefreshing) {
      refreshNow(email)
    }
  }

  const formatRefreshDate = (date?: Date) => {
    if (!date) return 'Never'
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60)),
      'hour'
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Status Display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Session Status:</span>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              needsRefresh ? "bg-yellow-500" : "bg-green-500"
            )}
          />
          <span className={cn(
            needsRefresh ? "text-yellow-600" : "text-green-600"
          )}>
            {needsRefresh ? "Needs Refresh" : "Active"}
          </span>
        </div>
      </div>

      {/* Refresh Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div>Last refresh: {formatRefreshDate(lastRefreshDate)}</div>
        <div>Refresh count: {refreshCount}</div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          {error}
        </div>
      )}

      {/* Manual Refresh Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="w-full"
      >
        {isRefreshing ? "Refreshing..." : "Refresh Session"}
      </Button>
    </div>
  )
}