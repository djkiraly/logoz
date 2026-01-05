import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const gcsConfigSchema = z.object({
  projectId: z.string().min(1),
  bucketName: z.string().min(1),
  clientEmail: z.string().email(),
  privateKey: z.string().min(1),
  enabled: z.boolean(),
}).nullable().optional();

const settingsSchema = z.object({
  siteName: z.string().max(100).optional().or(z.literal('')),
  heroTagline: z.string().max(100).optional().or(z.literal('')),
  heroHeading: z.string().max(200).optional().or(z.literal('')),
  heroCopy: z.string().max(1000).optional().or(z.literal('')),
  ctaLabel: z.string().max(50).optional().or(z.literal('')),
  ctaLink: z.string().max(200).optional().or(z.literal('')),
  contactEmail: z.string().max(200).optional().or(z.literal('')), // Removed strict email validation - DB handles unique
  contactPhone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  announcement: z.string().max(200).optional().or(z.literal('')),
  bannerEnabled: z.boolean().optional(),
  headerCtaEnabled: z.boolean().optional(),
  headerCtaLabel: z.string().max(50).optional().or(z.literal('')),
  headerCtaLink: z.string().max(200).optional().or(z.literal('')),
  copyrightText: z.string().max(200).optional().or(z.literal('')),
  faviconUrl: z.string().max(500).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  gcsConfig: gcsConfigSchema,
  // Hero Video Intro settings
  heroVideoEnabled: z.boolean().optional(),
  heroVideoUrl: z.string().max(500).nullable().optional(),
  heroVideoAutoplay: z.boolean().optional(),
  heroVideoMuted: z.boolean().optional(),
  heroVideoDuration: z.number().int().min(1).max(300).nullable().optional(),
  // reCAPTCHA settings
  recaptchaEnabled: z.boolean().optional(),
  recaptchaSiteKey: z.string().max(100).optional().or(z.literal('')).nullable(),
  recaptchaSecretKey: z.string().max(100).optional().or(z.literal('')).nullable(),
});

// GET: Load all settings
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ ok: true, data: null });
    }

    const settings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
    });

    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT: Update settings
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const body = await request.json();
    console.log('[Settings API] Received body:', JSON.stringify(body).substring(0, 200));

    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      console.log('[Settings API] Validation failed:', parsed.error.flatten());
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

    // Get existing settings
    const existingSettings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
    });

    console.log('[Settings API] Existing settings found:', !!existingSettings);

    // Helper to get value
    const getValue = (newVal: string | undefined, existingVal: string | undefined | null, defaultVal: string): string => {
      if (newVal !== undefined && newVal !== '') return newVal;
      if (existingVal !== undefined && existingVal !== null && existingVal !== '') return existingVal;
      return defaultVal;
    };

    // Build settings data without gcsConfig first
    const baseSettingsData = {
      siteName: getValue(data.siteName, existingSettings?.siteName, 'My Store'),
      heroTagline: getValue(data.heroTagline, existingSettings?.heroTagline, 'Cloud print operating system'),
      heroHeading: getValue(data.heroHeading, existingSettings?.heroHeading, 'Welcome'),
      heroCopy: getValue(data.heroCopy, existingSettings?.heroCopy, ''),
      ctaLabel: getValue(data.ctaLabel, existingSettings?.ctaLabel, 'Get Started'),
      ctaLink: getValue(data.ctaLink, existingSettings?.ctaLink, '/'),
      contactEmail: getValue(data.contactEmail, existingSettings?.contactEmail, 'admin@example.com'),
      contactPhone: getValue(data.contactPhone, existingSettings?.contactPhone, ''),
      address: getValue(data.address, existingSettings?.address, ''),
      announcement: data.announcement !== undefined ? (data.announcement || null) : (existingSettings?.announcement || null),
      bannerEnabled: data.bannerEnabled !== undefined ? data.bannerEnabled : (existingSettings?.bannerEnabled ?? true),
      headerCtaEnabled: data.headerCtaEnabled !== undefined ? data.headerCtaEnabled : (existingSettings?.headerCtaEnabled ?? true),
      headerCtaLabel: getValue(data.headerCtaLabel, existingSettings?.headerCtaLabel, 'Build a design'),
      headerCtaLink: getValue(data.headerCtaLink, existingSettings?.headerCtaLink, '/design-studio'),
      copyrightText: getValue(data.copyrightText, existingSettings?.copyrightText, 'Crafted in the cloud.'),
    };

    // Add gcsConfig if provided (only if field exists in schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settingsData: any = { ...baseSettingsData };
    try {
      if (data.gcsConfig !== undefined) {
        settingsData.gcsConfig = data.gcsConfig;
      } else if (existingSettings && 'gcsConfig' in existingSettings) {
        settingsData.gcsConfig = existingSettings.gcsConfig;
      }
    } catch {
      // gcsConfig field may not exist in schema yet
      console.log('[Settings API] gcsConfig field not available in schema');
    }

    // Add reCAPTCHA settings
    if (data.recaptchaEnabled !== undefined) {
      settingsData.recaptchaEnabled = data.recaptchaEnabled;
    } else if (existingSettings) {
      settingsData.recaptchaEnabled = existingSettings.recaptchaEnabled ?? false;
    }

    if (data.recaptchaSiteKey !== undefined) {
      settingsData.recaptchaSiteKey = data.recaptchaSiteKey || null;
    } else if (existingSettings) {
      settingsData.recaptchaSiteKey = existingSettings.recaptchaSiteKey;
    }

    if (data.recaptchaSecretKey !== undefined) {
      settingsData.recaptchaSecretKey = data.recaptchaSecretKey || null;
    } else if (existingSettings) {
      settingsData.recaptchaSecretKey = existingSettings.recaptchaSecretKey;
    }

    // Handle faviconUrl
    if (data.faviconUrl !== undefined) {
      settingsData.faviconUrl = data.faviconUrl;
    } else if (existingSettings && 'faviconUrl' in existingSettings) {
      settingsData.faviconUrl = existingSettings.faviconUrl;
    }

    // Handle logoUrl
    if (data.logoUrl !== undefined) {
      settingsData.logoUrl = data.logoUrl;
    } else if (existingSettings && 'logoUrl' in existingSettings) {
      settingsData.logoUrl = existingSettings.logoUrl;
    }

    // Handle heroImageUrl
    if (data.heroImageUrl !== undefined) {
      settingsData.heroImageUrl = data.heroImageUrl;
    } else if (existingSettings && 'heroImageUrl' in existingSettings) {
      settingsData.heroImageUrl = existingSettings.heroImageUrl;
    }

    // Handle Hero Video Intro settings
    if (data.heroVideoEnabled !== undefined) {
      settingsData.heroVideoEnabled = data.heroVideoEnabled;
    } else if (existingSettings) {
      settingsData.heroVideoEnabled = existingSettings.heroVideoEnabled ?? false;
    }

    if (data.heroVideoUrl !== undefined) {
      settingsData.heroVideoUrl = data.heroVideoUrl || null;
    } else if (existingSettings) {
      settingsData.heroVideoUrl = existingSettings.heroVideoUrl;
    }

    if (data.heroVideoAutoplay !== undefined) {
      settingsData.heroVideoAutoplay = data.heroVideoAutoplay;
    } else if (existingSettings) {
      settingsData.heroVideoAutoplay = existingSettings.heroVideoAutoplay ?? true;
    }

    if (data.heroVideoMuted !== undefined) {
      settingsData.heroVideoMuted = data.heroVideoMuted;
    } else if (existingSettings) {
      settingsData.heroVideoMuted = existingSettings.heroVideoMuted ?? true;
    }

    if (data.heroVideoDuration !== undefined) {
      settingsData.heroVideoDuration = data.heroVideoDuration;
    } else if (existingSettings) {
      settingsData.heroVideoDuration = existingSettings.heroVideoDuration;
    }

    console.log('[Settings API] Upserting with data keys:', Object.keys(settingsData));
    console.log('[Settings API] Data values:', JSON.stringify(settingsData, null, 2));

    // Upsert settings with better error handling
    let settings;
    try {
      settings = await prisma.siteSetting.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          ...settingsData,
        },
        update: settingsData,
      });
      console.log('[Settings API] Upsert successful');
    } catch (dbError) {
      console.error('[Settings API] Database error:', dbError);
      // Check for unique constraint violation
      if (dbError instanceof Error && dbError.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Email address is already in use', code: 'DUPLICATE_EMAIL' },
          { status: 400 }
        );
      }
      throw dbError;
    }

    // Revalidate cached site settings so public pages see the update immediately
    revalidateTag('site-settings', 'max');

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

    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    console.error('[Settings API] Error:', error);
    return handleApiError(error);
  }
}
