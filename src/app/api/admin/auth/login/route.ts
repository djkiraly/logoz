import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
  verifyPassword,
  hashPassword,
  createSession,
  setSessionCookie,
  logAuditEvent,
} from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { checkRateLimit, getClientIp, getRateLimitHeaders } from '@/lib/rate-limit';
import { isEmailVerificationEnabled } from '@/lib/email-verification';
import { verifyRecaptcha, isRecaptchaEnabled } from '@/lib/recaptcha';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  recaptchaToken: z.string().optional(),
});

export async function POST(request: Request) {
  const reqLogger = createRequestLogger(request);
  reqLogger.info('Admin login attempt');

  try {
    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    // Rate limit login attempts
    const clientIpForRateLimit = getClientIp(request);
    const rateLimitResult = await checkRateLimit(`login:${clientIpForRateLimit}`, {
      interval: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
    });

    if (!rateLimitResult.success) {
      reqLogger.warn('Login rate limit exceeded', { ip: clientIpForRateLimit });
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

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

    const { email, password, recaptchaToken } = parsed.data;

    // Verify reCAPTCHA if enabled
    const recaptchaEnabled = await isRecaptchaEnabled();
    if (recaptchaEnabled) {
      const clientIp = getClientIp(request);
      const recaptchaResult = await verifyRecaptcha(recaptchaToken || '', clientIp);

      if (!recaptchaResult.success) {
        reqLogger.warn('Login failed: reCAPTCHA verification failed', { email });
        return NextResponse.json(
          {
            error: recaptchaResult.error || 'reCAPTCHA verification failed',
            code: 'RECAPTCHA_FAILED',
          },
          { status: 400 }
        );
      }
    }

    // Find user by email
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      reqLogger.warn('Login failed: user not found', { email });
      // Use generic message to prevent email enumeration
      throw new ApiException('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      reqLogger.warn('Login failed: user inactive', { userId: user.id });
      throw new ApiException('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const { valid: isValidPassword, needsRehash } = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      reqLogger.warn('Login failed: invalid password', { userId: user.id });
      throw new ApiException('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Migrate legacy SHA-256 hash to bcrypt on successful login
    if (needsRehash) {
      const newHash = await hashPassword(password);
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
      reqLogger.info('Migrated password hash to bcrypt', { userId: user.id });
    }

    // Check email verification (only if verification is enabled)
    const verificationEnabled = await isEmailVerificationEnabled();
    if (verificationEnabled && !user.emailVerified) {
      reqLogger.warn('Login failed: email not verified', { userId: user.id });
      return NextResponse.json(
        {
          error: 'Please verify your email before logging in',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email,
          userId: user.id,
        },
        { status: 403 }
      );
    }

    // Create session
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const { token, expiresAt } = await createSession(user.id, clientIp, userAgent);

    // Set session cookie
    await setSessionCookie(token, expiresAt);

    // Log audit event
    await logAuditEvent(user.id, 'LOGIN', 'AdminUser', user.id, { email }, clientIp);

    reqLogger.info('Login successful', { userId: user.id, email });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
