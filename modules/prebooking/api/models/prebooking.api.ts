import { BookingCreateRequestSchema } from "@/modules/booking/api/models/booking.api";
import { z } from "zod";

export const PreBookingStatusSchema = z.enum([
  "pending",
  "loaded",
  "executing",
  "completed",
  "failed",
]);

export const PreBookingResultSchema = z.object({
  success: z.boolean().optional(),
  bookingId: z.string().optional(),
  bookState: z.number().optional(),
  message: z.string().optional(),
  executedAt: z.union([z.string().datetime(), z.undefined()]),
});

export const PreBookingApiSchema = z.object({
  id: z.string().uuid(),
  user_email: z.string().email(),
  booking_data: BookingCreateRequestSchema,
  available_at: z.string(), // Accept any string format from Supabase
  status: PreBookingStatusSchema,
  qstash_schedule_id: z.string().nullable().optional(),
  result: PreBookingResultSchema.nullable().optional(),
  error_message: z.string().nullable().optional(),
  created_at: z.string(), // Accept any string format from Supabase
  loaded_at: z.string().nullable().optional(),
  executed_at: z.string().nullable().optional(),
});

export const CreatePreBookingRequestSchema = z.object({
  user_email: z.string().email(),
  booking_data: BookingCreateRequestSchema,
  available_at: z.union([z.string().datetime(), z.undefined()]),
});

export const UpdatePreBookingStatusRequestSchema = z.object({
  id: z.string().uuid(),
  status: PreBookingStatusSchema,
  loaded_at: z.string().datetime().optional(),
  executed_at: z.string().datetime().optional(),
  result: PreBookingResultSchema.optional(),
  error_message: z.string().optional(),
});

export type PreBookingApi = z.infer<typeof PreBookingApiSchema>;
export type CreatePreBookingRequest = z.infer<
  typeof CreatePreBookingRequestSchema
>;
export type UpdatePreBookingStatusRequest = z.infer<
  typeof UpdatePreBookingStatusRequestSchema
>;
