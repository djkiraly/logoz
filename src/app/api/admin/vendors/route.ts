import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

// Disable caching for admin vendors endpoint
export const dynamic = 'force-dynamic';

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  logoUrl: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  leadTimeDays: z.number().int().min(0).nullable().optional(),
  categoryIds: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
});

export async function GET() {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ ok: true, data: [] });
    }

    // Fetch all vendors with product count and categories
    let vendors;
    try {
      // Try with categories relation (requires Prisma client regeneration)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendors = await (prisma.supplier.findMany as any)({
        orderBy: [{ featured: 'desc' }, { name: 'asc' }],
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
      // Fallback without categories if relation not yet available
      vendors = await prisma.supplier.findMany({
        orderBy: [{ featured: 'desc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { products: true },
          },
        },
      });
      // Add empty categories array to each vendor
      vendors = vendors.map((v) => ({ ...v, categories: [] }));
    }

    return NextResponse.json({ ok: true, data: vendors });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const reqLogger = createRequestLogger(request);

  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check authorization (only SUPER_ADMIN and ADMIN can create vendors)
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const body = await request.json();
    const parsed = vendorSchema.safeParse(body);

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

    // Create vendor - using type assertion due to Prisma client needing regeneration
    let vendor;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendor = await (prisma.supplier.create as any)({
        data: {
          name: data.name,
          logoUrl: data.logoUrl || null,
          website: data.website || null,
          description: data.description || null,
          leadTimeDays: data.leadTimeDays ?? null,
          featured: data.featured,
          categories: data.categoryIds.length > 0
            ? { connect: data.categoryIds.map((id: string) => ({ id })) }
            : undefined,
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
      vendor = await prisma.supplier.create({
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
      'CREATE',
      'Supplier',
      vendor.id,
      { name: vendor.name },
      clientIp
    );

    reqLogger.info('Vendor created', { userId: user.id, vendorId: vendor.id });

    return NextResponse.json({ ok: true, data: vendor }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
