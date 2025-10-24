/**
 * BookingHeader - Server Component
 * Displays header with box information
 * No interactivity - pure server-side rendering
 */

import { Card } from "@/common/ui/card";
import { BookingDay } from "@/modules/booking/models/booking.model";
import type { BoxWithAccess } from "@/modules/boxes/models/box.model";

interface BookingHeaderProps {
  selectedBox?: BoxWithAccess;
  bookingDay?: BookingDay;
  isLoading?: boolean;
  error?: string | null;
}

export function BookingHeader({
  selectedBox,
  bookingDay,
  isLoading,
  error,
}: BookingHeaderProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 p-4">
        <p className="text-red-800">{error}</p>
      </Card>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">
          {selectedBox?.name || "Reservas"}
        </h1>
        {selectedBox?.subdomain && (
          <p className="text-sm text-gray-600 mt-1">
            {selectedBox.subdomain}.aimharder.com
          </p>
        )}
      </div>

      {bookingDay && (
        <div className="text-sm text-gray-600">
          {bookingDay.bookings.length} clases disponibles
        </div>
      )}

      {isLoading && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">Cargando datos...</p>
        </div>
      )}
    </div>
  );
}
