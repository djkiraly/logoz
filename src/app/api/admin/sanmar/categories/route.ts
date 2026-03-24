import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { getClientIp } from '@/lib/rate-limit';
import {
  getAllCategoryMappings,
  updateCategoryMappingEntry,
  initializeCategoryMappings,
  enableAutoCreateForAll,
  getLocalCategories,
  bulkMapCategories,
} from '@/lib/sanmar';

export const dynamic = 'force-dynamic';

const updateMappingSchema = z.object({
  sanmarCategory: z.string().min(1),
  localCategoryId: z.string().nullable(),
  autoCreate: z.boolean().default(false),
});

const bulkMappingSchema = z.object({
  sanmarCategories: z.array(z.string().min(1)),
  localCategoryId: z.string().min(1),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const [mappings, localCategories] = await Promise.all([
      getAllCategoryMappings(),
      getLocalCategories(),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        mappings,
        localCategories,
      },
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
    const clientIp = getClientIp(request);

    // Check if this is an initialize request
    if (body.action === 'initialize') {
      const result = await initializeCategoryMappings();

      await logAuditEvent(
        user.id,
        'CREATE',
        'SanMarCategoryMapping',
        'batch',
        { action: 'initialize', created: result.created },
        clientIp
      );

      return NextResponse.json({
        ok: true,
        data: result,
      });
    }

    // Check if this is an enable auto-create request
    if (body.action === 'enableAutoCreate') {
      const result = await enableAutoCreateForAll();

      await logAuditEvent(
        user.id,
        'UPDATE',
        'SanMarCategoryMapping',
        'batch',
        { action: 'enableAutoCreate', updated: result.updated },
        clientIp
      );

      return NextResponse.json({
        ok: true,
        data: result,
      });
    }

    // Check if this is a bulk mapping request
    if (body.sanmarCategories && body.localCategoryId) {
      const parsed = bulkMappingSchema.safeParse(body);
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

      const result = await bulkMapCategories(
        parsed.data.sanmarCategories,
        parsed.data.localCategoryId
      );

      if (!result.success) {
        throw new ApiException(result.error || 'Bulk mapping failed', 400, 'BULK_MAP_FAILED');
      }

      await logAuditEvent(
        user.id,
        'UPDATE',
        'SanMarCategoryMapping',
        'batch',
        {
          action: 'bulkMap',
          categories: parsed.data.sanmarCategories,
          localCategoryId: parsed.data.localCategoryId,
        },
        clientIp
      );

      return NextResponse.json({
        ok: true,
        data: { mapped: result.mapped },
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

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const parsed = updateMappingSchema.safeParse(body);

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

    const result = await updateCategoryMappingEntry(
      parsed.data.sanmarCategory,
      parsed.data.localCategoryId,
      parsed.data.autoCreate
    );

    if (!result.success) {
      throw new ApiException(result.error || 'Update failed', 400, 'UPDATE_FAILED');
    }

    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'UPDATE',
      'SanMarCategoryMapping',
      parsed.data.sanmarCategory,
      {
        localCategoryId: parsed.data.localCategoryId,
        autoCreate: parsed.data.autoCreate,
      },
      clientIp
    );

    return NextResponse.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
