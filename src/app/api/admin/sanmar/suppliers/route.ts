import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import {
  getSanMarSuppliers,
  updateSupplierRestrictions,
} from '@/lib/sanmar';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const suppliers = await getSanMarSuppliers();

    return NextResponse.json({
      ok: true,
      data: suppliers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await request.json();

    // Update restriction flags based on current lists
    if (body.action === 'updateRestrictions') {
      const result = await updateSupplierRestrictions();

      return NextResponse.json({
        ok: true,
        data: result,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
