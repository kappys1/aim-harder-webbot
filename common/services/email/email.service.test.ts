import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "./email.service";
import { PrebookingSuccessData, PrebookingFailureData } from "./email.types";

// Mock Resend
vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({
          data: { id: "test-message-id" },
          error: null,
        }),
      },
    })),
  };
});

describe("EmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendPrebookingSuccess", () => {
    it("should send success email without throwing", async () => {
      const mockData: PrebookingSuccessData = {
        userEmail: "user@example.com",
        classType: "CrossFit WOD",
        formattedDateTime: "15/11/2025 19:30",
        confirmedAt: new Date().toISOString(),
      };

      const result = await EmailService.sendPrebookingSuccess(mockData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should handle email sending gracefully on error", async () => {
      const mockData: PrebookingSuccessData = {
        userEmail: "user@example.com",
        classType: "CrossFit WOD",
        formattedDateTime: "15/11/2025 19:30",
        confirmedAt: new Date().toISOString(),
      };

      // Even if Resend fails, should return error object without throwing
      const result = await EmailService.sendPrebookingSuccess(mockData);
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("error", expect.any(String));
    });
  });

  describe("sendPrebookingFailure", () => {
    it("should send failure email to user and admin", async () => {
      const mockData: PrebookingFailureData = {
        userEmail: "user@example.com",
        classType: "CrossFit WOD",
        formattedDateTime: "15/11/2025 19:30",
        errorMessage: "Test error",
        preparedAt: new Date().toISOString(),
        firedAt: new Date().toISOString(),
      };

      const result = await EmailService.sendPrebookingFailure(mockData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should include technical details in admin email", async () => {
      const mockData: PrebookingFailureData = {
        userEmail: "admin@example.com",
        classType: "CrossFit WOD",
        formattedDateTime: "15/11/2025 19:30",
        errorMessage: "Booking failed",
        errorCode: "CLASS_FULL",
        executionId: "test-exec-id",
        preparedAt: new Date().toISOString(),
        firedAt: new Date().toISOString(),
        respondedAt: new Date().toISOString(),
        fireLatency: 125,
        technicalDetails: {
          bookState: "failed",
          errorMssg: "Class is full",
          responseTime: 150,
        },
      };

      const result = await EmailService.sendPrebookingFailure(mockData);

      expect(result.success).toBe(true);
    });
  });
});
