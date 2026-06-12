import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'logoz_admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS for API routes
  if (pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.SITE_URL,
    ].filter(Boolean) as string[];

    const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      if (isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Max-Age', '86400');
      }
      return response;
    }

    // For non-preflight API requests, continue and add CORS headers
    const response = NextResponse.next();
    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return response;
  }

  // Handle admin routes
  if (pathname.startsWith('/admin')) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    // Public admin routes that don't require authentication
    const publicAdminRoutes = [
      '/admin/login',
      '/admin/forgot-password',
      '/admin/reset-password',
    ];

    const isPublicRoute = publicAdminRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

    if (isPublicRoute) {
      // If already authenticated and trying to access login, redirect to dashboard
      if (sessionToken && pathname === '/admin/login') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      // Set pathname header for admin detection in root layout
      const response = NextResponse.next();
      response.headers.set('x-pathname', pathname);
      return response;
    }

    // Protect all other admin routes
    if (!sessionToken) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Set pathname header for admin detection in root layout
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // Track page views for analytics (non-admin, non-API routes)
  if (
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')
  ) {
    // We'll track this async via API
    const response = NextResponse.next();

    // Generate or get session ID for analytics
    let sessionId = request.cookies.get('logoz_session')?.value;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      response.cookies.set('logoz_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }

    // Set headers for page view tracking
    response.headers.set('x-pathname', pathname);
    response.headers.set('x-session-id', sessionId);

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api/admin/sanmar/catalog (large streaming upload — must NOT be proxied,
     *   or Next buffers the whole request body in memory and caps it at
     *   proxyClientMaxBodySize/10MB, truncating big catalog files)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/admin/sanmar/catalog|.*\\..*).*)',
  ],
};
