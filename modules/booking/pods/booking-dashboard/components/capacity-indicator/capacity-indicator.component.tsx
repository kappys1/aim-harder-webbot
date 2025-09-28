"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import React from "react";

import { cn } from "@/lib/utils";
import {
  BookingCapacity,
  BookingStatus,
} from "@/modules/booking/models/booking.model";
import { BookingUtils } from "@/modules/booking/utils/booking.utils";

interface CapacityIndicatorProps {
  capacity: BookingCapacity;
  status: BookingStatus;
  className?: string;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

export function CapacityIndicator({
  capacity,
  status,
  className,
  showDetails = true,
  size = "md",
}: CapacityIndicatorProps) {
  const getProgressColor = () => {
    switch (status) {
      case BookingStatus.AVAILABLE:
        return capacity.percentage < 50
          ? "bg-green-500"
          : capacity.percentage < 80
          ? "bg-yellow-500"
          : "bg-orange-500";
      case BookingStatus.BOOKED:
        return "bg-blue-500";
      case BookingStatus.FULL:
        return "bg-red-500";
      case BookingStatus.WAITLIST:
        return "bg-orange-500";
      case BookingStatus.DISABLED:
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusBadge = () => {
    const statusText = BookingUtils.getStatusText(status);
    const variant =
      status === BookingStatus.AVAILABLE ? "default" : "secondary";

    return (
      <Badge
        variant={variant}
        className={cn(
          "text-xs",
          size === "sm" && "text-[10px] px-1.5 py-0.5",
          size === "lg" && "text-sm px-3 py-1"
        )}
        style={{
          backgroundColor: BookingUtils.getStatusColor(status),
          borderColor: BookingUtils.getStatusColor(status),
        }}
      >
        {statusText}
      </Badge>
    );
  };

  const sizeClasses = {
    sm: {
      progress: "h-1.5",
      text: "text-xs",
      gap: "gap-1",
    },
    md: {
      progress: "h-2",
      text: "text-sm",
      gap: "gap-2",
    },
    lg: {
      progress: "h-3",
      text: "text-base",
      gap: "gap-3",
    },
  };

  return (
    <div className={cn("flex flex-col", sizeClasses[size].gap, className)}>
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        {getStatusBadge()}

        {showDetails && (
          <span
            className={cn(
              "text-muted-foreground font-medium",
              sizeClasses[size].text
            )}
          >
            {capacity.current}/{capacity.limit}
          </span>
        )}
      </div>

      {/* Capacity Progress Bar */}
      <div className="w-full">
        <Progress
          value={capacity.percentage}
          className={cn(sizeClasses[size].progress, "w-full")}
          style={
            {
              "--progress-background": getProgressColor(),
            } as React.CSSProperties
          }
        />
      </div>

      {/* Additional Details */}
      {showDetails && (
        <div
          className={cn(
            "flex items-center justify-between",
            sizeClasses[size].text
          )}
        >
          <span className="text-muted-foreground">
            {capacity.available > 0
              ? `${capacity.available} disponibles`
              : "Completo"}
          </span>

          {capacity.hasWaitlist && capacity.waitlistCount > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-orange-600 border-orange-200 bg-orange-50",
                size === "sm" && "text-[10px] px-1.5 py-0.5",
                size === "lg" && "text-sm px-3 py-1"
              )}
            >
              +{capacity.waitlistCount} en espera
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
