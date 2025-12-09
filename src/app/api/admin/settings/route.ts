import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

const settingsSchema = z.object({
  siteName: z.string().min(1).max(100),
  heroHeading: z.string().max(200),
  heroCopy: z.string().max(1000),
  ctaLabel: z.string().max(50),
  ctaLink: z.string().max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30),
  address: z.string().max(500),
  announcement: z.string().max(200).optional(),
});

export async function PUT(request: Request) {
  const reqLogger = createRequestLogger(request);

  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check authorization (only SUPER_ADMIN and ADMIN can update settings)
    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);

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

    // Upsert settings (create if not exists, update if exists)
    const settings = await prisma.siteSetting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        siteName: data.siteName,
        heroHeading: data.heroHeading,
        heroCopy: data.heroCopy,
        ctaLabel: data.ctaLabel,
        ctaLink: data.ctaLink,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        announcement: data.announcement || null,
      },
      update: {
        siteName: data.siteName,
        heroHeading: data.heroHeading,
        heroCopy: data.heroCopy,
        ctaLabel: data.ctaLabel,
        ctaLink: data.ctaLink,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        announcement: data.announcement || null,
      },
    });

    // Log audit event
    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'UPDATE',
      'SiteSetting',
      '1',
      { changes: Object.keys(data) },
      clientIp
    );

    reqLogger.info('Settings updated', { userId: user.id });

    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    return handleApiError(error);
  }
}
