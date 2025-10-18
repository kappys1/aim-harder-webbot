import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const REQUIRED_COOKIES = ['AWSALB', 'AWSALBCORS', 'PHPSESSID', 'amhrdrauth']

function isAuthenticated(request: NextRequest): boolean {
  // Check if all required cookies exist
  return REQUIRED_COOKIES.every(cookieName =>
    request.cookies.has(cookieName)
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuth = isAuthenticated(request)
  const isLoginPage = pathname === '/login'
  const isRootPage = pathname === '/'
  const isProtectedRoute = pathname.startsWith('/dashboard') ||
                          pathname.startsWith('/booking') ||
                          pathname.startsWith('/my-prebookings')

  // PUBLIC ROUTES: Allow access to /login when not authenticated
  if (!isAuth && isLoginPage) {
    return NextResponse.next()
  }

  // AUTHENTICATED USER REDIRECTS: If user is authenticated and tries to access root or login, redirect to dashboard
  if (isAuth && (isRootPage || isLoginPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // PROTECTED ROUTES: If user is not authenticated and tries to access protected routes, redirect to login
  if (!isAuth && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ROOT REDIRECT: If not authenticated and accessing root, redirect to login
  if (!isAuth && isRootPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // DEFAULT: Allow access
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}