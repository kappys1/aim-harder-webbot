import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingMapper } from './booking.mapper';
import { BookingStatus } from '../../models/booking.model';
import { mockBookingApiResponse } from '@/tests/fixtures/booking.fixtures';
import type { BookingApi, TimeSlotApi, BookingCreateResponse } from '../models/booking.api';

describe('BookingMapper', () => {
  describe('mapTimeSlot', () => {
    it('should map time slot API to model', () => {
      const timeSlotApi: TimeSlotApi = {
        id: '1',
        time: '09:00 - 10:00',
      };

      const result = BookingMapper.mapTimeSlot(timeSlotApi);

      expect(result).toEqual({
        id: '1',
        time: '09:00 - 10:00',
        startTime: '09:00',
        endTime: '10:00',
      });
    });

    it('should trim whitespace from time parts', () => {
      const timeSlotApi: TimeSlotApi = {
        id: '2',
        time: '14:30  -  15:30',
      };

      const result = BookingMapper.mapTimeSlot(timeSlotApi);

      expect(result.startTime).toBe('14:30');
      expect(result.endTime).toBe('15:30');
    });
  });

  describe('mapCoach', () => {
    it('should map coach information', () => {
      const bookingApi = mockBookingApiResponse.bookings[0];

      const result = BookingMapper.mapCoach(bookingApi);

      expect(result).toEqual({
        name: bookingApi.coachName,
        avatar: bookingApi.coachPic,
      });
    });
  });

  describe('mapBox', () => {
    it('should map box information', () => {
      const bookingApi = mockBookingApiResponse.bookings[0];

      const result = BookingMapper.mapBox(bookingApi);

      expect(result).toEqual({
        id: bookingApi.classId.toString(),
        name: bookingApi.boxName,
        address: bookingApi.boxDir,
        image: bookingApi.boxPic,
      });
    });
  });

  describe('mapCapacity', () => {
    it('should calculate capacity correctly', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        ocupation: 8,
        limitc: 15,
        limit: '8/15',
        waitlist: 0,
      };

      const result = BookingMapper.mapCapacity(bookingApi);

      expect(result).toEqual({
        current: 8,
        limit: 15,
        limitString: '8/15',
        available: 7,
        percentage: expect.closeTo(53.33, 0.1),
        hasWaitlist: false,
        waitlistCount: 0,
      });
    });

    it('should handle waitlist', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        ocupation: 15,
        limitc: 15,
        limit: '15/15',
        waitlist: 3,
      };

      const result = BookingMapper.mapCapacity(bookingApi);

      expect(result.hasWaitlist).toBe(true);
      expect(result.waitlistCount).toBe(3);
      expect(result.available).toBe(0);
      expect(result.percentage).toBe(100);
    });

    it('should handle zero limit', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        ocupation: 0,
        limitc: 0,
        limit: '0/0',
        waitlist: 0,
      };

      const result = BookingMapper.mapCapacity(bookingApi);

      expect(result.percentage).toBe(0);
      expect(result.available).toBe(0);
    });

    it('should never have negative available slots', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        ocupation: 20,
        limitc: 15,
        limit: '20/15',
        waitlist: 5,
      };

      const result = BookingMapper.mapCapacity(bookingApi);

      expect(result.available).toBe(0);
      expect(result.available).toBeGreaterThanOrEqual(0);
    });

    it('should ensure waitlist count is never negative', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        ocupation: 10,
        limitc: 15,
        limit: '10/15',
        waitlist: -5,
      };

      const result = BookingMapper.mapCapacity(bookingApi);

      expect(result.waitlistCount).toBe(0);
      expect(result.waitlistCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mapClass', () => {
    it('should map class information', () => {
      const bookingApi = mockBookingApiResponse.bookings[0];

      const result = BookingMapper.mapClass(bookingApi);

      expect(result).toEqual({
        id: bookingApi.classId,
        name: bookingApi.className,
        description: bookingApi.classDesc,
        color: `rgb(${bookingApi.color})`,
        duration: bookingApi.classLength,
        isOnline: false,
      });
    });

    it('should detect online classes', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        onlineclass: 1,
      };

      const result = BookingMapper.mapClass(bookingApi);

      expect(result.isOnline).toBe(true);
    });
  });

  describe('mapBookingStatus', () => {
    it('should return DISABLED when enabled is 0', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        enabled: 0,
      };

      const result = BookingMapper.mapBookingStatus(bookingApi);

      expect(result).toBe(BookingStatus.DISABLED);
    });

    it('should return BOOKED when bookState is 1', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        enabled: 1,
        bookState: 1,
      };

      const result = BookingMapper.mapBookingStatus(bookingApi);

      expect(result).toBe(BookingStatus.BOOKED);
    });

    it('should return FULL when capacity is 0 and no waitlist', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        enabled: 1,
        bookState: 0,
        ocupation: 15,
        limitc: 15,
        waitlist: 0,
      };

      const result = BookingMapper.mapBookingStatus(bookingApi);

      expect(result).toBe(BookingStatus.FULL);
    });

    it('should return WAITLIST when capacity is 0 and has waitlist', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        enabled: 1,
        bookState: 0,
        ocupation: 15,
        limitc: 15,
        waitlist: 3,
      };

      const result = BookingMapper.mapBookingStatus(bookingApi);

      expect(result).toBe(BookingStatus.WAITLIST);
    });

    it('should return AVAILABLE when capacity is available', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        enabled: 1,
        bookState: 0,
        ocupation: 8,
        limitc: 15,
        waitlist: 0,
      };

      const result = BookingMapper.mapBookingStatus(bookingApi);

      expect(result).toBe(BookingStatus.AVAILABLE);
    });
  });

  describe('mapBooking', () => {
    it('should map complete booking', () => {
      const bookingApi = mockBookingApiResponse.bookings[0];

      const result = BookingMapper.mapBooking(bookingApi);

      expect(result).toMatchObject({
        id: bookingApi.id,
        userBookingId: bookingApi.idres,
        isIncludedInPlan: true,
        hasZoomAccess: false,
      });
      expect(result.timeSlot).toBeDefined();
      expect(result.class).toBeDefined();
      expect(result.box).toBeDefined();
      expect(result.coach).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.capacity).toBeDefined();
    });

    it('should handle included plan', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        included: 1,
      };

      const result = BookingMapper.mapBooking(bookingApi);

      expect(result.isIncludedInPlan).toBe(true);
    });

    it('should handle not included in plan', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        included: 0,
      };

      const result = BookingMapper.mapBooking(bookingApi);

      expect(result.isIncludedInPlan).toBe(false);
    });

    it('should handle online class with zoom', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        onlineclass: 1,
        zoomJoinUrl: 'https://zoom.us/j/123456',
        zoomJoinPw: 'password123',
      };

      const result = BookingMapper.mapBooking(bookingApi);

      expect(result.hasZoomAccess).toBe(true);
      expect(result.zoomUrl).toBe('https://zoom.us/j/123456');
      expect(result.zoomPassword).toBe('password123');
    });

    it('should handle missing zoom info', () => {
      const bookingApi: BookingApi = {
        ...mockBookingApiResponse.bookings[0],
        onlineclass: 0,
        zoomJoinUrl: null,
        zoomJoinPw: null,
      };

      const result = BookingMapper.mapBooking(bookingApi);

      expect(result.zoomUrl).toBeUndefined();
      expect(result.zoomPassword).toBeUndefined();
    });
  });

  describe('mapBookingDay', () => {
    it('should map booking day response', () => {
      const result = BookingMapper.mapBookingDay(mockBookingApiResponse);

      expect(result).toMatchObject({
        description: mockBookingApiResponse.day,
        availableClasses: mockBookingApiResponse.clasesDisp,
        specialEvents: mockBookingApiResponse.seminars,
      });
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.bookings).toHaveLength(mockBookingApiResponse.bookings.length);
      expect(result.timeSlots).toHaveLength(mockBookingApiResponse.timetable.length);
    });

    it('should extract date from Spanish description', () => {
      const response = {
        ...mockBookingApiResponse,
        day: '15 de Enero de 2025',
      };

      const result = BookingMapper.mapBookingDay(response);

      expect(result.date).toBe('2025-01-15');
    });

    it('should handle different Spanish months', () => {
      const months = [
        { text: '1 de Febrero de 2025', expected: '2025-02-01' },
        { text: '20 de Marzo de 2025', expected: '2025-03-20' },
        { text: '5 de Abril de 2025', expected: '2025-04-05' },
        { text: '15 de Mayo de 2025', expected: '2025-05-15' },
        { text: '30 de Junio de 2025', expected: '2025-06-30' },
        { text: '10 de Julio de 2025', expected: '2025-07-10' },
        { text: '25 de Agosto de 2025', expected: '2025-08-25' },
        { text: '8 de Septiembre de 2025', expected: '2025-09-08' },
        { text: '12 de Octubre de 2025', expected: '2025-10-12' },
        { text: '18 de Noviembre de 2025', expected: '2025-11-18' },
        { text: '31 de Diciembre de 2025', expected: '2025-12-31' },
      ];

      months.forEach(({ text, expected }) => {
        const response = { ...mockBookingApiResponse, day: text };
        const result = BookingMapper.mapBookingDay(response);
        expect(result.date).toBe(expected);
      });
    });

    it('should fallback to current date for invalid description', () => {
      const response = {
        ...mockBookingApiResponse,
        day: 'Invalid date format',
      };

      const result = BookingMapper.mapBookingDay(response);

      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('mapBookingCreateResult', () => {
    it('should map successful booking', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '9',
        bookState: 1,
        id: 'booking-123',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toEqual({
        success: true,
        bookingId: 'booking-123',
      });
    });

    it('should map early booking error', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'No puedes reservar clases con más de 4 días de antelación',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toMatchObject({
        success: false,
        error: 'early_booking',
        errorMessage: response.errorMssg,
        canRetryLater: true,
      });
      expect(result.availableFrom).toBeInstanceOf(Date);
    });

    it('should map max bookings error', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -8,
        errorMssg: 'Has alcanzado el máximo de reservas permitidas',
        max: 10,
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toEqual({
        success: false,
        error: 'max_bookings_reached',
        errorMessage: 'You have reached the maximum number of bookings allowed (10)',
        canRetryLater: false,
        maxBookings: 10,
      });
    });

    it('should map generic booking failure', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -1,
        errorMssg: 'Unexpected error',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toEqual({
        success: false,
        error: 'booking_failed',
        errorMessage: 'Unexpected error',
        canRetryLater: false,
      });
    });

    it('should handle missing error message', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -1,
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toMatchObject({
        success: false,
        error: 'booking_failed',
        errorMessage: 'Unknown booking error',
        canRetryLater: false,
      });
    });

    it('should extract availability date from error message', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'No puedes reservar clases con más de 7 días de antelación',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.availableFrom).toBeInstanceOf(Date);

      const daysDiff = Math.floor(
        (Date.now() - result.availableFrom!.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it('should handle early booking error without extractable date', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'Cannot book too early',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.success).toBe(false);
      expect(result.availableFrom).toBeUndefined();
    });

    it('should handle singular "día" in error message', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'No puedes reservar clases con más de 1 día de antelación',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.availableFrom).toBeInstanceOf(Date);
    });
  });

  describe('already booked manually detection', () => {
    it('should treat "already booked at same time" as success', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'No puedes hacer más de una reserva a la misma hora',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toMatchObject({
        success: true, // Should be success, not failure
        error: 'already_booked_manually',
        errorMessage: response.errorMssg,
        canRetryLater: false,
        alreadyBookedManually: true,
      });
      expect(result.bookingId).toBeUndefined();
      expect(result.availableFrom).toBeUndefined();
    });

    it('should detect case-insensitive "misma hora" message', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'NO PUEDES HACER MÁS DE UNA RESERVA A LA MISMA HORA',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.success).toBe(true);
      expect(result.alreadyBookedManually).toBe(true);
    });

    it('should detect alternative "ya tienes una reserva" message', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'Ya tienes una reserva a esa hora',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.success).toBe(true);
      expect(result.error).toBe('already_booked_manually');
      expect(result.alreadyBookedManually).toBe(true);
    });

    it('should detect alternative "ya has reservado" message', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'Ya has reservado a esa hora',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.success).toBe(true);
      expect(result.error).toBe('already_booked_manually');
      expect(result.alreadyBookedManually).toBe(true);
    });

    it('should still treat "too many days in advance" as failure', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'No puedes reservar clases con más de 4 días de antelación',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result).toMatchObject({
        success: false, // Should remain as failure
        error: 'early_booking',
        canRetryLater: true,
      });
      expect(result.alreadyBookedManually).toBeUndefined();
    });

    it('should handle bookState -12 without matching message as early_booking', () => {
      const response: BookingCreateResponse = {
        clasesContratadas: '10',
        bookState: -12,
        errorMssg: 'Some other error message',
      };

      const result = BookingMapper.mapBookingCreateResult(response);

      expect(result.success).toBe(false);
      expect(result.error).toBe('early_booking');
      expect(result.alreadyBookedManually).toBeUndefined();
    });
  });
});
