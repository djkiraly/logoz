import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { getClientIp } from '@/lib/rate-limit';
import {
  syncByCategory,
  syncByBrand,
  syncSingleProduct,
  isSanMarEnabled,
} from '@/lib/sanmar';
import type { SanMarSyncOptions, SyncProgress } from '@/lib/sanmar';

export const dynamic = 'force-dynamic';

const syncSchema = z.object({
  syncType: z.enum(['category', 'brand', 'product', 'delta']),
  category: z.string().optional(),
  brand: z.string().optional(),
  styleId: z.string().optional(),
  options: z.object({
    includeImages: z.boolean().default(true),
    includeInventory: z.boolean().default(true),
    updateExisting: z.boolean().default(true),
    createNew: z.boolean().default(true),
    dryRun: z.boolean().default(false),
    markupPercent: z.number().min(0).max(500).optional(),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const enabled = await isSanMarEnabled();
    if (!enabled) {
      throw new ApiException(
        'SanMar integration not configured',
        400,
        'SANMAR_NOT_CONFIGURED'
      );
    }

    const body = await request.json();
    const parsed = syncSchema.safeParse(body);

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

    const { syncType, category, brand, styleId, options } = parsed.data;
    const clientIp = getClientIp(request);

    // Convert API options to SanMarSyncOptions format
    const syncOptions: SanMarSyncOptions = {
      dryRun: options?.dryRun ?? false,
      updateExisting: options?.updateExisting ?? true,
      markupPercent: options?.markupPercent,
    };

    let result: SyncProgress | { success: boolean; productId?: string; error?: string };

    switch (syncType) {
      case 'category':
        if (!category) {
          throw new ApiException('Category is required for category sync', 400, 'MISSING_CATEGORY');
        }
        result = await syncByCategory(category, syncOptions);
        break;

      case 'brand':
        if (!brand) {
          throw new ApiException('Brand is required for brand sync', 400, 'MISSING_BRAND');
        }
        result = await syncByBrand(brand, syncOptions);
        break;

      case 'product':
        if (!styleId) {
          throw new ApiException('Style ID is required for product sync', 400, 'MISSING_STYLE_ID');
        }
        result = await syncSingleProduct(styleId, syncOptions);
        break;

      case 'delta':
        // Delta sync will be implemented with background jobs
        throw new ApiException('Delta sync is handled by scheduled jobs', 400, 'USE_SCHEDULED_SYNC');

      default:
        throw new ApiException('Invalid sync type', 400, 'INVALID_SYNC_TYPE');
    }

    // Handle different return types
    if ('success' in result && !('productsAdded' in result)) {
      // Single product sync result
      await logAuditEvent(
        user.id,
        'CREATE',
        'SanMarSyncLog',
        result.productId || 'unknown',
        {
          syncType,
          styleId,
          options: syncOptions,
          success: result.success,
          error: result.error,
        },
        clientIp
      );

      return NextResponse.json({
        ok: true,
        data: result,
      });
    }

    // Full sync result (SyncProgress)
    const syncResult = result as SyncProgress;

    await logAuditEvent(
      user.id,
      'CREATE',
      'SanMarSyncLog',
      syncResult.logId || 'unknown',
      {
        syncType,
        category,
        brand,
        options: syncOptions,
        result: {
          productsAdded: syncResult.productsAdded,
          productsUpdated: syncResult.productsUpdated,
          productsSkipped: syncResult.productsSkipped,
          errorCount: syncResult.errors?.length ?? 0,
        },
      },
      clientIp
    );

    return NextResponse.json({
      ok: true,
      data: {
        logId: syncResult.logId,
        totalItems: syncResult.totalItems,
        processedItems: syncResult.processedItems,
        productsAdded: syncResult.productsAdded,
        productsUpdated: syncResult.productsUpdated,
        productsSkipped: syncResult.productsSkipped,
        variantsAdded: syncResult.variantsAdded,
        variantsUpdated: syncResult.variantsUpdated,
        suppliersAdded: syncResult.suppliersAdded,
        errors: syncResult.errors,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
