import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-verification';
import { adminLogger } from '@/lib/logger';
import { getBaseUrl } from '@/lib/url-utils';

// GET /api/admin/auth/verify-email?token=xxx - Verify email with token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Get the correct base URL for redirects
    const baseUrl = await getBaseUrl();

    if (!token) {
      // Redirect to login with error
      return NextResponse.redirect(`${baseUrl}/admin/login?error=missing_token`);
    }

    const result = await verifyEmailToken(token);

    if (result.success) {
      adminLogger.info('Email verified via link', { userId: result.userId });
      // Redirect to login with success message
      return NextResponse.redirect(`${baseUrl}/admin/login?verified=true`);
    } else {
      adminLogger.warn('Email verification failed', { error: result.error });
      // Redirect to login with error
      return NextResponse.redirect(
        `${baseUrl}/admin/login?error=${encodeURIComponent(result.error || 'verification_failed')}`
      );
    }
  } catch (error) {
    adminLogger.error('Error in email verification', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback redirect - try to get base URL, otherwise use relative path
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    return NextResponse.redirect(
      `${baseUrl}/admin/login?error=verification_error`
    );
  }
}
