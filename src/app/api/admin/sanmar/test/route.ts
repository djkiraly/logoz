import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { testSanMarConfigConnection, testSanMarConnection } from '@/lib/sanmar';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check if credentials were provided in the request body
    const body = await request.json().catch(() => ({}));

    let result: { success: boolean; error?: string };

    if (body.customerNumber && body.username && body.password) {
      // Test with provided credentials (before saving)
      const environment = process.env.SANMAR_ENVIRONMENT === 'test' ? 'test' : 'production';
      result = await testSanMarConnection(
        {
          customerNumber: body.customerNumber,
          username: body.username,
          password: body.password,
        },
        environment
      );
    } else {
      // Test with saved credentials
      result = await testSanMarConfigConnection();
    }

    return NextResponse.json({
      ok: true,
      data: {
        success: result.success,
        error: result.error,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
