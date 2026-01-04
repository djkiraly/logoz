import { NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';

// Cache for 1 hour, but allow revalidation
export const revalidate = 3600;

export async function GET() {
  try {
    let faviconUrl: string | null = null;

    if (isDatabaseEnabled) {
      const settings = await prisma.siteSetting.findFirst({
        select: { faviconUrl: true },
      });
      faviconUrl = settings?.faviconUrl ?? null;
    }

    // If custom favicon is set, redirect to it
    if (faviconUrl) {
      return NextResponse.redirect(new URL(faviconUrl, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'), {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    // Otherwise, redirect to the default favicon
    return NextResponse.redirect(new URL('/favicon.ico', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'), {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Error fetching favicon:', error);
    // Fallback to default favicon on error
    return NextResponse.redirect(new URL('/favicon.ico', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  }
}
