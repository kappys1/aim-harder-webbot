import { PreBooking } from "../../models/prebooking.model";
import { PreBookingApi } from "../models/prebooking.api";

export class PreBookingMapper {
  static toDomain(api: PreBookingApi): PreBooking {
    return {
      id: api.id,
      userEmail: api.user_email,
      bookingData: api.booking_data,
      availableAt: new Date(api.available_at),
      status: api.status,
      result: api.result
        ? {
            ...api.result,
            success: api.result.success ?? false,
            executedAt: new Date(api.result.executedAt || Date.now()),
          }
        : undefined,
      errorMessage: api.error_message ?? undefined,
      createdAt: new Date(api.created_at),
      loadedAt: api.loaded_at ? new Date(api.loaded_at) : undefined,
      executedAt: api.executed_at ? new Date(api.executed_at) : undefined,
    };
  }

  static toDomainList(apiList: PreBookingApi[]): PreBooking[] {
    return apiList.map((api) => this.toDomain(api));
  }
}
