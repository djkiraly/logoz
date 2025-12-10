import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-verification';
import { adminLogger } from '@/lib/logger';

// GET /api/admin/auth/verify-email?token=xxx - Verify email with token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      // Redirect to login with error
      return NextResponse.redirect(
        new URL('/admin/login?error=missing_token', request.url)
      );
    }

    const result = await verifyEmailToken(token);

    if (result.success) {
      adminLogger.info('Email verified via link', { userId: result.userId });
      // Redirect to login with success message
      return NextResponse.redirect(
        new URL('/admin/login?verified=true', request.url)
      );
    } else {
      adminLogger.warn('Email verification failed', { error: result.error });
      // Redirect to login with error
      return NextResponse.redirect(
        new URL(`/admin/login?error=${encodeURIComponent(result.error || 'verification_failed')}`, request.url)
      );
    }
  } catch (error) {
    adminLogger.error('Error in email verification', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(
      new URL('/admin/login?error=verification_error', request.url)
    );
  }
}
