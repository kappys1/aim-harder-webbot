import {
  Booking,
  BookingCapacity,
  BookingClass,
  BookingDay,
  BookingStatus,
  Box,
  Coach,
  TimeSlot,
} from "../../models/booking.model";
import {
  BookingApi,
  BookingResponseApi,
  TimeSlotApi,
  BookingCreateResponse,
} from "../models/booking.api";
import { BOOKING_CONSTANTS } from "../../constants/booking.constants";

export class BookingMapper {
  static mapTimeSlot(timeSlotApi: TimeSlotApi): TimeSlot {
    const [startTime, endTime] = timeSlotApi.time.split("-");

    return {
      id: timeSlotApi.id,
      time: timeSlotApi.time,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
    };
  }

  static mapCoach(bookingApi: BookingApi): Coach {
    return {
      name: bookingApi.coachName,
      avatar: bookingApi.coachPic,
    };
  }

  static mapBox(bookingApi: BookingApi): Box {
    return {
      id: bookingApi.classId.toString(),
      name: bookingApi.boxName,
      address: bookingApi.boxDir,
      image: bookingApi.boxPic,
    };
  }

  static mapCapacity(bookingApi: BookingApi): BookingCapacity {
    const limitString = bookingApi.limit;
    const current = bookingApi.ocupation;
    const limit = bookingApi.limitc;
    const available = Math.max(0, limit - current);
    const percentage = limit > 0 ? (current / limit) * 100 : 0;
    const hasWaitlist = bookingApi.waitlist > 0;

    return {
      current,
      limit,
      limitString,
      available,
      percentage,
      hasWaitlist,
      waitlistCount: Math.max(0, bookingApi.waitlist),
    };
  }

  static mapClass(bookingApi: BookingApi): BookingClass {
    return {
      id: bookingApi.classId,
      name: bookingApi.className,
      description: bookingApi.classDesc,
      color: `rgb(${bookingApi.color})`,
      duration: bookingApi.classLength,
      isOnline: bookingApi.onlineclass === 1,
    };
  }

  static mapBookingStatus(bookingApi: BookingApi): BookingStatus {
    if (bookingApi.enabled === 0) {
      return BookingStatus.DISABLED;
    }

    if (bookingApi.bookState === 1) {
      return BookingStatus.BOOKED;
    }

    const capacity = this.mapCapacity(bookingApi);

    if (capacity.available === 0) {
      return capacity.hasWaitlist ? BookingStatus.WAITLIST : BookingStatus.FULL;
    }

    return BookingStatus.AVAILABLE;
  }

  static mapBooking(bookingApi: BookingApi): Booking {
    const timeSlot: TimeSlot = {
      id: bookingApi.timeid,
      time: bookingApi.time,
      startTime: bookingApi.time.split(" - ")[0],
      endTime: bookingApi.time.split(" - ")[1],
    };

    return {
      id: bookingApi.id,
      timeSlot,
      class: this.mapClass(bookingApi),
      box: this.mapBox(bookingApi),
      coach: this.mapCoach(bookingApi),
      status: this.mapBookingStatus(bookingApi),
      capacity: this.mapCapacity(bookingApi),
      userBookingId: bookingApi.idres,
      isIncludedInPlan: bookingApi.included === 1,
      hasZoomAccess: bookingApi.onlineclass === 1,
      zoomUrl: bookingApi.zoomJoinUrl || undefined,
      zoomPassword: bookingApi.zoomJoinPw || undefined,
    };
  }

  static mapBookingDay(responseApi: BookingResponseApi): BookingDay {
    return {
      date: this.extractDateFromDescription(responseApi.day),
      description: responseApi.day,
      availableClasses: responseApi.clasesDisp,
      bookings: responseApi.bookings.map((booking) => this.mapBooking(booking)),
      timeSlots: responseApi.timetable.map((timeSlot) =>
        this.mapTimeSlot(timeSlot)
      ),
      specialEvents: responseApi.seminars,
    };
  }

  static mapBookingCreateResult(response: BookingCreateResponse): {
    success: boolean;
    bookingId?: string;
    error?: string;
    errorMessage?: string;
    canRetryLater?: boolean;
    availableFrom?: Date;
    maxBookings?: number;
  } {
    const isSuccess = response.bookState === BOOKING_CONSTANTS.BOOKING_STATES.BOOKED;
    const isEarlyBookingError = response.bookState === BOOKING_CONSTANTS.BOOKING_STATES.ERROR_EARLY_BOOKING;
    const isMaxBookingsError = response.bookState === BOOKING_CONSTANTS.BOOKING_STATES.ERROR_MAX_BOOKINGS;

    if (isSuccess) {
      return {
        success: true,
        bookingId: response.id,
      };
    }

    if (isEarlyBookingError) {
      const availableFrom = this.extractAvailabilityDate(response.errorMssg);
      return {
        success: false,
        error: 'early_booking',
        errorMessage: response.errorMssg,
        canRetryLater: true,
        availableFrom,
      };
    }

    if (isMaxBookingsError) {
      return {
        success: false,
        error: 'max_bookings_reached',
        errorMessage: `You have reached the maximum number of bookings allowed (${response.max})`,
        canRetryLater: false,
        maxBookings: response.max,
      };
    }

    return {
      success: false,
      error: 'booking_failed',
      errorMessage: response.errorMssg || 'Unknown booking error',
      canRetryLater: false,
    };
  }

  private static extractAvailabilityDate(errorMessage?: string): Date | undefined {
    if (!errorMessage) return undefined;

    // Extract days from Spanish error message like "No puedes reservar clases con más de 4 días de antelación"
    const daysMatch = errorMessage.match(/(\d+)\s+días?\s+de\s+antelación/);
    if (daysMatch) {
      const daysAdvance = parseInt(daysMatch[1], 10);
      const availableDate = new Date();
      availableDate.setDate(availableDate.getDate() - daysAdvance);
      return availableDate;
    }

    return undefined;
  }

  private static extractDateFromDescription(description: string): string {
    const dateMatch = description.match(/(\d{1,2}) de (\w+) de (\d{4})/);
    if (!dateMatch) return new Date().toISOString().split("T")[0];

    const [, day, monthName, year] = dateMatch;
    const monthMap: Record<string, string> = {
      Enero: "01",
      Febrero: "02",
      Marzo: "03",
      Abril: "04",
      Mayo: "05",
      Junio: "06",
      Julio: "07",
      Agosto: "08",
      Septiembre: "09",
      Octubre: "10",
      Noviembre: "11",
      Diciembre: "12",
    };

    const month = monthMap[monthName] || "01";
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }
}
