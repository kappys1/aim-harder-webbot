import { NextRequest, NextResponse } from 'next/server';
import { BoxService } from '@/modules/boxes/api/services/box.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      );
    }

    const boxes = await BoxService.getUserBoxes(userEmail);

    return NextResponse.json({ boxes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching boxes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch boxes' },
      { status: 500 }
    );
  }
}
