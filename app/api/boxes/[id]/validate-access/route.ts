import { NextRequest, NextResponse } from 'next/server';
import { BoxAccessService } from '@/modules/boxes/api/services/box-access.service';
import type { ValidateAccessResponse } from '@/modules/boxes/api/models/box.api';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get('userEmail');
    const boxId = params.id;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      );
    }

    const hasAccess = await BoxAccessService.validateAccess(userEmail, boxId);

    return NextResponse.json<ValidateAccessResponse>(
      { hasAccess },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error validating access:', error);
    return NextResponse.json(
      { error: 'Failed to validate access' },
      { status: 500 }
    );
  }
}
