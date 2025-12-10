import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, hashPassword, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  isActive: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Users can view their own profile, admins can view anyone
    if (currentUser.id !== id && currentUser.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const user = await prisma.adminUser.findUnique({
      where: { id },
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

    if (!user) {
      throw new ApiException('User not found', 404, 'NOT_FOUND');
    }

    return NextResponse.json({ ok: true, data: user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Get target user
    const targetUser = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new ApiException('User not found', 404, 'NOT_FOUND');
    }

    // Permission checks
    const isSelf = currentUser.id === id;
    const canEdit =
      currentUser.role === 'SUPER_ADMIN' ||
      (currentUser.role === 'ADMIN' && targetUser.role !== 'SUPER_ADMIN') ||
      isSelf;

    if (!canEdit) {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

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

    // Role change restrictions
    if (data.role !== targetUser.role) {
      // Only SUPER_ADMIN can change roles to/from SUPER_ADMIN
      if (
        (data.role === 'SUPER_ADMIN' || targetUser.role === 'SUPER_ADMIN') &&
        currentUser.role !== 'SUPER_ADMIN'
      ) {
        throw new ApiException('Only Super Admins can modify Super Admin roles', 403, 'FORBIDDEN');
      }

      // ADMIN can only set EDITOR role
      if (currentUser.role === 'ADMIN' && data.role !== 'EDITOR') {
        throw new ApiException('Admins can only assign Editor role', 403, 'FORBIDDEN');
      }

      // Users cannot change their own role (except SUPER_ADMIN)
      if (isSelf && currentUser.role !== 'SUPER_ADMIN') {
        throw new ApiException('You cannot change your own role', 403, 'FORBIDDEN');
      }
    }

    // Prevent self-deactivation
    if (isSelf && !data.isActive) {
      throw new ApiException('You cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
    }

    // Check email uniqueness if changed
    if (data.email !== targetUser.email) {
      const existingUser = await prisma.adminUser.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new ApiException('A user with this email already exists', 400, 'EMAIL_EXISTS');
      }
    }

    // Build update data
    const updateData: {
      email: string;
      name: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';
      isActive: boolean;
      passwordHash?: string;
    } = {
      email: data.email,
      name: data.name,
      role: data.role,
      isActive: data.isActive,
    };

    // Hash new password if provided
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
    }

    // Update user
    const updatedUser = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    // If user is deactivated, delete their sessions
    if (!data.isActive && targetUser.isActive) {
      await prisma.adminSession.deleteMany({
        where: { userId: id },
      });
    }

    // Log audit event
    const clientIp = getClientIp(request);
    const changes: string[] = [];
    if (data.email !== targetUser.email) changes.push('email');
    if (data.name !== targetUser.name) changes.push('name');
    if (data.role !== targetUser.role) changes.push('role');
    if (data.isActive !== targetUser.isActive) changes.push('isActive');
    if (data.password) changes.push('password');

    await logAuditEvent(
      currentUser.id,
      'UPDATE',
      'AdminUser',
      updatedUser.id,
      { changes },
      clientIp
    );

    reqLogger.info('User updated', { userId: currentUser.id, targetUserId: id, changes });

    return NextResponse.json({ ok: true, data: updatedUser });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Cannot delete yourself
    if (currentUser.id === id) {
      throw new ApiException('You cannot delete your own account', 400, 'CANNOT_DELETE_SELF');
    }

    // Get target user
    const targetUser = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new ApiException('User not found', 404, 'NOT_FOUND');
    }

    // Permission checks
    // Only SUPER_ADMIN can delete anyone
    // ADMIN can only delete EDITOR users
    const canDelete =
      currentUser.role === 'SUPER_ADMIN' ||
      (currentUser.role === 'ADMIN' && targetUser.role === 'EDITOR');

    if (!canDelete) {
      throw new ApiException('Insufficient permissions to delete this user', 403, 'FORBIDDEN');
    }

    // Delete user (sessions will cascade)
    await prisma.adminUser.delete({
      where: { id },
    });

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      currentUser.id,
      'DELETE',
      'AdminUser',
      id,
      { email: targetUser.email, role: targetUser.role },
      clientIp
    );

    reqLogger.info('User deleted', { userId: currentUser.id, deletedUserId: id });

    return NextResponse.json({ ok: true, message: 'User deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
