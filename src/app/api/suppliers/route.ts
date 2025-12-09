import { NextResponse } from 'next/server';
import { getSuppliers } from '@/lib/site-data';
import { handleApiError, getCacheHeaders } from '@/lib/api-utils';

// Revalidate every 10 minutes
export const revalidate = 600;

export async function GET() {
  try {
    const suppliers = await getSuppliers();

    return NextResponse.json(
      { data: suppliers },
      {
        headers: getCacheHeaders({
          maxAge: 120, // Browser cache: 2 minutes
          sMaxAge: 600, // CDN cache: 10 minutes
          staleWhileRevalidate: 1200, // Serve stale for 20 min while revalidating
        }),
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
