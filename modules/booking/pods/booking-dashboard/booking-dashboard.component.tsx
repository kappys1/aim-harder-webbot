"use client";

/**
 * BookingDashboard - Refactored Client Component
 *
 * REFACTORING GOALS:
 * - Reduce client-side JavaScript by 60% (659 LOC → 250 LOC)
 * - Move handlers to BookingCardActions component
 * - Keep composition pattern with smaller, focused components
 * - Use server actions for mutations
 */

import { cn } from "@/common/lib/utils";
import { Button } from "@/common/ui/button";
import { Card, CardContent } from "@/common/ui/card";
import { convertLocalToUTC } from "@/common/utils/timezone.utils";
import { useBoxFromUrl } from "@/modules/boxes/hooks/useBoxFromUrl.hook";
import { useBoxes } from "@/modules/boxes/hooks/useBoxes.hook";
import { usePreBooking } from "@/modules/prebooking/pods/prebooking/hooks/usePreBooking.hook";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthCookie } from "../../../auth/api/services/cookie.service";
import { useBooking } from "../../hooks/useBooking.hook";
import {
  BookingProvider,
  useBookingContext,
} from "../../hooks/useBookingContext.hook";
import { BookingStatus } from "../../models/booking.model";
import { BookingUtils } from "../../utils/booking.utils";
import { BookingGrid } from "./components/booking-grid/booking-grid.component";
import { WeekSelector } from "./components/week-selector";

interface BookingDashboardComponentProps {
  initialDate: string;
  initialBoxId: string;
  authCookies: AuthCookie[];
  isAuthenticated: boolean;
  boxesPrefetch?: any;
}

function BookingDashboardContent({
  authCookies,
  isAuthenticated,
}: {
  authCookies: AuthCookie[];
  isAuthenticated: boolean;
}) {
  const { actions, state } = useBookingContext();
  const [bookingLoading, setBookingLoading] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState<number | null>(null);
  const [cancelPrebookingLoading, setCancelPrebookingLoading] = useState<
    string | null
  >(null);

  const userEmail =
    typeof window !== "undefined" ? localStorage.getItem("user-email") : null;
  const { boxId } = useBoxFromUrl();
  const { boxes } = useBoxes(userEmail || "");
  const {
    prebookings,
    fetchPrebookings,
    hasActivePrebooking,
    getActivePrebookingForSlotDay,
  } = usePreBooking(userEmail || undefined);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Callback memoizado para refetch que incluya prebookings
  const handleRefetch = useCallback(async () => {
    await fetchPrebookings();
  }, [fetchPrebookings]);

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
    onRefetch: handleRefetch,
  });


  // Redirect to today if accessing a past date
  useEffect(() => {
    const currentDate = state.selectedDate;
    if (!currentDate) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDateObj = new Date(currentDate);
    selectedDateObj.setHours(0, 0, 0, 0);

    if (selectedDateObj < today) {
      const todayString = BookingUtils.formatDateForRoute(today);
      setDate(todayString);

      const params = new URLSearchParams(searchParams.toString());
      params.set("date", todayString);
      router.replace(`/booking?${params.toString()}`);

      toast.info("Fecha actualizada", {
        description:
          "No se puede acceder a fechas pasadas. Se ha redirigido a hoy.",
      });
    }
  }, [state.selectedDate, setDate, router, searchParams]);

  const handleDateChange = useCallback(
    (date: string) => {
      setDate(date);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date);
      router.push(`/booking?${params.toString()}`);
    },
    [setDate, router, searchParams]
  );

  // Handlers remain client-side for now - will be migrated to server actions in future
  const handleBooking = useCallback(
    async (bookingId: number) => {
      if (!bookingDay?.date) return;

      setBookingLoading(bookingId);

      try {
        const currentUserEmail =
          typeof window !== "undefined"
            ? localStorage.getItem("user-email")
            : null;

        const apiDate = BookingUtils.formatDateForApi(bookingDay.date);
        const booking = bookingDay.bookings.find((b) => b.id === bookingId);
        const classTime = booking?.timeSlot.startTime || booking?.timeSlot.time;

        if (!boxId) {
          toast.error("Error", {
            description:
              "No se pudo obtener el box seleccionado. Recarga la página.",
          });
          return;
        }

        const boxResponse = await fetch(
          `/api/boxes/${boxId}?email=${currentUserEmail}`
        );
        if (!boxResponse.ok) {
          toast.error("Error", {
            description: "No se pudo obtener la información del box.",
          });
          return;
        }

        const boxResponseData = await boxResponse.json();
        const boxData = boxResponseData.box;

        let classTimeUTC: string | undefined;
        if (classTime) {
          try {
            classTimeUTC = convertLocalToUTC(apiDate, classTime);
          } catch (error) {
            console.error("Error converting class time to UTC:", error);
            toast.error("Error", {
              description: "No se pudo procesar la hora de la clase.",
            });
            return;
          }
        }

        const bookingRequest = {
          day: apiDate,
          familyId: "",
          id: bookingId.toString(),
          insist: 0,
          classTimeUTC,
          activityName: booking?.class?.name || "Clase",
          boxName: booking?.box.name,
          boxId: boxId,
          boxSubdomain: boxData.subdomain,
          boxAimharderId: boxData.box_id,
        };

        const response = await fetch("/api/booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentUserEmail && { "x-user-email": currentUserEmail }),
          },
          body: JSON.stringify(bookingRequest),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          if (bookingDay) {
            const updatedBookings = bookingDay.bookings.map((b) =>
              b.id === bookingId
                ? {
                    ...b,
                    status: BookingStatus.BOOKED,
                    userBookingId: parseInt(data.bookingId || "0"),
                    capacity: {
                      ...b.capacity,
                      current: b.capacity.current + 1,
                      available: Math.max(0, b.capacity.available - 1),
                      percentage:
                        b.capacity.limit > 0
                          ? ((b.capacity.current + 1) / b.capacity.limit) * 100
                          : 0,
                    },
                  }
                : b
            );

            const updatedDay = { ...bookingDay, bookings: updatedBookings };
            actions.setCurrentDay(updatedDay);

            const cacheKey = BookingUtils.getCacheKey(
              bookingDay.date,
              state.selectedBoxId
            );
            actions.cacheDay(cacheKey, updatedDay);
          }

          toast.success("Reserva exitosa", {
            description: `ID: ${data.bookingId}`,
          });
        } else {
          if (data.error === "early_booking") {
            if (data.prebooking) {
              const availableDate = new Date(data.prebooking.availableAt);
              const formattedDate = availableDate.toLocaleString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });

              toast.success("¡Prereserva creada exitosamente!", {
                description: `📅 Se reservará automáticamente el ${formattedDate}`,
              });

              fetchPrebookings();
            } else {
              toast.warning(data.message || "No se puede reservar aún");
            }
          } else if (data.error === "max_bookings_reached") {
            toast.error(data.message || "Máximo de reservas alcanzado");
          } else {
            toast.error(data.message || "Error desconocido");
          }
        }
      } catch (error) {
        console.error("Booking error:", error);
        toast.error(
          "Error de conexión al realizar la reserva / pre reserva. Si has hecho muchas seguidas espera unos segundos"
        );
      } finally {
        setBookingLoading(null);
      }
    },
    [bookingDay, actions, state.selectedBoxId, fetchPrebookings, boxId]
  );

  const handleCancelBooking = useCallback(
    async (bookingId: number) => {
      if (!bookingDay) return;

      const booking = bookingDay.bookings.find((b) => b.id === bookingId);
      if (!booking || !booking.userBookingId) {
        toast.error(
          "No se encontró la información de la reserva para cancelar"
        );
        return;
      }

      const confirmed = confirm(
        "¿Estás seguro de que quieres cancelar esta reserva?"
      );
      if (!confirmed) return;

      setCancelLoading(bookingId);

      try {
        const boxData = boxes?.find((b) => b.id === boxId);
        if (!boxData) {
          throw new Error("Box data not found");
        }

        const cancelRequest = {
          id: booking.userBookingId.toString(),
          late: 0,
          familyId: "",
          boxSubdomain: boxData.subdomain,
        };

        const userEmail =
          typeof window !== "undefined"
            ? localStorage.getItem("user-email")
            : null;

        const response = await fetch("/api/booking", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(userEmail && { "x-user-email": userEmail }),
          },
          body: JSON.stringify(cancelRequest),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          const updatedBookings = bookingDay.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: BookingStatus.AVAILABLE,
                  userBookingId: null,
                  capacity: {
                    ...b.capacity,
                    current: Math.max(0, b.capacity.current - 1),
                    available: b.capacity.available + 1,
                    percentage:
                      b.capacity.limit > 0
                        ? ((b.capacity.current - 1) / b.capacity.limit) * 100
                        : 0,
                  },
                }
              : b
          );

          const updatedDay = { ...bookingDay, bookings: updatedBookings };
          actions.setCurrentDay(updatedDay);

          const cacheKey = BookingUtils.getCacheKey(
            bookingDay.date,
            state.selectedBoxId
          );
          actions.cacheDay(cacheKey, updatedDay);

          toast.success("Reserva cancelada exitosamente");
        } else {
          toast.error(
            `Error al cancelar: ${data.message || "Error desconocido"}`
          );
        }
      } catch (error) {
        console.error("Cancellation error:", error);
        toast.error("Error de conexión al cancelar la reserva");
      } finally {
        setCancelLoading(null);
      }
    },
    [bookingDay, actions, state.selectedBoxId, boxes, boxId]
  );

  const handleCancelPrebooking = useCallback(
    async (prebookingId: string) => {
      const confirmed = confirm(
        "¿Estás seguro de que quieres cancelar esta prereserva?"
      );
      if (!confirmed) return;

      setCancelPrebookingLoading(prebookingId);

      try {
        const userEmail =
          typeof window !== "undefined"
            ? localStorage.getItem("user-email")
            : null;

        const response = await fetch(`/api/prebooking?id=${prebookingId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(userEmail && { "x-user-email": userEmail }),
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          toast.success("Prereserva cancelada exitosamente");
          fetchPrebookings();
        } else {
          toast.error(
            `Error al cancelar: ${data.message || "Error desconocido"}`
          );
        }
      } catch (error) {
        console.error("Cancel prebooking error:", error);
        toast.error("Error de conexión al cancelar la prereserva");
      } finally {
        setCancelPrebookingLoading(null);
      }
    },
    [fetchPrebookings]
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
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Actualizar
          </Button>

          <input
            type="date"
            value={state.selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            min={BookingUtils.formatDateForApi(new Date())}
            className="px-3 py-2 border rounded-md text-sm"
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="flex justify-center sticky top-[102px] md:static bg-background md:bg-transparent z-40 py-4 -mx-4 px-4 md:mx-0 md:px-0 md:py-0">
        <WeekSelector
          selectedDate={state.selectedDate}
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
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {
                    prebookings.filter(
                      (val) =>
                        val.bookingData.day ===
                          BookingUtils.formatDateForApi(state.selectedDate) &&
                        val.status === "pending"
                    ).length
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Pre Reservadas
                </div>
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
          bookingDay={
            bookingDay?.date &&
            BookingUtils.formatDateForApi(new Date(bookingDay?.date))
          }
          bookings={bookingDay.bookings}
          onBook={handleBooking}
          onCancel={handleCancelBooking}
          onCancelPrebooking={handleCancelPrebooking}
          showActions={true}
          loadingBookingId={bookingLoading}
          cancellingBookingId={cancelLoading}
          cancellingPrebookingId={cancelPrebookingLoading}
          prebookings={prebookings}
          hasActivePrebooking={hasActivePrebooking}
          getActivePrebookingForSlotDay={getActivePrebookingForSlotDay}
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
