import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { resendVerificationEmail, isEmailVerificationEnabled } from '@/lib/email-verification';
import { adminLogger } from '@/lib/logger';

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = resendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Check if email verification is enabled
    const verificationEnabled = await isEmailVerificationEnabled();
    if (!verificationEnabled) {
      return NextResponse.json(
        { error: 'Email verification is not enabled' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      adminLogger.warn('Resend verification attempted for non-existent email', { email });
      // Return success to prevent email enumeration
      return NextResponse.json({
        ok: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        ok: true,
        message: 'Your email is already verified. You can log in.',
        alreadyVerified: true,
      });
    }

    // Get base URL
    const baseUrl = process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get('origin') ||
      'http://localhost:3000';

    // Resend verification email
    const result = await resendVerificationEmail(user.id, baseUrl);

    if (result.success) {
      adminLogger.info('Verification email resent', { userId: user.id, email });
      return NextResponse.json({
        ok: true,
        message: 'Verification email sent! Please check your inbox.',
      });
    } else {
      adminLogger.error('Failed to resend verification email', { userId: user.id, error: result.error });
      return NextResponse.json(
        { error: result.error || 'Failed to send verification email' },
        { status: 500 }
      );
    }
  } catch (error) {
    adminLogger.error('Error in resend verification', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
