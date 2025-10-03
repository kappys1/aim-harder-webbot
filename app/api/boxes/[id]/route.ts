import { BoxAccessService } from "@/modules/boxes/api/services/box-access.service";
import { BoxService } from "@/modules/boxes/api/services/box.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("email") || "";
    const boxId = params.id;

    if (!userEmail) {
      return NextResponse.json(
        { error: "Missing userEmail parameter" },
        { status: 400 }
      );
    }

    // Validate access
    const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this box" },
        { status: 403 }
      );
    }

    const box = await BoxService.getBoxById(boxId);

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    return NextResponse.json({ box }, { status: 200 });
  } catch (error) {
    console.error("Error fetching box:", error);
    return NextResponse.json({ error: "Failed to fetch box" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { userEmail } = body;
    const boxId = params.id;

    if (!userEmail) {
      return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
    }

    // Update last accessed timestamp
    await BoxService.updateLastAccessed(userEmail, boxId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating box access:", error);
    return NextResponse.json(
      { error: "Failed to update box access" },
      { status: 500 }
    );
  }
}
