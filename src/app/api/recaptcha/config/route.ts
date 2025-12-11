import { NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Get public reCAPTCHA configuration (site key only, no secret)
export async function GET() {
  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json({
        enabled: false,
        siteKey: null,
      });
    }

    const settings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
      select: {
        recaptchaEnabled: true,
        recaptchaSiteKey: true,
        // Explicitly NOT selecting recaptchaSecretKey
      },
    });

    return NextResponse.json({
      enabled: settings?.recaptchaEnabled ?? false,
      siteKey: settings?.recaptchaEnabled ? settings?.recaptchaSiteKey : null,
    });
  } catch (error) {
    console.error('Failed to get reCAPTCHA config:', error);
    return NextResponse.json({
      enabled: false,
      siteKey: null,
    });
  }
}
