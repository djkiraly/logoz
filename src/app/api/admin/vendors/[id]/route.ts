import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

// Disable caching for admin vendors endpoint
export const dynamic = 'force-dynamic';

const vendorUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  logoUrl: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  leadTimeDays: z.number().int().min(0).nullable().optional(),
  categoryIds: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    let vendor;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendor = await (prisma.supplier.findUnique as any)({
        where: { id },
        include: {
          categories: {
            select: { id: true, title: true, slug: true },
          },
          _count: {
            select: { products: true },
          },
        },
      });
    } catch {
      vendor = await prisma.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });
      if (vendor) {
        vendor = { ...vendor, categories: [] };
      }
    }

    if (!vendor) {
      throw new ApiException('Vendor not found', 404, 'NOT_FOUND');
    }

    return NextResponse.json({ ok: true, data: vendor });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check authorization (only SUPER_ADMIN and ADMIN can update vendors)
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Check if vendor exists
    const existingVendor = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingVendor) {
      throw new ApiException('Vendor not found', 404, 'NOT_FOUND');
    }

    const body = await request.json();
    const parsed = vendorUpdateSchema.safeParse(body);

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

    // Update vendor
    let vendor;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendor = await (prisma.supplier.update as any)({
        where: { id },
        data: {
          name: data.name,
          logoUrl: data.logoUrl || null,
          website: data.website || null,
          description: data.description || null,
          leadTimeDays: data.leadTimeDays ?? null,
          featured: data.featured,
          categories: {
            set: data.categoryIds.map((catId: string) => ({ id: catId })),
          },
        },
        include: {
          categories: {
            select: { id: true, title: true, slug: true },
          },
          _count: {
            select: { products: true },
          },
        },
      });
    } catch {
      // Fallback without categories
      vendor = await prisma.supplier.update({
        where: { id },
        data: {
          name: data.name,
          logoUrl: data.logoUrl || null,
          website: data.website || null,
          description: data.description || null,
          leadTimeDays: data.leadTimeDays ?? null,
          featured: data.featured,
        },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });
      vendor = { ...vendor, categories: [] };
    }

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'UPDATE',
      'Supplier',
      vendor.id,
      { name: vendor.name, changes: Object.keys(data) },
      clientIp
    );

    reqLogger.info('Vendor updated', { userId: user.id, vendorId: vendor.id });

    return NextResponse.json({ ok: true, data: vendor });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check authorization (only SUPER_ADMIN and ADMIN can delete vendors)
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Check if vendor exists
    const existingVendor = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!existingVendor) {
      throw new ApiException('Vendor not found', 404, 'NOT_FOUND');
    }

    // Prevent deletion if vendor has products
    if (existingVendor._count.products > 0) {
      throw new ApiException(
        `Cannot delete vendor with ${existingVendor._count.products} associated product(s). Please reassign or remove products first.`,
        400,
        'HAS_DEPENDENCIES'
      );
    }

    // Delete vendor
    await prisma.supplier.delete({
      where: { id },
    });

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'DELETE',
      'Supplier',
      id,
      { name: existingVendor.name },
      clientIp
    );

    reqLogger.info('Vendor deleted', { userId: user.id, vendorId: id });

    return NextResponse.json({ ok: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
