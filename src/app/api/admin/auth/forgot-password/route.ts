import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/password-reset';
import { handleApiError } from '@/lib/api-utils';
import { adminLogger } from '@/lib/logger';
import { getBaseUrl } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// POST /api/admin/auth/forgot-password - Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Get base URL
    const baseUrl = await getBaseUrl();

    const result = await requestPasswordReset(email.toLowerCase(), baseUrl);

    if (result.success) {
      adminLogger.info('Password reset requested', { email });
      // Always return success message to prevent email enumeration
      return NextResponse.json({
        ok: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    } else {
      // Only show specific errors for system issues, not for missing emails
      if (result.error?.includes('Email service not configured')) {
        return NextResponse.json(
          {
            error: result.error,
            code: 'EMAIL_NOT_CONFIGURED',
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: result.error || 'Failed to process request',
          code: 'REQUEST_FAILED',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
