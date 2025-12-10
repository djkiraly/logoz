import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { testGcsConnection, type GcsConfig } from '@/lib/gcs';

export const dynamic = 'force-dynamic';

const testConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  bucketName: z.string().min(1, 'Bucket name is required'),
  clientEmail: z.string().email('Invalid service account email'),
  privateKey: z.string().min(1, 'Private key is required'),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const parsed = testConfigSchema.safeParse(body);

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

    const config: GcsConfig = {
      ...parsed.data,
      enabled: true,
    };

    const result = await testGcsConnection(config);

    if (result.success) {
      return NextResponse.json({
        ok: true,
        message: 'Connection successful! GCS is configured correctly.',
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Connection failed',
          code: 'CONNECTION_FAILED',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
