"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/common/ui/avatar";
import { Badge } from "@/common/ui/badge";
import { Button } from "@/common/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/common/ui/card";
import { Calendar, Clock, Loader2, MapPin, Users } from "lucide-react";

import { cn } from "@/common/lib/utils";
import { Booking, BookingStatus } from "@/modules/booking/models/booking.model";
import { BookingUtils } from "@/modules/booking/utils/booking.utils";
import { PreBooking } from "@/modules/prebooking/models/prebooking.model";
import { PreBookingBadge } from "@/modules/prebooking/pods/prebooking/components/PreBookingBadge.component";
import { CapacityIndicator } from "../capacity-indicator/capacity-indicator.component";

interface BookingCardProps {
  booking: Booking;
  onBook?: (bookingId: number) => void;
  onCancel?: (bookingId: number) => void;
  onCancelPrebooking?: (prebookingId: string) => void;
  className?: string;
  variant?: "default" | "compact" | "detailed";
  showActions?: boolean;
  isLoading?: boolean;
  isCancelling?: boolean;
  prebooking?: PreBooking;
  isCancellingPrebooking?: boolean;
}

export function BookingCard({
  booking,
  onBook,
  onCancel,
  onCancelPrebooking,
  className,
  variant = "default",
  showActions = true,
  isLoading = false,
  isCancelling = false,
  prebooking,
  isCancellingPrebooking = false,
}: BookingCardProps) {
  const isUserBooked = booking.userBookingId !== null;
  const canBook = BookingUtils.canUserBook(booking);
  const canCancel = BookingUtils.canUserCancel(booking);
  const hasActivePrebooking =
    prebooking &&
    (prebooking.status === "pending" || prebooking.status === "loaded");

  const handleActionClick = () => {
    if (isUserBooked && canCancel && onCancel) {
      onCancel(booking.id);
    } else if (!isUserBooked && canBook && onBook) {
      onBook(booking.id);
    }
  };

  const handleCancelPrebooking = () => {
    if (prebooking && onCancelPrebooking) {
      onCancelPrebooking(prebooking.id);
    }
  };

  const getActionButton = () => {
    if (!showActions) return null;

    // If there's an active prebooking, show cancel prebooking button
    if (hasActivePrebooking) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelPrebooking}
          className="text-orange-600 border-orange-200 hover:bg-orange-50"
          disabled={isCancellingPrebooking}
        >
          {isCancellingPrebooking && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {isCancellingPrebooking ? "Cancelando..." : "Cancelar Prereserva"}
        </Button>
      );
    }

    if (isUserBooked) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleActionClick}
          className="text-red-600 border-red-200 hover:bg-red-50"
          disabled={!canCancel || isCancelling}
        >
          {isCancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isCancelling ? "Cancelando..." : "Cancelar"}
        </Button>
      );
    }

    if (booking.status === BookingStatus.DISABLED) {
      return (
        <Button variant="outline" size="sm" disabled>
          No disponible
        </Button>
      );
    }

    if (
      booking.status === BookingStatus.FULL &&
      !booking.capacity.hasWaitlist
    ) {
      return (
        <Button variant="outline" size="sm" disabled>
          Completo
        </Button>
      );
    }

    return (
      <Button
        variant={
          booking.status === BookingStatus.AVAILABLE ? "default" : "outline"
        }
        size="sm"
        onClick={handleActionClick}
        disabled={!canBook || isLoading}
        className={cn(
          booking.status === BookingStatus.WAITLIST &&
            "text-orange-600 border-orange-200 hover:bg-orange-50"
        )}
      >
        {isLoading ? "Reservando..." : "Reservar"}
      </Button>
    );
  };

  const cardClasses = cn(
    // Card is NOT interactive - only the button inside is
    // Removed card-interactive class to prevent scaling on the entire card
    isUserBooked && "ring-2 ring-blue-500 ring-offset-2",
    booking.status === BookingStatus.DISABLED && "opacity-60",
    variant === "compact" && "py-4",
    variant === "detailed" && "py-8",
    className
  );

  if (variant === "compact") {
    return (
      <Card className={cardClasses}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="font-semibold text-lg">
                  {booking.timeSlot.startTime}
                </div>
                <div className="text-xs text-muted-foreground">
                  {booking.class.duration}min
                </div>
              </div>

              <div className="flex-1">
                <div className="font-medium">{booking.class.name}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {booking.capacity.current}/{booking.capacity.limit}
                </div>
              </div>
            </div>

            {getActionButton()}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClasses}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: booking.class.color }}
            />
            <div>
              <h3 className="font-semibold text-lg">{booking.class.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{booking.timeSlot.time}</span>
                <span>•</span>
                <span>{booking.class.duration} min</span>
              </div>
            </div>
          </div>

          {showActions && <CardAction>{getActionButton()}</CardAction>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Prebooking Badge */}
        {prebooking && <PreBookingBadge prebooking={prebooking} />}

        {/* Capacity Indicator */}
        <CapacityIndicator
          capacity={booking.capacity}
          status={booking.status}
          size="md"
        />

        {/* Box and Coach Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{booking.box.name}</span>
          </div>

          {booking.coach.name && (
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage
                  src={booking.coach.avatar || undefined}
                  alt={booking.coach.name}
                />
                <AvatarFallback className="text-xs">
                  {booking.coach.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {booking.coach.name}
              </span>
            </div>
          )}
        </div>

        {/* Additional Info */}
        {variant === "detailed" && (
          <div className="space-y-2 pt-2 border-t">
            {booking.class.description && (
              <p className="text-sm text-muted-foreground">
                {booking.class.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {!booking.isIncludedInPlan && (
                <Badge variant="outline" className="text-orange-600">
                  No incluido en plan
                </Badge>
              )}

              {booking.hasZoomAccess && (
                <Badge variant="outline" className="text-blue-600">
                  Online disponible
                </Badge>
              )}

              {booking.class.isOnline && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Clase virtual</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
