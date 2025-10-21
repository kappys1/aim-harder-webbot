import { z } from "zod";

export const TimeSlotApiSchema = z.object({
  id: z.string(),
  time: z.string(),
});

export const BookingApiSchema = z.object({
  id: z.number(),
  zoomid: z.string().nullable(),
  zoomJoinUrl: z.string().nullable(),
  zoomJoinPw: z.string().nullable(),
  onlineclass: z.number(),
  idres: z.number().nullable(),
  spotres: z.string().nullable(),
  time: z.string(),
  timeid: z.string(),
  classId: z.number(),
  className: z.string(),
  classDesc: z.string(),
  boxName: z.string(),
  boxDir: z.string(),
  boxPic: z.string().nullable(),
  coachName: z.string().nullable(),
  coachPic: z.string().nullable(), // Allow null values from API
  enabled: z.number(),
  bookState: z.number().nullable(),
  limit: z.union([z.number().transform(String), z.string()]),
  limitc: z.union([z.number(), z.string().transform(Number)]),
  ocupation: z.number(),
  checkAthletesNum: z.number(),
  waitlist: z.number(),
  cancelledId: z.string().nullable(),
  color: z.string(),
  classLength: z.number(),
  resadmin: z.number(),
  included: z.number(),
});

export const BookingResponseApiSchema = z.object({
  clasesDisp: z.string(),
  timetable: z.array(TimeSlotApiSchema),
  day: z.string(),
  bookings: z.array(BookingApiSchema),
  seminars: z.array(z.string()),
  resmsgs: z.array(z.string()).optional(), // Optional field that may or may not be present
});

export const BookingRequestParamsSchema = z.object({
  day: z.string(),
  familyId: z.string().optional(),
  boxId: z.string(), // UUID of the box (internal ID)
  _: z.number(),
});

// POST booking schemas
export const BookingCreateRequestSchema = z.object({
  day: z.string().regex(/^\d{8}$/, "Day must be in YYYYMMDD format"),
  familyId: z.string().default(""),
  id: z.string().min(1, "Slot ID is required"),
  insist: z.number().default(0),
  activityName: z.string().optional(),
  boxName: z.string().optional(),
});

export const BookingCreateResponseSchema = z.object({
  clasesContratadas: z.string(),
  hasPublicMemberships: z.number().optional(),
  bookState: z.number(),
  id: z.string().optional(), // Present on success
  errorMssg: z.string().optional(), // Present on error
  errorMssgLang: z.string().optional(), // Present on error
  max: z.number().optional(), // Present on bookState -8 (max bookings reached)
});

// Booking cancellation schemas
export const BookingCancelRequestSchema = z.object({
  id: z.string().min(1, "Booking ID is required"),
  late: z.number().default(0), // 0 for normal cancellation, 1 for late cancellation
  familyId: z.string().default(""),
});

export const BookingCancelResponseSchema = z.object({
  cancelState: z.number(),
});

export type TimeSlotApi = z.infer<typeof TimeSlotApiSchema>;
export type BookingApi = z.infer<typeof BookingApiSchema>;
export type BookingResponseApi = z.infer<typeof BookingResponseApiSchema>;
export type BookingRequestParams = z.infer<typeof BookingRequestParamsSchema>;
export type BookingCreateRequest = z.infer<typeof BookingCreateRequestSchema>;
export type BookingCreateResponse = z.infer<typeof BookingCreateResponseSchema>;
export type BookingCancelRequest = z.infer<typeof BookingCancelRequestSchema>;
export type BookingCancelResponse = z.infer<typeof BookingCancelResponseSchema>;
