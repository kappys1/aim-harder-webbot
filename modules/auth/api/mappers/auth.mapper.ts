import {
  LoginRequest,
  LoginResponse,
} from "@/modules/auth/pods/login/models/login.model";
import { LoginApiRequest, LoginApiResponse } from "../models/auth.api";

export class AuthMapper {
  static toLoginApiRequest(request: LoginRequest): LoginApiRequest {
    return {
      email: request.email,
      password: request.password,
    };
  }

  static fromLoginApiResponse(response: LoginApiResponse): LoginResponse {
    if (response.success && response.data) {
      return {
        success: true,
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
        },
        token: response.data.token,
      };
    }

    return {
      success: false,
      error: response.error || "Login failed",
    };
  }
}
