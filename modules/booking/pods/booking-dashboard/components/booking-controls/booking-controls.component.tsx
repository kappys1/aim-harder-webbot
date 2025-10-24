'use client';

/**
 * BookingControls - Client Component
 * Handles date/week navigation and filtering
 * Minimal client-side code focused on interactivity
 */

import { Button } from "@/common/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { WeekSelector } from "../week-selector";
import { BookingUtils } from "@/modules/booking/utils/booking.utils";
import { toast } from "sonner";

interface BookingControlsProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
}

export function BookingControls({
  selectedDate,
  onDateChange,
}: BookingControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = useCallback(
    (date: string) => {
      // Check if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selectedDateObj = new Date(date);
      selectedDateObj.setHours(0, 0, 0, 0);

      if (selectedDateObj < today) {
        const todayString = BookingUtils.formatDateForRoute(today);

        const params = new URLSearchParams(searchParams.toString());
        params.set("date", todayString);
        router.replace(`/booking?${params.toString()}`);

        toast.info("Fecha actualizada", {
          description:
            "No se puede acceder a fechas pasadas. Se ha redirigido a hoy.",
        });
        return;
      }

      // Update URL with new date
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date);
      router.push(`/booking?${params.toString()}`);

      // Call optional callback
      onDateChange?.(date);
    },
    [router, searchParams, onDateChange]
  );

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Selecciona una fecha</h2>
        <Button
          variant="outline"
          onClick={() => {
            const today = new Date();
            const todayString = BookingUtils.formatDateForRoute(today);
            handleDateChange(todayString);
          }}
        >
          Hoy
        </Button>
      </div>

      <WeekSelector selectedDate={selectedDate} onDateChange={handleDateChange} />
    </div>
  );
}
