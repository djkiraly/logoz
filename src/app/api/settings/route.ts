import { NextResponse } from 'next/server';
import { getSiteSettings } from '@/lib/site-data';
import { handleApiError, getCacheHeaders } from '@/lib/api-utils';

// Revalidate every 30 minutes
export const revalidate = 1800;

export async function GET() {
  try {
    const settings = await getSiteSettings();

    return NextResponse.json(
      { data: settings },
      {
        headers: getCacheHeaders({
          maxAge: 300, // Browser cache: 5 minutes
          sMaxAge: 1800, // CDN cache: 30 minutes
          staleWhileRevalidate: 3600, // Serve stale for 1 hour while revalidating
        }),
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
