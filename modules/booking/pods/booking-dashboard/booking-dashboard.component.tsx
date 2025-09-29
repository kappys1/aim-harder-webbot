"use client";

import { Button } from "@/common/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { AuthCookie } from "../../../auth/api/services/cookie.service";
import { useBooking } from "../../hooks/useBooking.hook";
import { BookingProvider, useBookingContext } from "../../hooks/useBookingContext.hook";
import { BookingStatus } from "../../models/booking.model";
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

  const { actions } = useBookingContext();
  const [bookingLoading, setBookingLoading] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState<number | null>(null);

  const handleDateChange = useCallback(
    (date: string) => {
      setDate(date);
    },
    [setDate]
  );

  const handleBooking = useCallback(
    async (bookingId: number) => {
      if (!bookingDay?.date) return;

      setBookingLoading(bookingId);

      try {
        const apiDate = BookingUtils.formatDateForApi(bookingDay.date);
        const bookingRequest = {
          day: apiDate,
          familyId: "",
          id: bookingId.toString(),
          insist: 0,
        };

        // Use our internal API endpoint instead of external service directly
        const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null;

        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userEmail && { 'x-user-email': userEmail }),
          },
          body: JSON.stringify(bookingRequest),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          // Success - Update local state optimistically
          if (bookingDay) {
            const updatedBookings = bookingDay.bookings.map(b =>
              b.id === bookingId
                ? {
                    ...b,
                    status: BookingStatus.BOOKED,
                    userBookingId: parseInt(data.bookingId || '0'),
                    capacity: {
                      ...b.capacity,
                      current: b.capacity.current + 1,
                      available: Math.max(0, b.capacity.available - 1),
                      percentage: b.capacity.limit > 0 ? ((b.capacity.current + 1) / b.capacity.limit) * 100 : 0
                    }
                  }
                : b
            );

            const updatedDay = {
              ...bookingDay,
              bookings: updatedBookings
            };

            // Update local state immediately
            actions.setCurrentDay(updatedDay);
          }

          alert(`✅ Reserva exitosa! ID: ${data.bookingId}`);
          // Also refresh from server to ensure consistency
          refetch();
        } else {
          // Handle different error types
          if (data.error === 'early_booking') {
            alert(`⏰ ${data.message}`);
          } else if (data.error === 'max_bookings_reached') {
            alert(`🚫 ${data.message}`);
          } else {
            alert(`❌ Error: ${data.message || 'Error desconocido'}`);
          }
        }
      } catch (error) {
        console.error('Booking error:', error);
        alert('❌ Error de conexión al realizar la reserva');
      } finally {
        setBookingLoading(null);
      }
    },
    [bookingDay, refetch, actions]
  );

  const handleCancelBooking = useCallback(
    async (bookingId: number) => {
      if (!bookingDay) return;

      // Find the booking to get the userBookingId
      const booking = bookingDay.bookings.find(b => b.id === bookingId);
      if (!booking || !booking.userBookingId) {
        alert("❌ Error: No se encontró la información de la reserva para cancelar");
        return;
      }

      const confirmed = confirm("¿Estás seguro de que quieres cancelar esta reserva?");
      if (!confirmed) return;

      setCancelLoading(bookingId);

      try {
        const cancelRequest = {
          id: booking.userBookingId.toString(),
          late: 0,
          familyId: "",
        };

        // Use our internal API endpoint for cancellation
        const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null;

        const response = await fetch('/api/booking', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(userEmail && { 'x-user-email': userEmail }),
          },
          body: JSON.stringify(cancelRequest),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          // Success - Update local state optimistically
          const updatedBookings = bookingDay.bookings.map(b =>
            b.id === bookingId
              ? {
                  ...b,
                  status: BookingStatus.AVAILABLE,
                  userBookingId: null,
                  capacity: {
                    ...b.capacity,
                    current: Math.max(0, b.capacity.current - 1),
                    available: b.capacity.available + 1,
                    percentage: b.capacity.limit > 0 ? ((b.capacity.current - 1) / b.capacity.limit) * 100 : 0
                  }
                }
              : b
          );

          const updatedDay = {
            ...bookingDay,
            bookings: updatedBookings
          };

          // Update local state immediately
          actions.setCurrentDay(updatedDay);

          alert(`✅ Reserva cancelada exitosamente!`);
          // Also refresh from server to ensure consistency
          refetch();
        } else {
          // Handle error
          alert(`❌ Error al cancelar: ${data.message || 'Error desconocido'}`);
        }
      } catch (error) {
        console.error('Cancellation error:', error);
        alert('❌ Error de conexión al cancelar la reserva');
      } finally {
        setCancelLoading(null);
      }
    },
    [bookingDay, refetch, actions]
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
          onBook={handleBooking}
          onCancel={handleCancelBooking}
          showActions={true}
          loadingBookingId={bookingLoading}
          cancellingBookingId={cancelLoading}
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
