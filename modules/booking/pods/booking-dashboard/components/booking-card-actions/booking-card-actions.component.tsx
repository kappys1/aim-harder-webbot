"use client";

/**
 * BookingCardActions - Client Component
 * Handles booking actions (book, cancel, cancel prebooking)
 * Calls server actions and manages loading states
 * Minimal client-side logic focused on interactivity
 */

import { Button } from "@/common/ui/button";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Booking, BookingStatus } from "../../../../models/booking.model";
import { BookingUtils } from "../../../../utils/booking.utils";
import {
  cancelBookingAction,
  createBookingAction,
} from "../../../../api/server-actions/booking.actions";
import { cn } from "@/common/lib/utils";
import { PreBooking } from "@/modules/prebooking/models/prebooking.model";

interface BookingCardActionsProps {
  booking: Booking;
  onBookingSuccess?: () => void;
  onCancelSuccess?: () => void;
  onPrebookingCancelSuccess?: () => void;
  onBook?: (bookingId: number) => void;
  onCancel?: (bookingId: number) => void;
  onCancelPrebooking?: (prebookingId: string) => void;
  prebooking?: PreBooking;
}

export function BookingCardActions({
  booking,
  onBookingSuccess,
  onCancelSuccess,
  onPrebookingCancelSuccess,
  onBook,
  onCancel,
  onCancelPrebooking,
  prebooking,
}: BookingCardActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isUserBooked = booking.userBookingId !== null;
  const canBook = BookingUtils.canUserBook(booking);
  const canCancel = BookingUtils.canUserCancel(booking);
  const hasActivePrebooking =
    prebooking &&
    (prebooking.status === "pending" || prebooking.status === "loaded");

  const handleBooking = useCallback(async () => {
    if (!canBook || isLoading) return;

    setIsLoading(true);

    try {
      // Call the callback if provided (for optimistic updates)
      if (onBook) {
        onBook(booking.id);
      }

      // Since server actions don't match the exact signature expected,
      // we'll keep client-side handlers for now
      // TODO: Full migration to server actions in future refactor
      toast.info("Procesando reserva...");
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(
        "Error al realizar la reserva. Por favor intenta de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  }, [booking.id, canBook, isLoading, onBook]);

  const handleCancel = useCallback(async () => {
    if (!canCancel || isLoading) return;

    const confirmed = confirm(
      "¿Estás seguro de que quieres cancelar esta reserva?"
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      // Call the callback if provided
      if (onCancel) {
        onCancel(booking.id);
      }

      toast.info("Procesando cancelación...");
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Error al cancelar la reserva. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [booking.id, canCancel, isLoading, onCancel]);

  const handleCancelPrebooking = useCallback(async () => {
    if (!prebooking || isLoading) return;

    const confirmed = confirm(
      "¿Estás seguro de que quieres cancelar esta prereserva?"
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      if (onCancelPrebooking) {
        onCancelPrebooking(prebooking.id);
      }

      toast.info("Procesando cancelación de prereserva...");
    } catch (error) {
      console.error("Cancel prebooking error:", error);
      toast.error(
        "Error al cancelar la prereserva. Por favor intenta de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  }, [prebooking, isLoading, onCancelPrebooking]);

  const handleActionClick = useCallback(() => {
    if (isUserBooked && canCancel) {
      handleCancel();
    } else if (!isUserBooked && canBook) {
      handleBooking();
    }
  }, [isUserBooked, canCancel, canBook, handleCancel, handleBooking]);

  const getActionButton = () => {
    // If there's an active prebooking, show cancel prebooking button
    if (hasActivePrebooking) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelPrebooking}
          className="text-orange-600 border-orange-200 hover:bg-orange-50"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isLoading ? "Cancelando..." : "Cancelar Prereserva"}
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
          disabled={!canCancel || isLoading}
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isLoading ? "Cancelando..." : "Cancelar"}
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

  return getActionButton();
}
