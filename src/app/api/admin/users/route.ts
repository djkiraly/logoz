import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, hashPassword, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR']).default('EDITOR'),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Only admins can view users
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const users = await prisma.adminUser.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    return NextResponse.json({ ok: true, data: users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const reqLogger = createRequestLogger(request);

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Only SUPER_ADMIN and ADMIN can create users
    if (currentUser.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

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

    const data = parsed.data;

    // Only SUPER_ADMIN can create SUPER_ADMIN users
    if (data.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      throw new ApiException('Only Super Admins can create Super Admin users', 403, 'FORBIDDEN');
    }

    // ADMIN can only create EDITOR users
    if (currentUser.role === 'ADMIN' && data.role !== 'EDITOR') {
      throw new ApiException('Admins can only create Editor users', 403, 'FORBIDDEN');
    }

    // Check if email already exists
    const existingUser = await prisma.adminUser.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ApiException('A user with this email already exists', 400, 'EMAIL_EXISTS');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const newUser = await prisma.adminUser.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role,
        isActive: data.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      currentUser.id,
      'CREATE',
      'AdminUser',
      newUser.id,
      { email: newUser.email, role: newUser.role },
      clientIp
    );

    reqLogger.info('User created', { userId: currentUser.id, newUserId: newUser.id });

    return NextResponse.json({ ok: true, data: newUser }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
