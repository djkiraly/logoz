import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { getSyncHistory, getSyncStats } from '@/lib/sanmar';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const includeStats = searchParams.get('stats') === 'true';

    const [history, stats] = await Promise.all([
      getSyncHistory(limit),
      includeStats ? getSyncStats() : null,
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        history,
        stats,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
