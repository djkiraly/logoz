import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-verification';
import { adminLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/admin/auth/verify-email?token=xxx - Verify email with token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Get base URL directly from environment variables
    // Priority: SITE_URL > NEXT_PUBLIC_SITE_URL > request origin
    let baseUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

    // If still empty or localhost, try to get from request
    if (!baseUrl || baseUrl.includes('localhost')) {
      const requestUrl = new URL(request.url);
      // Use x-forwarded headers if available (for reverse proxies)
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

      if (forwardedHost && !forwardedHost.includes('localhost')) {
        baseUrl = `${forwardedProto}://${forwardedHost}`;
      } else if (!requestUrl.host.includes('localhost')) {
        baseUrl = requestUrl.origin;
      }
    }

    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');

    // Log for debugging
    adminLogger.info('Email verification - URL resolution', {
      SITE_URL: process.env.SITE_URL || 'not set',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'not set',
      resolvedBaseUrl: baseUrl,
      requestUrl: request.url,
    });

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/admin/login?error=missing_token`);
    }

    const result = await verifyEmailToken(token);

    if (result.success) {
      adminLogger.info('Email verified via link', { userId: result.userId, redirectTo: `${baseUrl}/admin/login?verified=true` });
      return NextResponse.redirect(`${baseUrl}/admin/login?verified=true`);
    } else {
      adminLogger.warn('Email verification failed', { error: result.error });
      return NextResponse.redirect(
        `${baseUrl}/admin/login?error=${encodeURIComponent(result.error || 'verification_failed')}`
      );
    }
  } catch (error) {
    adminLogger.error('Error in email verification', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback redirect
    const baseUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    return NextResponse.redirect(
      `${baseUrl}/admin/login?error=verification_error`
    );
  }
}
