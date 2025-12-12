import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

// Disable caching for admin services endpoint
export const dynamic = 'force-dynamic';

const serviceUpdateSchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  title: z.string().min(1, 'Title is required').max(100),
  summary: z.string().min(1, 'Summary is required').max(500),
  body: z.string().max(5000).default(''),
  heroImage: z.string().url().nullable().optional(),
  methods: z.array(
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
  ctaLabel: z.string().max(50).nullable().optional(),
  ctaLink: z.string().max(200).nullable().optional(),
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

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        categories: true,
        _count: {
          select: { categories: true },
        },
      },
    });

    if (!service) {
      throw new ApiException('Service not found', 404, 'NOT_FOUND');
    }

    return NextResponse.json({ ok: true, data: service });
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

    // Check authorization
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Check if service exists
    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new ApiException('Service not found', 404, 'NOT_FOUND');
    }

    const body = await request.json();
    const parsed = serviceUpdateSchema.safeParse(body);

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

    // Check if slug is taken by another service
    if (data.slug !== existingService.slug) {
      const slugTaken = await prisma.service.findUnique({
        where: { slug: data.slug },
      });

      if (slugTaken) {
        return NextResponse.json(
          { error: 'A service with this slug already exists', code: 'DUPLICATE_SLUG' },
          { status: 400 }
        );
      }
    }

    // Update service
    const service = await prisma.service.update({
      where: { id },
      data: {
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        body: data.body,
        heroImage: data.heroImage || null,
        methods: data.methods,
        ctaLabel: data.ctaLabel || null,
        ctaLink: data.ctaLink || null,
      },
      include: {
        _count: {
          select: { categories: true },
        },
      },
    });

    // Revalidate services cache
    revalidateTag('services', 'max');

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'UPDATE',
      'Service',
      service.id,
      { title: service.title, slug: service.slug, changes: Object.keys(data) },
      clientIp
    );

    reqLogger.info('Service updated', { userId: user.id, serviceId: service.id });

    return NextResponse.json({ ok: true, data: service });
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

    // Check authorization (only SUPER_ADMIN can delete services)
    if (user.role !== 'SUPER_ADMIN') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // Check if service exists
    const existingService = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: { categories: true },
        },
      },
    });

    if (!existingService) {
      throw new ApiException('Service not found', 404, 'NOT_FOUND');
    }

    // Delete service
    await prisma.service.delete({
      where: { id },
    });

    // Revalidate services cache
    revalidateTag('services', 'max');

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'DELETE',
      'Service',
      id,
      { title: existingService.title, slug: existingService.slug },
      clientIp
    );

    reqLogger.info('Service deleted', { userId: user.id, serviceId: id });

    return NextResponse.json({ ok: true, message: 'Service deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
