import { BookingCreateRequest } from "@/modules/booking/api/models/booking.api";

export type PreBookingStatus =
  | "pending"
  | "loaded"
  | "executing"
  | "completed"
  | "failed";

export interface PreBooking {
  id: string;
  userEmail: string;
  bookingData: BookingCreateRequest;
  availableAt: Date;
  status: PreBookingStatus;
  qstashScheduleId?: string;
  boxId: string; // Reference to box for filtering and access validation
  result?: PreBookingResult;
  errorMessage?: string;
  createdAt: Date;
  loadedAt?: Date;
  executedAt?: Date;
}

export interface PreBookingResult {
  success: boolean;
  bookingId?: string;
  bookState?: number;
  message?: string;
  executedAt: Date;
}

export interface CreatePreBookingInput {
  userEmail: string;
  bookingData: BookingCreateRequest;
  availableAt: Date;
  boxId: string; // Box reference for filtering
}

export interface PreBookingFilter {
  status?: PreBookingStatus | PreBookingStatus[];
  userEmail?: string;
  boxId?: string; // Filter by box
  availableAtStart?: Date;
  availableAtEnd?: Date;
}

export interface UpdatePreBookingStatusInput {
  id: string;
  status: PreBookingStatus;
  loadedAt?: Date;
  executedAt?: Date;
  result?: PreBookingResult;
  errorMessage?: string;
}
