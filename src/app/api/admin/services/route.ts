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

const serviceSchema = z.object({
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

    // Fetch all services with category count
    const services = await prisma.service.findMany({
      orderBy: { title: 'asc' },
      include: {
        _count: {
          select: { categories: true },
        },
      },
    });

    return NextResponse.json({ ok: true, data: services });
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

    // Check authorization (only SUPER_ADMIN and ADMIN can create services)
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const body = await request.json();
    const parsed = serviceSchema.safeParse(body);

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

    // Check if slug already exists
    const existingService = await prisma.service.findUnique({
      where: { slug: data.slug },
    });

    if (existingService) {
      return NextResponse.json(
        { error: 'A service with this slug already exists', code: 'DUPLICATE_SLUG' },
        { status: 400 }
      );
    }

    // Create service
    const service = await prisma.service.create({
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
      'CREATE',
      'Service',
      service.id,
      { title: service.title, slug: service.slug },
      clientIp
    );

    reqLogger.info('Service created', { userId: user.id, serviceId: service.id });

    return NextResponse.json({ ok: true, data: service }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
