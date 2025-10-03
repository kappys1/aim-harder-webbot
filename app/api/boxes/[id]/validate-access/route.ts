import type { ValidateAccessResponse } from "@/modules/boxes/api/models/box.api";
import { BoxAccessService } from "@/modules/boxes/api/services/box-access.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const { id: boxId } = await params;

    if (!userEmail) {
      return NextResponse.json(
        { error: "Missing userEmail parameter" },
        { status: 400 }
      );
    }

    const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);

    return NextResponse.json<ValidateAccessResponse>(
      { hasAccess },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error validating access:", error);
    return NextResponse.json(
      { error: "Failed to validate access" },
      { status: 500 }
    );
  }
}
