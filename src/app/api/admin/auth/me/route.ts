import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new ApiException('Not authenticated', 401, 'UNAUTHORIZED');
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
