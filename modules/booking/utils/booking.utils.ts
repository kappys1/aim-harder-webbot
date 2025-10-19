import { format, isValid, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { BOOKING_CONSTANTS } from "../constants/booking.constants";
import { Booking, BookingFilter, BookingStatus } from "../models/booking.model";

export class BookingUtils {
  static formatDate(
    date: Date | string,
    formatString: string = BOOKING_CONSTANTS.DATE_FORMATS.DISPLAY
  ): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (!isValid(dateObj)) {
      return "";
    }

    return format(dateObj, formatString, { locale: es });
  }

  static formatDateForRoute(date: Date | string): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (!isValid(dateObj)) {
      throw new Error("Invalid date provided");
    }

    return format(dateObj, "yyyy-MM-dd");
  }

  static formatDateForApi(date: Date | string): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (!isValid(dateObj)) {
      throw new Error("Invalid date provided");
    }

    return format(dateObj, "yyyyMMdd");
  }

  static parseTime(timeString: string): { hours: number; minutes: number } {
    const [hoursStr, minutesStr] = timeString.split(":");
    return {
      hours: parseInt(hoursStr, 10) || 0,
      minutes: parseInt(minutesStr, 10) || 0,
    };
  }

  static calculateCapacityPercentage(current: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.round((current / limit) * 100);
  }

  static getCapacityColor(percentage: number): string {
    if (percentage < 50) return BOOKING_CONSTANTS.UI.COLORS.AVAILABLE;
    if (percentage < 80) return BOOKING_CONSTANTS.UI.COLORS.WAITLIST;
    return BOOKING_CONSTANTS.UI.COLORS.FULL;
  }

  static getStatusColor(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.AVAILABLE:
        return BOOKING_CONSTANTS.UI.COLORS.AVAILABLE;
      case BookingStatus.BOOKED:
        return BOOKING_CONSTANTS.UI.COLORS.BOOKED;
      case BookingStatus.FULL:
        return BOOKING_CONSTANTS.UI.COLORS.FULL;
      case BookingStatus.WAITLIST:
        return BOOKING_CONSTANTS.UI.COLORS.WAITLIST;
      case BookingStatus.DISABLED:
        return BOOKING_CONSTANTS.UI.COLORS.DISABLED;
      default:
        return BOOKING_CONSTANTS.UI.COLORS.DISABLED;
    }
  }

  static getStatusText(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.AVAILABLE:
        return "Disponible";
      case BookingStatus.BOOKED:
        return "Reservado";
      case BookingStatus.FULL:
        return "Completo";
      case BookingStatus.WAITLIST:
        return "Lista de espera";
      case BookingStatus.DISABLED:
        return "No disponible";
      default:
        return "Desconocido";
    }
  }

  static isBookingAvailable(booking: Booking): boolean {
    return (
      booking.status === BookingStatus.AVAILABLE ||
      booking.status === BookingStatus.WAITLIST
    );
  }

  static canUserBook(booking: Booking): boolean {
    return (
      this.isBookingAvailable(booking) &&
      booking.isIncludedInPlan &&
      !booking.userBookingId
    );
  }

  static canUserCancel(booking: Booking): boolean {
    return (
      booking.status === BookingStatus.BOOKED ||
      (booking.status === BookingStatus.WAITLIST &&
        booking.userBookingId !== null)
    );
  }

  static filterBookings(bookings: Booking[], filter: BookingFilter): Booking[] {
    return bookings.filter((booking) => {
      if (filter.classTypes && filter.classTypes.length > 0) {
        if (!filter.classTypes.includes(booking.class.name)) {
          return false;
        }
      }

      if (filter.timeRange) {
        const startTime = this.parseTime(booking.timeSlot.startTime);
        const endTime = this.parseTime(booking.timeSlot.endTime);
        const filterStart = this.parseTime(filter.timeRange.start);
        const filterEnd = this.parseTime(filter.timeRange.end);

        const bookingStartMinutes = startTime.hours * 60 + startTime.minutes;
        const bookingEndMinutes = endTime.hours * 60 + endTime.minutes;
        const filterStartMinutes = filterStart.hours * 60 + filterStart.minutes;
        const filterEndMinutes = filterEnd.hours * 60 + filterEnd.minutes;

        if (
          bookingStartMinutes < filterStartMinutes ||
          bookingEndMinutes > filterEndMinutes
        ) {
          return false;
        }
      }

      if (filter.availabilityOnly) {
        if (!this.isBookingAvailable(booking)) {
          return false;
        }
      }

      if (filter.includeWaitlist === false) {
        if (booking.status === BookingStatus.WAITLIST) {
          return false;
        }
      }

      return true;
    });
  }

  static sortBookingsByTime(bookings: Booking[]): Booking[] {
    return [...bookings].sort((a, b) => {
      const timeA = this.parseTime(a.timeSlot.startTime);
      const timeB = this.parseTime(b.timeSlot.startTime);

      const minutesA = timeA.hours * 60 + timeA.minutes;
      const minutesB = timeB.hours * 60 + timeB.minutes;

      return minutesA - minutesB;
    });
  }

  static groupBookingsByTimeSlot(
    bookings: Booking[]
  ): Record<string, Booking[]> {
    return bookings.reduce((groups, booking) => {
      const timeSlotId = booking.timeSlot.id;
      if (!groups[timeSlotId]) {
        groups[timeSlotId] = [];
      }
      groups[timeSlotId].push(booking);
      return groups;
    }, {} as Record<string, Booking[]>);
  }

  static getAvailableClassTypes(bookings: Booking[]): string[] {
    const classTypes = new Set(bookings.map((booking) => booking.class.name));
    return Array.from(classTypes).sort();
  }

  static getCacheKey(date: string, boxId: string): string {
    return `bookings_${boxId}_${date}`;
  }

  static isToday(date: string): boolean {
    const today = new Date();
    const compareDate = new Date(date);

    return startOfDay(today).getTime() === startOfDay(compareDate).getTime();
  }

  static isPastTimeSlot(timeSlot: string, date: string): boolean {
    if (!this.isToday(date)) {
      return false;
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const slotTime = this.parseTime(timeSlot);
    const slotTotalMinutes = slotTime.hours * 60 + slotTime.minutes;

    return slotTotalMinutes < currentTotalMinutes;
  }

  static generateCacheTimestamp(): number {
    return Date.now();
  }
}
