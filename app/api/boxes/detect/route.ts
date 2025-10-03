import { NextRequest, NextResponse } from 'next/server';
import { BoxDetectionService } from '@/modules/boxes/api/services/box-detection.service';
import { BoxService } from '@/modules/boxes/api/services/box.service';
import type { DetectBoxesResponse } from '@/modules/boxes/api/models/box.api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, aimharderToken, cookies } = body;

    if (!userEmail || !aimharderToken || !cookies) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Step 1: Detect boxes from Aimharder
    const detectedBoxes = await BoxDetectionService.detectUserBoxes(
      aimharderToken,
      cookies
    );

    if (detectedBoxes.length === 0) {
      return NextResponse.json<DetectBoxesResponse>(
        {
          boxes: [],
          newBoxesCount: 0,
        },
        { status: 200 }
      );
    }

    // Step 2: Upsert boxes and link to user
    let newBoxesCount = 0;
    const boxPromises = detectedBoxes.map(async (detectedBox) => {
      // Check if box exists
      const existingBoxes = await BoxService.getUserBoxes(userEmail);
      const isNewForUser = !existingBoxes.some(
        (b) => b.box_id === detectedBox.boxId
      );

      if (isNewForUser) {
        newBoxesCount++;
      }

      // Upsert box
      const box = await BoxService.upsertBox(detectedBox);

      // Link user to box
      await BoxService.linkUserToBox(userEmail, box.id);

      return box;
    });

    await Promise.all(boxPromises);

    // Step 3: Fetch all user boxes (with access info)
    const userBoxes = await BoxService.getUserBoxes(userEmail);

    return NextResponse.json<DetectBoxesResponse>(
      {
        boxes: userBoxes,
        newBoxesCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error detecting boxes:', error);
    return NextResponse.json(
      { error: 'Failed to detect boxes' },
      { status: 500 }
    );
  }
}
