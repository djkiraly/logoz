import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPasswordResetToken, resetPassword } from '@/lib/password-reset';
import { handleApiError } from '@/lib/api-utils';
import { adminLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// GET /api/admin/auth/reset-password?token=xxx - Verify token is valid
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          error: 'Token is required',
          code: 'MISSING_TOKEN',
        },
        { status: 400 }
      );
    }

    const result = await verifyPasswordResetToken(token);

    if (result.valid) {
      return NextResponse.json({
        ok: true,
        valid: true,
        email: result.email, // Return masked email for UI
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          valid: false,
          error: result.error,
          code: 'INVALID_TOKEN',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/admin/auth/reset-password - Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

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

    const { token, password } = parsed.data;

    const result = await resetPassword(token, password);

    if (result.success) {
      adminLogger.info('Password reset completed');
      return NextResponse.json({
        ok: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
      });
    } else {
      return NextResponse.json(
        {
          error: result.error || 'Failed to reset password',
          code: 'RESET_FAILED',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
