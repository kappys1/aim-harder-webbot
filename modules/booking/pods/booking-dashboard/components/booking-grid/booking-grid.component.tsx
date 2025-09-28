"use client";

import { useMemo } from "react";
import { BookingCard } from "../booking-card/booking-card.component";

import { cn } from "@/lib/utils";
import { Booking, BookingFilter } from "@/modules/booking/models/booking.model";
import { BookingUtils } from "@/modules/booking/utils/booking.utils";

interface BookingGridProps {
  bookings: Booking[];
  onBook?: (bookingId: number) => void;
  onCancel?: (bookingId: number) => void;
  filter?: BookingFilter | null;
  variant?: "default" | "compact" | "detailed";
  className?: string;
  showActions?: boolean;
  groupByTimeSlot?: boolean;
}

interface TimeSlotGroup {
  timeSlotId: string;
  timeSlot: string;
  bookings: Booking[];
}

export function BookingGrid({
  bookings,
  onBook,
  onCancel,
  filter,
  variant = "default",
  className,
  showActions = true,
  groupByTimeSlot = false,
}: BookingGridProps) {
  const processedBookings = useMemo(() => {
    let filtered = bookings;

    if (filter) {
      filtered = BookingUtils.filterBookings(bookings, filter);
    }

    return BookingUtils.sortBookingsByTime(filtered);
  }, [bookings, filter]);

  const timeSlotGroups = useMemo(() => {
    if (!groupByTimeSlot) return null;

    const grouped = BookingUtils.groupBookingsByTimeSlot(processedBookings);

    return Object.entries(grouped).map(([timeSlotId, bookings]) => ({
      timeSlotId,
      timeSlot: bookings[0]?.timeSlot.time || "",
      bookings: BookingUtils.sortBookingsByTime(bookings),
    }));
  }, [processedBookings, groupByTimeSlot]);

  const getGridClasses = () => {
    const baseClasses = "grid gap-4";

    switch (variant) {
      case "compact":
        return cn(
          baseClasses,
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        );
      case "detailed":
        return cn(baseClasses, "grid-cols-1 lg:grid-cols-2");
      default:
        return cn(baseClasses, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3");
    }
  };

  if (processedBookings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No hay clases disponibles</p>
          <p className="text-sm mt-2">
            {filter ? "Intenta ajustar los filtros" : "Selecciona otra fecha"}
          </p>
        </div>
      </div>
    );
  }

  if (groupByTimeSlot && timeSlotGroups) {
    return (
      <div className={cn("space-y-8", className)}>
        {timeSlotGroups.map((group) => (
          <div key={group.timeSlotId} className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-semibold text-foreground">
                {group.timeSlot}
              </h3>
              <p className="text-sm text-muted-foreground">
                {group.bookings.length}{" "}
                {group.bookings.length === 1 ? "clase" : "clases"}
              </p>
            </div>

            <div className={getGridClasses()}>
              {group.bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onBook={onBook}
                  onCancel={onCancel}
                  variant={variant}
                  showActions={showActions}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(getGridClasses(), className)}>
      {processedBookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onBook={onBook}
          onCancel={onCancel}
          variant={variant}
          showActions={showActions}
        />
      ))}
    </div>
  );
}
