import { BookingDay, Booking, BookingStatus } from '@/modules/booking/models/booking.model';

export const mockTimeSlot = {
  id: '1',
  time: '09:00 - 10:00',
  startTime: '09:00',
  endTime: '10:00',
};

export const mockBooking: Booking = {
  id: 'booking-1',
  timeSlot: mockTimeSlot,
  class: {
    id: 101,
    name: 'CrossFit WOD',
    description: 'High intensity workout',
    color: 'rgb(59, 130, 246)',
    duration: 60,
    isOnline: false,
  },
  box: {
    id: '10122',
    name: 'CrossFit Cerdanyola',
    address: 'C/ Test, 123',
    image: 'https://example.com/box.jpg',
  },
  coach: {
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
  },
  status: BookingStatus.AVAILABLE,
  capacity: {
    current: 8,
    limit: 15,
    limitString: '8/15',
    available: 7,
    percentage: 53.33,
    hasWaitlist: false,
    waitlistCount: 0,
  },
  userBookingId: null,
  isIncludedInPlan: true,
  hasZoomAccess: false,
};

export const mockBookingDay: BookingDay = {
  date: '2025-10-05',
  description: '5 de Octubre de 2025',
  availableClasses: 5,
  bookings: [mockBooking],
  timeSlots: [mockTimeSlot],
  specialEvents: [],
};

export const mockBookingResponse = {
  day: '5 de Octubre de 2025',
  clasesDisp: 5,
  bookings: [
    {
      id: 'booking-1',
      timeid: '1',
      time: '09:00 - 10:00',
      classId: 101,
      className: 'CrossFit WOD',
      classDesc: 'High intensity workout',
      color: '59, 130, 246',
      classLength: 60,
      boxName: 'CrossFit Cerdanyola',
      boxDir: 'C/ Test, 123',
      boxPic: 'https://example.com/box.jpg',
      coachName: 'John Doe',
      coachPic: 'https://example.com/avatar.jpg',
      enabled: 1,
      bookState: 0,
      ocupation: 8,
      limit: '8/15',
      limitc: 15,
      waitlist: 0,
      idres: null,
      included: 1,
      onlineclass: 0,
    },
  ],
  timetable: [
    { id: '1', time: '09:00 - 10:00' },
  ],
  seminars: [],
};

// API Service fixtures matching actual API schema
export const mockBookingApiResponse = {
  clasesDisp: '5',
  day: '15 de Enero de 2025',
  bookings: [
    {
      id: 12345,
      zoomid: null,
      zoomJoinUrl: null,
      zoomJoinPw: null,
      onlineclass: 0,
      idres: 789,
      spotres: null,
      time: '18:00 - 19:00',
      timeid: '1',
      classId: 101,
      className: 'WOD - CrossFit',
      classDesc: 'High intensity workout',
      boxName: 'CrossFit Main Box',
      boxDir: 'C/ Example, 123',
      boxPic: '/images/box.jpg',
      coachName: 'Coach John',
      coachPic: '/images/coach.jpg',
      enabled: 1,
      bookState: 1,
      limit: '10/15',
      limitc: 15,
      ocupation: 10,
      checkAthletesNum: 0,
      waitlist: 0,
      cancelledId: null,
      color: '59, 130, 246',
      classLength: 60,
      resadmin: 0,
      included: 1,
    },
  ],
  timetable: [
    { id: '1', time: '18:00 - 19:00' },
  ],
  seminars: [],
};

export const mockBookingCreateRequest = {
  day: '20250115',
  familyId: 'family-123',
  id: 'class-456',
  insist: 0,
};

export const mockBookingCreateResponse = {
  clasesContratadas: '10',
  bookState: 1,
  id: 'booking-789',
};

export const mockBookingCancelRequest = {
  id: 'booking-789',
  late: 0,
  familyId: 'family-123',
};

export const mockBookingCancelResponse = {
  cancelState: 1,
};
