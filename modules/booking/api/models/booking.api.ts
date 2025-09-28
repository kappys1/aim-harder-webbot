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
  boxPic: z.string(),
  coachName: z.string().nullable(),
  coachPic: z.string(),
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
  box: z.string(),
  _: z.number(),
});

export type TimeSlotApi = z.infer<typeof TimeSlotApiSchema>;
export type BookingApi = z.infer<typeof BookingApiSchema>;
export type BookingResponseApi = z.infer<typeof BookingResponseApiSchema>;
export type BookingRequestParams = z.infer<typeof BookingRequestParamsSchema>;
