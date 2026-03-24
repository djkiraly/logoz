import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, logAuditEvent } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { getClientIp } from '@/lib/rate-limit';
import {
  getSanMarConfig,
  saveSanMarConfig,
  updateSanMarSyncSettings,
} from '@/lib/sanmar';

export const dynamic = 'force-dynamic';

const configSchema = z.object({
  customerNumber: z.string().min(1, 'Customer number is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(), // Optional for updates - existing password is kept if not provided
  syncEnabled: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  autoSyncSchedule: z.string().optional(),
  defaultVisibility: z.boolean().optional(),
  defaultCategoryId: z.string().optional(),
  importDiscontinued: z.boolean().optional(),
  categoryFilter: z.array(z.string()).optional(),
  brandFilter: z.array(z.string()).optional(),
});

const syncSettingsSchema = z.object({
  syncEnabled: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  autoSyncSchedule: z.string().optional(),
  defaultVisibility: z.boolean().optional(),
  defaultCategoryId: z.string().optional(),
  importDiscontinued: z.boolean().optional(),
  categoryFilter: z.array(z.string()).optional(),
  brandFilter: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const config = await getSanMarConfig();

    if (!config) {
      return NextResponse.json({
        ok: true,
        data: {
          configured: false,
          config: null,
        },
      });
    }

    // Return customer number and username (but never the password)
    return NextResponse.json({
      ok: true,
      data: {
        configured: !!(config.customerNumber && config.username && config.passwordEncrypted),
        config: {
          id: config.id,
          hasCredentials: !!(config.customerNumber && config.username && config.passwordEncrypted),
          customerNumber: config.customerNumber || '',
          username: config.username || '',
          syncEnabled: config.syncEnabled,
          autoSyncEnabled: config.autoSyncEnabled,
          autoSyncSchedule: config.autoSyncSchedule,
          defaultVisibility: config.defaultVisibility,
          defaultCategoryId: config.defaultCategoryId,
          importDiscontinued: config.importDiscontinued,
          categoryFilter: config.categoryFilter,
          brandFilter: config.brandFilter,
          lastBulkSyncAt: config.lastBulkSyncAt,
          lastDeltaSyncAt: config.lastDeltaSyncAt,
          lastInventorySyncAt: config.lastInventorySyncAt,
          lastPricingSyncAt: config.lastPricingSyncAt,
          totalProductsSynced: config.totalProductsSynced,
          totalVariantsSynced: config.totalVariantsSynced,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new ApiException('Only super admins can configure SanMar', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const parsed = configSchema.safeParse(body);

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

    const result = await saveSanMarConfig(parsed.data);

    if (!result.success) {
      throw new ApiException(result.error || 'Failed to save config', 500, 'CONFIG_SAVE_FAILED');
    }

    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'UPDATE',
      'SanMarSyncConfig',
      '1',
      { action: 'credentials_updated' },
      clientIp
    );

    return NextResponse.json({
      ok: true,
      data: {
        success: true,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === 'EDITOR') {
      throw new ApiException('Unauthorized', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const parsed = syncSettingsSchema.safeParse(body);

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

    const result = await updateSanMarSyncSettings(parsed.data);

    if (!result.success) {
      throw new ApiException(result.error || 'Failed to update settings', 500, 'SETTINGS_UPDATE_FAILED');
    }

    const clientIp = getClientIp(request);
    await logAuditEvent(
      user.id,
      'UPDATE',
      'SanMarSyncConfig',
      '1',
      { action: 'sync_settings_updated', settings: parsed.data },
      clientIp
    );

    return NextResponse.json({
      ok: true,
      data: {
        success: true,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
