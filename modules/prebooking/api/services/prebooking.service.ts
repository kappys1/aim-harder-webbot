import { supabaseAdmin } from "@/core/database/supabase";
import {
  CreatePreBookingInput,
  PreBooking,
  UpdatePreBookingStatusInput,
} from "../../models/prebooking.model";
import { PreBookingMapper } from "../mappers/prebooking.mapper";
import { PreBookingApiSchema } from "../models/prebooking.api";

export class PreBookingService {
  private get supabase() {
    return supabaseAdmin;
  }

  /**
   * Create a new prebooking
   */
  async create(input: CreatePreBookingInput): Promise<PreBooking> {
    const { data, error } = await this.supabase
      .from("prebookings")
      .insert({
        user_email: input.userEmail,
        booking_data: input.bookingData,
        available_at: input.availableAt.toISOString(),
        box_id: input.boxId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[PreBookingService] Error creating prebooking:", error);
      throw new Error(`Failed to create prebooking: ${error.message}`);
    }

    const validated = PreBookingApiSchema.parse(data);
    return PreBookingMapper.toDomain(validated);
  }

  /**
   * Update qstash_schedule_id after scheduling in QStash
   */
  async updateQStashScheduleId(
    id: string,
    qstashScheduleId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from("prebookings")
      .update({
        qstash_schedule_id: qstashScheduleId,
      })
      .eq("id", id);

    if (error) {
      console.error(
        "[PreBookingService] Error updating qstash_schedule_id:",
        error
      );
      throw new Error(`Failed to update qstash_schedule_id: ${error.message}`);
    }
  }

  /**
   * Find pending prebookings within a time range
   * Ordered by created_at ASC for FIFO execution
   */
  async findPendingInTimeRange(
    startTime: Date,
    endTime: Date
  ): Promise<PreBooking[]> {
    console.log("[PreBookingService] Querying with:", {
      status: "pending",
      availableAtStart: startTime.toISOString(),
      availableAtEnd: endTime.toISOString(),
    });

    const { data, error } = await this.supabase
      .from("prebookings")
      .select("*")
      .eq("status", "pending")
      .gte("available_at", startTime.toISOString())
      .lte("available_at", endTime.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "[PreBookingService] Error finding pending prebookings:",
        error
      );
      throw new Error(`Failed to find pending prebookings: ${error.message}`);
    }

    console.log("[PreBookingService] Query result:", {
      found: data?.length || 0,
      prebookings: data?.map((p) => ({
        id: p.id,
        email: p.user_email,
        availableAt: p.available_at,
        status: p.status,
      })),
    });

    if (!data || data.length === 0) {
      return [];
    }

    const validated = data.map((item) => PreBookingApiSchema.parse(item));
    return PreBookingMapper.toDomainList(validated);
  }

  /**
   * Update prebooking status
   */
  async updateStatus(input: UpdatePreBookingStatusInput): Promise<PreBooking> {
    const updateData: Record<string, any> = {
      status: input.status,
    };

    if (input.loadedAt) {
      updateData.loaded_at = input.loadedAt.toISOString();
    }

    if (input.executedAt) {
      updateData.executed_at = input.executedAt.toISOString();
    }

    if (input.result) {
      updateData.result = {
        ...input.result,
        executedAt: input.result.executedAt.toISOString(),
      };
    }

    if (input.errorMessage) {
      updateData.error_message = input.errorMessage;
    }

    const { data, error } = await this.supabase
      .from("prebookings")
      .update(updateData)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error(
        "[PreBookingService] Error updating prebooking status:",
        error
      );
      throw new Error(`Failed to update prebooking status: ${error.message}`);
    }

    const validated = PreBookingApiSchema.parse(data);
    return PreBookingMapper.toDomain(validated);
  }

  /**
   * Find all prebookings for a user
   * Optionally filter by boxId
   */
  async findByUser(userEmail: string, boxId?: string): Promise<PreBooking[]> {
    let query = this.supabase
      .from("prebookings")
      .select("*")
      .eq("status", "pending")
      .eq("user_email", userEmail);

    if (boxId) {
      query = query.eq("box_id", boxId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error(
        "[PreBookingService] Error finding user prebookings:",
        error
      );
      throw new Error(`Failed to find user prebookings: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    console.log(data);
    const validated = data.map((item) => PreBookingApiSchema.parse(item));
    return PreBookingMapper.toDomainList(validated);
  }

  /**
   * Delete a prebooking (cancel)
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("prebookings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[PreBookingService] Error deleting prebooking:", error);
      throw new Error(`Failed to delete prebooking: ${error.message}`);
    }
  }

  /**
   * Find a prebooking by ID
   */
  async findById(id: string): Promise<PreBooking | null> {
    const { data, error } = await this.supabase
      .from("prebookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      console.error("[PreBookingService] Error finding prebooking:", error);
      throw new Error(`Failed to find prebooking: ${error.message}`);
    }

    const validated = PreBookingApiSchema.parse(data);
    return PreBookingMapper.toDomain(validated);
  }

  /**
   * Count pending prebookings for a user
   */
  async countPendingByUser(userEmail: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("prebookings")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .eq("status", "pending");

    if (error) {
      console.error("[PreBookingService] Error counting pending prebookings:", error);
      throw new Error(`Failed to count pending prebookings: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Atomically claim a pending prebooking by updating status from 'pending' to 'loaded'
   * Returns the prebooking if successfully claimed, null if already claimed by another process
   *
   * This prevents race conditions when multiple cron jobs try to load the same prebooking
   */
  async claimPrebooking(id: string): Promise<PreBooking | null> {
    const { data, error } = await this.supabase
      .from("prebookings")
      .update({
        status: "loaded",
        loaded_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending") // Only update if still pending (atomic check)
      .select()
      .single();

    if (error) {
      // PGRST116 = No rows matched (already claimed by another process)
      if (error.code === "PGRST116") {
        console.log(
          `[PreBookingService] Prebooking ${id} already claimed by another process`
        );
        return null;
      }
      console.error("[PreBookingService] Error claiming prebooking:", error);
      throw new Error(`Failed to claim prebooking: ${error.message}`);
    }

    const validated = PreBookingApiSchema.parse(data);
    return PreBookingMapper.toDomain(validated);
  }

  /**
   * Find prebookings ready to execute NOW
   * Query: available_at <= NOW() AND status = 'pending'
   * Orders by created_at ASC for FIFO execution
   */
  async findReadyToExecute(now: Date): Promise<PreBooking[]> {
    console.log("[PreBookingService] Querying prebookings ready NOW:", {
      now: now.toISOString(),
      status: "pending",
    });

    const { data, error } = await this.supabase
      .from("prebookings")
      .select("*")
      .eq("status", "pending")
      .lte("available_at", now.toISOString()) // Ready NOW (not future)
      .order("created_at", { ascending: true }) // FIFO
      .limit(50); // Safety limit

    if (error) {
      console.error(
        "[PreBookingService] Error finding ready prebookings:",
        error
      );
      throw new Error(`Failed to find ready prebookings: ${error.message}`);
    }

    console.log("[PreBookingService] Query result:", {
      found: data?.length || 0,
      prebookings: data?.map((p) => ({
        id: p.id,
        email: p.user_email,
        availableAt: p.available_at,
        createdAt: p.created_at,
      })),
    });

    if (!data || data.length === 0) {
      return [];
    }

    const validated = data.map((item) => PreBookingApiSchema.parse(item));
    return PreBookingMapper.toDomainList(validated);
  }

  /**
   * Mark prebooking as completed with full result
   * @param alreadyBookedManually - Indicates if user booked manually before auto-booking
   */
  async markCompleted(
    id: string,
    result: {
      bookingId?: string;
      bookState?: number;
      message?: string;
      alreadyBookedManually?: boolean;
    }
  ): Promise<void> {
    const executedAt = new Date();
    const { error } = await this.supabase
      .from("prebookings")
      .update({
        status: "completed",
        executed_at: executedAt.toISOString(),
        result: {
          success: true,
          bookingId: result.bookingId,
          bookState: result.bookState,
          message: result.message,
          alreadyBookedManually: result.alreadyBookedManually,
          executedAt: executedAt.toISOString(),
        },
      })
      .eq("id", id);

    if (error) {
      console.error("[PreBookingService] Error marking completed:", error);
      throw new Error(`Failed to mark completed: ${error.message}`);
    }
  }

  /**
   * Mark prebooking as failed with comprehensive error details
   * Stores all failure information including AimHarder response, timing metrics, and error codes
   */
  async markFailed(
    id: string,
    errorMessage: string,
    result?: {
      bookState?: number;
      errorMssg?: string;
      errorMssgLang?: string;
      mappedError?: string;
      fireLatency?: number;
      setTimeoutVariance?: number;
      aimharderResponseTime?: number;
    }
  ): Promise<void> {
    const executedAt = new Date();
    const { error } = await this.supabase
      .from("prebookings")
      .update({
        status: "failed",
        executed_at: executedAt.toISOString(),
        error_message: errorMessage,
        result: {
          success: false,
          bookState: result?.bookState,
          errorMssg: result?.errorMssg,
          errorMssgLang: result?.errorMssgLang,
          mappedError: result?.mappedError,
          fireLatency: result?.fireLatency,
          setTimeoutVariance: result?.setTimeoutVariance,
          aimharderResponseTime: result?.aimharderResponseTime,
          message: errorMessage,
          executedAt: executedAt.toISOString(),
        },
      })
      .eq("id", id);

    if (error) {
      console.error("[PreBookingService] Error marking failed:", error);
      throw new Error(`Failed to mark failed: ${error.message}`);
    }
  }
}

export const preBookingService = new PreBookingService();
