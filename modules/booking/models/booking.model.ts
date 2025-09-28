export interface TimeSlot {
  id: string;
  time: string;
  startTime: string;
  endTime: string;
}

export interface Coach {
  name: string | null;
  avatar: string;
}

export interface Box {
  id: string;
  name: string;
  address: string;
  image: string;
}

export interface BookingCapacity {
  limitString: string;
  current: number;
  limit: number;
  available: number;
  percentage: number;
  hasWaitlist: boolean;
  waitlistCount: number;
}

export interface BookingClass {
  id: number;
  name: string;
  description: string;
  color: string;
  duration: number;
  isOnline: boolean;
}

export enum BookingStatus {
  AVAILABLE = "available",
  BOOKED = "booked",
  FULL = "full",
  WAITLIST = "waitlist",
  DISABLED = "disabled",
}

export interface Booking {
  id: number;
  timeSlot: TimeSlot;
  class: BookingClass;
  box: Box;
  coach: Coach;
  status: BookingStatus;
  capacity: BookingCapacity;
  userBookingId: number | null;
  isIncludedInPlan: boolean;
  hasZoomAccess: boolean;
  zoomUrl?: string;
  zoomPassword?: string;
}

export interface BookingDay {
  date: string;
  description: string;
  availableClasses: string;
  bookings: Booking[];
  timeSlots: TimeSlot[];
  specialEvents: string[];
}

export interface BookingFilter {
  classTypes?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  availabilityOnly?: boolean;
  includeWaitlist?: boolean;
}
