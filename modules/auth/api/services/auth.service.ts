import { apiClient } from "@/core/api/client";
import {
  LoginRequest,
  LoginResponse,
} from "@/modules/auth/pods/login/models/login.model";
import { AuthMapper } from "../mappers/auth.mapper";
import { LoginApiRequest, LoginApiResponse } from "../models/auth.api";

class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const apiRequest: LoginApiRequest = AuthMapper.toLoginApiRequest(request);
      const response = await apiClient.post<LoginApiResponse>(
        "/auth/login",
        apiRequest
      );

      return AuthMapper.fromLoginApiResponse(response.data);
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "Login failed. Please try again.",
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
}

export const authService = new AuthService();
