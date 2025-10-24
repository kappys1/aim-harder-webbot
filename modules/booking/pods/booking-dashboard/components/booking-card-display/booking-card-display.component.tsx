/**
 * BookingCardDisplay - Server Component
 * Renders booking information (static content)
 * Receives actions as children for client-side interactivity
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/common/ui/avatar";
import { Badge } from "@/common/ui/badge";
import { Card, CardAction, CardContent, CardHeader } from "@/common/ui/card";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { Booking, BookingStatus } from "@/modules/booking/models/booking.model";
import type { BoxWithAccess } from "@/modules/boxes/models/box.model";

interface BookingCardDisplayProps {
  booking: Booking;
  actions?: React.ReactNode;
}

function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.AVAILABLE:
      return "bg-green-100 text-green-800";
    case BookingStatus.BOOKED:
      return "bg-blue-100 text-blue-800";
    case BookingStatus.FULL:
      return "bg-red-100 text-red-800";
    case BookingStatus.WAITLIST:
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.AVAILABLE:
      return "Disponible";
    case BookingStatus.BOOKED:
      return "Reservada";
    case BookingStatus.FULL:
      return "Lleno";
    case BookingStatus.WAITLIST:
      return "Lista de espera";
    default:
      return status;
  }
}

export function BookingCardDisplay({
  booking,
  actions,
}: BookingCardDisplayProps) {
  const startTime = booking.timeSlot.startTime || booking.timeSlot.time;
  const endTime = booking.timeSlot.endTime;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{booking.class.name}</h3>
            <p className="text-sm text-gray-600">{booking.class.description}</p>
          </div>
          <Badge className={getStatusColor(booking.status)}>
            {getStatusLabel(booking.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Time */}
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Hora</p>
            <p className="font-semibold">
              {startTime} {endTime ? `- ${endTime}` : ""}
            </p>
          </div>
        </div>

        {/* Location */}
        {booking.box && (
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Ubicación</p>
              <p className="font-semibold">{booking.box.name}</p>
            </div>
          </div>
        )}

        {/* Capacity */}
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Capacidad</p>
            <p className="font-semibold">
              {booking.capacity.current}/{booking.capacity.limit} personas
            </p>
          </div>
        </div>

        {/* Coach */}
        {booking.coach.name && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Entrenador</p>
            <div className="flex gap-2 items-center">
              <Avatar className="h-8 w-8">
                {booking.coach.avatar && <AvatarImage src={booking.coach.avatar} />}
                <AvatarFallback>
                  {booking.coach.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{booking.coach.name}</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Actions */}
      {actions && <CardAction>{actions}</CardAction>}
    </Card>
  );
}
