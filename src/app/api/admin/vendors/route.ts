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
  logoUrl: z.string().url().nullable().optional(),
  website: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  leadTimeDays: z.number().int().min(0).nullable().optional(),
  capabilities: z.array(
    z.enum([
      'EMBROIDERY',
      'SCREEN_PRINT',
      'DTG',
      'VINYL',
      'SUBLIMATION',
      'LASER',
      'PROMO',
    ])
  ).default([]),
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

    // Fetch all vendors with product count
    const vendors = await prisma.supplier.findMany({
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

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

    // Create vendor
    const vendor = await prisma.supplier.create({
      data: {
        name: data.name,
        logoUrl: data.logoUrl || null,
        website: data.website || null,
        description: data.description || null,
        leadTimeDays: data.leadTimeDays ?? null,
        capabilities: data.capabilities,
        featured: data.featured,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

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
