import { NextRequest, NextResponse } from 'next/server';
import { SupabaseSessionService } from '@/modules/auth/api/services/supabase-session.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    const session = await SupabaseSessionService.getSession(email);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      aimharderToken: session.token,
      cookies: session.cookies,
      isAdmin: session.isAdmin || false,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
