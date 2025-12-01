import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/site-data';
import { handleApiError, getCacheHeaders } from '@/lib/api-utils';

// Revalidate every 5 minutes
export const revalidate = 300;

export async function GET() {
  try {
    const products = await getProducts();

    return NextResponse.json(
      { data: products },
      {
        headers: getCacheHeaders({
          maxAge: 60, // Browser cache: 1 minute
          sMaxAge: 300, // CDN cache: 5 minutes
          staleWhileRevalidate: 600, // Serve stale for 10 min while revalidating
        }),
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
