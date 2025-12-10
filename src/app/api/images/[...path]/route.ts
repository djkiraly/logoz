import { NextRequest, NextResponse } from 'next/server';
import { getGcsClient, isGcsEnabled } from '@/lib/gcs';

export const dynamic = 'force-dynamic';

// Cache for 1 hour on CDN/browser
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * GET /api/images/[...path] - Proxy images from GCS
 *
 * This endpoint serves images from a private GCS bucket,
 * allowing images to be accessed without making the bucket public.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;

    if (!path || path.length === 0) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    const filePath = path.join('/');

    // Check if GCS is enabled
    const gcsEnabled = await isGcsEnabled();
    if (!gcsEnabled) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      );
    }

    const client = await getGcsClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Storage not available' },
        { status: 503 }
      );
    }

    const { bucket } = client;
    const file = bucket.file(filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file metadata for content type
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';

    // Download the file
    const [contents] = await file.download();

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(contents);

    // Return the image with appropriate headers
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': CACHE_CONTROL,
        'Content-Length': contents.length.toString(),
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
