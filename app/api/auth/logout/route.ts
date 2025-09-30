import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear all authentication cookies
  const cookieNames = ['AWSALB', 'AWSALBCORS', 'PHPSESSID', 'amhrdrauth']

  cookieNames.forEach(name => {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    })
  })

  return response
}