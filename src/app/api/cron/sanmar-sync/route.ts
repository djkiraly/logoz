import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminLogger } from '@/lib/logger';
import {
  getSanMarConfig,
  getSanMarClient,
  syncByCategory,
  updateSyncTimestamp,
} from '@/lib/sanmar';
import { prisma } from '@/lib/prisma';
import { SanMarSyncType, SanMarSyncStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

/**
 * Vercel Cron job for SanMar delta sync
 * Runs daily to fetch updated product data
 */
export async function GET(request: Request) {
  const headersList = await headers();

  // Verify cron secret (Vercel sets this header)
  const authHeader = headersList.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify the cron secret
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      adminLogger.warn('Unauthorized cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Check if sync is enabled
    const config = await getSanMarConfig();
    if (!config?.syncEnabled || !config?.autoSyncEnabled) {
      adminLogger.info('SanMar auto-sync is disabled, skipping cron job');
      return NextResponse.json({
        ok: true,
        message: 'Auto-sync disabled',
        skipped: true,
      });
    }

    // Check if credentials are configured
    const client = await getSanMarClient();
    if (!client) {
      adminLogger.warn('SanMar credentials not configured for cron job');
      return NextResponse.json({
        ok: false,
        error: 'Credentials not configured',
      });
    }

    // Create sync log entry
    const syncLog = await prisma.sanMarSyncLog.create({
      data: {
        syncType: SanMarSyncType.DELTA,
        status: SanMarSyncStatus.RUNNING,
        triggeredBy: 'cron',
        startedAt: new Date(),
      },
    });

    adminLogger.info('Starting SanMar cron sync', { logId: syncLog.id });

    let totalProducts = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    // Get categories to sync
    const categoriesToSync = config.categoryFilter.length > 0
      ? config.categoryFilter
      : []; // If no filter, we'd sync all but that's expensive

    if (categoriesToSync.length === 0) {
      // Without a category filter, skip the sync to avoid excessive API calls
      await prisma.sanMarSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SanMarSyncStatus.COMPLETED,
          completedAt: new Date(),
          errorCount: 0,
          errors: ['No categories configured for auto-sync'],
        },
      });

      return NextResponse.json({
        ok: true,
        message: 'No categories configured for auto-sync',
        skipped: true,
      });
    }

    // Sync each configured category
    for (const category of categoriesToSync) {
      try {
        const result = await syncByCategory(category, {
          defaultVisibility: config.defaultVisibility,
          defaultCategoryId: config.defaultCategoryId || undefined,
          includeDiscontinued: config.importDiscontinued,
        });

        totalProducts += result.productsAdded + result.productsUpdated;

        if (result.errors.length > 0) {
          totalErrors += result.errors.length;
          errors.push(...result.errors.map(e => `${category}: ${e.message}`));
        }
      } catch (error) {
        totalErrors++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${category}: ${errorMsg}`);
        adminLogger.error('Category sync failed in cron', { category, error: errorMsg });
      }
    }

    // Update sync log
    await prisma.sanMarSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: totalErrors > 0 && totalProducts === 0
          ? SanMarSyncStatus.FAILED
          : SanMarSyncStatus.COMPLETED,
        completedAt: new Date(),
        productsAdded: totalProducts,
        errorCount: totalErrors,
        errors: errors.slice(0, 50), // Limit stored errors
      },
    });

    // Update sync timestamp
    await updateSyncTimestamp('delta');

    adminLogger.info('SanMar cron sync completed', {
      logId: syncLog.id,
      totalProducts,
      totalErrors,
    });

    return NextResponse.json({
      ok: true,
      data: {
        logId: syncLog.id,
        productsProcessed: totalProducts,
        errorCount: totalErrors,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    adminLogger.error('SanMar cron sync failed', { error: errorMsg });

    return NextResponse.json(
      {
        ok: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
