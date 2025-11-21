import { EmailService } from "@/common/services/email/email.service";
import { NextRequest, NextResponse } from "next/server";

/**
 * TEMPORARY TEST ENDPOINT - Delete after testing emails
 *
 * Usage:
 * POST /api/test-email?type=success
 * POST /api/test-email?type=failure
 *
 * With JSON body:
 * {
 *   "userEmail": "your@email.com",
 *   "classType": "CrossFit WOD",
 *   "formattedDateTime": "15/11/2025 19:30",
 *   "boxName": "Your Box Name"
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "success";
    const body = await request.json();

    const {
      userEmail,
      classType,
      formattedDateTime,
      boxName = "Test Box",
    } = body;

    // Validate required fields
    if (!userEmail || !classType || !formattedDateTime) {
      return NextResponse.json(
        {
          error: "Missing required fields: userEmail, classType, formattedDateTime",
        },
        { status: 400 }
      );
    }

    if (type === "success") {
      const result = await EmailService.sendPrebookingSuccess({
        userEmail,
        classType,
        formattedDateTime,
        boxName,
        confirmedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Success email sent",
        result,
      });
    } else if (type === "failure") {
      // Send to user
      const userEmail_param = userEmail; // Save user email
      const executionId = "test-execution-" + Date.now();
      const preparedAt = new Date(Date.now() - 5000).toISOString(); // 5s ago
      const firedAt = new Date(Date.now() - 3000).toISOString(); // 3s ago
      const respondedAt = new Date().toISOString();

      const userResult = await EmailService.sendPrebookingFailure({
        userEmail: userEmail_param,
        classType,
        formattedDateTime,
        boxName,
        errorMessage: "Desfortunadamente, la clase se llenó justo cuando intentábamos reservarte una plaza. Por favor, intenta apuntarte a otra clase o espera a que se liberen plazas.",
        errorCode: "CLASS_FULL",
        executionId,
        preparedAt,
        firedAt,
        respondedAt,
        fireLatency: 125,
        technicalDetails: {
          bookState: "failed",
          errorMssg: "Class is full",
          errorMssgLang: "CLASS_FULL_ERROR",
          responseTime: 250,
        },
      });

      // Also send to admin
      const adminResult = await EmailService.sendPrebookingFailure({
        userEmail: "alexsbd1@gmail.com", // Admin email
        classType,
        formattedDateTime,
        boxName,
        errorMessage: "Desfortunadamente, la clase se llenó justo cuando intentábamos reservarte una plaza. Por favor, intenta apuntarte a otra clase o espera a que se liberen plazas.",
        errorCode: "CLASS_FULL",
        executionId,
        preparedAt,
        firedAt,
        respondedAt,
        fireLatency: 125,
        technicalDetails: {
          bookState: "failed",
          errorMssg: "Class is full",
          errorMssgLang: "CLASS_FULL_ERROR",
          responseTime: 250,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Failure emails sent to user and admin",
        userEmail: userEmail_param,
        userResult,
        adminEmail: "alexsbd1@gmail.com",
        adminResult,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid type. Use 'success' or 'failure'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[TEST-EMAIL] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
