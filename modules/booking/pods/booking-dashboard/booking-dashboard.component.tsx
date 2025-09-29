"use client";

import { Button } from "@/common/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { AuthCookie } from "../../../auth/api/services/cookie.service";
import { useBooking } from "../../hooks/useBooking.hook";
import { BookingProvider } from "../../hooks/useBookingContext.hook";
import { BookingUtils } from "../../utils/booking.utils";
import { BookingGrid } from "./components/booking-grid/booking-grid.component";
import { WeekSelector } from "./components/week-selector";

interface BookingDashboardComponentProps {
  initialDate: string;
  initialBoxId: string;
  authCookies: AuthCookie[];
  isAuthenticated: boolean;
}

function BookingDashboardContent({
  authCookies,
  isAuthenticated,
}: {
  authCookies: AuthCookie[];
  isAuthenticated: boolean;
}) {
  const {
    bookingDay,
    isLoading,
    error,
    refetch,
    setDate,
    retryOnError,
    statistics,
  } = useBooking({
    autoFetch: true,
    enableCache: true,
    cookies: authCookies,
  });

  const handleDateChange = useCallback(
    (date: string) => {
      setDate(date);
    },
    [setDate]
  );

  const formatDate = (dateString: string) => {
    return BookingUtils.formatDate(dateString, "EEEE, dd MMMM yyyy");
  };

  if (!isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Autenticación requerida</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Necesitas iniciar sesión para ver las reservas disponibles.
              </p>
            </div>
            <Button asChild>
              <a href="/login">Iniciar sesión</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reservas disponibles</h1>
          {bookingDay && (
            <p className="text-muted-foreground mt-1">
              {formatDate(bookingDay.date)} • {bookingDay.bookings.length}{" "}
              clases
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Actualizar
          </Button>

          <input
            type="date"
            value={bookingDay?.date || ""}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="flex justify-center">
        <WeekSelector
          selectedDate={bookingDay?.date || ""}
          onDateChange={handleDateChange}
          className="w-full max-w-md"
          disabled={isLoading}
        />
      </div>

      {/* Statistics and Filters */}
      {statistics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {statistics.booked}
                </div>
                <div className="text-sm text-muted-foreground">Reservadas</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Error al cargar las reservas
                </p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={retryOnError}
                className="text-red-600 border-red-200 hover:bg-red-100"
              >
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Grid */}
      {!isLoading && !error && bookingDay && (
        <BookingGrid
          bookings={bookingDay.bookings}
          onBook={(id) => console.log("Book:", id)}
          onCancel={(id) => console.log("Cancel:", id)}
          showActions={true}
        />
      )}
    </div>
  );
}

export function BookingDashboardComponent({
  initialDate,
  initialBoxId,
  authCookies,
  isAuthenticated,
}: BookingDashboardComponentProps) {
  return (
    <BookingProvider initialDate={initialDate} initialBoxId={initialBoxId}>
      <div className="container mx-auto px-4 py-6">
        <BookingDashboardContent
          authCookies={authCookies}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </BookingProvider>
  );
}
