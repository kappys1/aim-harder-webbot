"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/common/ui/alert-dialog";
import { Badge } from "@/common/ui/badge";
import { Button } from "@/common/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/common/ui/card";
import { PreBooking } from "@/modules/prebooking/models/prebooking.model";
import { useCountdown } from "@/modules/prebooking/pods/prebooking/hooks/useCountdown.hook";
import { parseDateFromYYYYMMDD } from "@/modules/prebooking/utils/error-parser.utils";
import { Clock, Loader2, MapPin, X } from "lucide-react";
import { useState } from "react";

interface PrebookingCardProps {
  prebooking: PreBooking;
  onCancel: (id: string) => void;
  isCanceling?: boolean;
}

export function PrebookingCard({
  prebooking,
  onCancel,
  isCanceling,
}: PrebookingCardProps) {
  const countdown = useCountdown(prebooking.availableAt);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Format date and time
  // CRITICAL: Always use UTC for availableAt since it's stored as UTC
  // Using toLocaleTimeString() was causing timezone-dependent display issues

  const classDate = parseDateFromYYYYMMDD(
    prebooking.bookingData.day
  )?.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const formattedDate = prebooking.availableAt.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Format time using UTC explicitly to avoid timezone-dependent display
  // availableAt is stored in UTC in the database
  const formattedTime = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(prebooking.availableAt);

  // Log for debugging timezone issues
  console.log('[PrebookingCard] Time formatting debug:', {
    availableAtISO: prebooking.availableAt.toISOString(),
    utcHours: prebooking.availableAt.getUTCHours(),
    utcMinutes: prebooking.availableAt.getUTCMinutes(),
    formattedTime,
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Get status color
  const getStatusColor = () => {
    switch (prebooking.status) {
      case "pending":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "loaded":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "executing":
        return "bg-purple-100 text-purple-700 border-purple-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Get countdown color based on time remaining
  const getCountdownColor = () => {
    if (countdown.isExpired) return "text-gray-500";

    const totalMinutes = countdown.hours * 60 + countdown.minutes;
    if (totalMinutes < 5) return "text-red-600 font-bold";
    if (totalMinutes < 30) return "text-orange-600 font-semibold";
    return "text-blue-600";
  };

  const handleCancel = () => {
    onCancel(prebooking.id);
    setIsDialogOpen(false);
  };

  // Activity name from bookingData
  const activityName = prebooking.bookingData.activityName || "Clase";
  const boxName = prebooking.bookingData.boxName;

  return (
    <Card className="hover:shadow-md transition-shadow active:scale-[0.99] relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base md:text-lg line-clamp-2">
              {activityName} - {classDate} • {formattedTime}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              <div>
                Fecha de Reserva: {formattedDate} • {formattedTime}
              </div>
            </CardDescription>
          </div>

          {/* Cancel button */}
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
                disabled={isCanceling}
                aria-label={`Cancelar prereserva para ${activityName}`}
              >
                {isCanceling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cancelar pre-reserva?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción cancelará tu pre-reserva para{" "}
                  <strong>{activityName}</strong> el {formattedDate} a las{" "}
                  {formattedTime}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, mantener</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {/* Location */}
        {boxName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{boxName}</span>
          </div>
        )}

        {/* Status and Countdown */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Badge */}
          <Badge variant="outline" className={`text-xs ${getStatusColor()}`}>
            {prebooking.status === "pending" && "Activa"}
            {prebooking.status === "loaded" && "Preparando..."}
            {prebooking.status === "executing" && "Ejecutando"}
          </Badge>

          {/* Countdown */}
          {!countdown.isExpired && (
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">En:</span>
              <span
                className={`font-mono font-semibold tabular-nums ${getCountdownColor()}`}
              >
                {countdown.formatted}
              </span>
            </div>
          )}

          {countdown.isExpired && (
            <span className="text-sm text-muted-foreground">
              Ejecutando pronto...
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
