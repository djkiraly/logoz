/**
 * SanMar Configuration Management
 * Handles credential storage, retrieval, and encryption
 */

import crypto from 'crypto';
import { prisma } from '../prisma';
import { adminLogger } from '../logger';
import { SanMarCredentials, SANMAR_CATEGORIES } from './types';
import { createSanMarClient, testSanMarConnection } from './soap-client';
import type { SanMarSyncConfig } from '@prisma/client';

// SanMar API credentials are stored encrypted at rest. We use AES-256-GCM
// (authenticated encryption) with a key derived from SANMAR_ENCRYPTION_KEY.
// Legacy records were stored with a reversible XOR cipher; decryptPassword
// transparently reads both formats so old credentials keep working until the
// next time they are saved (which re-encrypts with AES).
const RAW_ENCRYPTION_KEY = process.env.SANMAR_ENCRYPTION_KEY || '';
const DEFAULT_ENCRYPTION_KEY = 'default-key-change-in-production';
const AES_PREFIX = 'v2:'; // marks AES-256-GCM payloads: v2:<iv>:<tag>:<ciphertext> (all base64)

function isSecureKeyConfigured(): boolean {
  return RAW_ENCRYPTION_KEY.length > 0 && RAW_ENCRYPTION_KEY !== DEFAULT_ENCRYPTION_KEY;
}

// Derive a fixed 32-byte key from the configured secret (any length input).
function deriveKey(): Buffer {
  const secret = RAW_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptPassword(password: string): string {
  // Refuse to persist credentials under the insecure default key.
  if (!isSecureKeyConfigured()) {
    throw new Error(
      'SANMAR_ENCRYPTION_KEY is not set (or is the default). Set a strong, ' +
        'unique value before storing SanMar credentials.'
    );
  }

  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${AES_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptPassword(encrypted: string): string {
  if (encrypted.startsWith(AES_PREFIX)) {
    const [, ivB64, tagB64, dataB64] = encrypted.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      deriveKey(),
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf-8');
  }

  // Legacy XOR-encrypted payload (pre-AES). Decode with the raw key bytes.
  const encoded = Buffer.from(encrypted, 'base64');
  const key = Buffer.from(RAW_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY, 'utf-8');
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ key[i % key.length];
  }
  return result.toString('utf-8');
}

/**
 * Get SanMar sync configuration from database
 */
export async function getSanMarConfig(): Promise<SanMarSyncConfig | null> {
  try {
    const config = await prisma.sanMarSyncConfig.findFirst();
    return config;
  } catch (error) {
    adminLogger.error('Failed to get SanMar config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get SanMar credentials (decrypted)
 */
export async function getSanMarCredentials(): Promise<SanMarCredentials | null> {
  const config = await getSanMarConfig();

  if (!config?.customerNumber || !config?.username || !config?.passwordEncrypted) {
    return null;
  }

  try {
    return {
      customerNumber: config.customerNumber,
      username: config.username,
      password: decryptPassword(config.passwordEncrypted),
    };
  } catch (error) {
    adminLogger.error('Failed to decrypt SanMar credentials', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Save SanMar configuration
 * Password is optional for updates - if not provided, existing password is kept
 */
export async function saveSanMarConfig(data: {
  customerNumber: string;
  username: string;
  password?: string;
  syncEnabled?: boolean;
  autoSyncEnabled?: boolean;
  autoSyncSchedule?: string;
  defaultVisibility?: boolean;
  defaultCategoryId?: string;
  importDiscontinued?: boolean;
  categoryFilter?: string[];
  brandFilter?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if config already exists
    const existingConfig = await prisma.sanMarSyncConfig.findUnique({
      where: { id: 1 },
    });

    // For new configs, password is required
    if (!existingConfig && !data.password) {
      return { success: false, error: 'Password is required for initial setup' };
    }

    // Build the update object conditionally
    const updateData: Record<string, unknown> = {
      customerNumber: data.customerNumber,
      username: data.username,
      syncEnabled: data.syncEnabled,
      autoSyncEnabled: data.autoSyncEnabled,
      autoSyncSchedule: data.autoSyncSchedule,
      defaultVisibility: data.defaultVisibility,
      defaultCategoryId: data.defaultCategoryId,
      importDiscontinued: data.importDiscontinued,
      categoryFilter: data.categoryFilter,
      brandFilter: data.brandFilter,
    };

    // Only update password if provided
    if (data.password) {
      updateData.passwordEncrypted = encryptPassword(data.password);
    }

    await prisma.sanMarSyncConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        customerNumber: data.customerNumber,
        username: data.username,
        passwordEncrypted: data.password ? encryptPassword(data.password) : '',
        syncEnabled: data.syncEnabled ?? false,
        autoSyncEnabled: data.autoSyncEnabled ?? false,
        autoSyncSchedule: data.autoSyncSchedule,
        defaultVisibility: data.defaultVisibility ?? false,
        defaultCategoryId: data.defaultCategoryId,
        importDiscontinued: data.importDiscontinued ?? false,
        categoryFilter: data.categoryFilter ?? [],
        brandFilter: data.brandFilter ?? [],
      },
      update: updateData,
    });

    adminLogger.info('SanMar config saved', {
      customerNumber: data.customerNumber,
      username: data.username,
      passwordUpdated: !!data.password,
    });

    return { success: true };
  } catch (error) {
    adminLogger.error('Failed to save SanMar config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save configuration',
    };
  }
}

/**
 * Update sync settings only (without changing credentials)
 */
export async function updateSanMarSyncSettings(data: {
  syncEnabled?: boolean;
  autoSyncEnabled?: boolean;
  autoSyncSchedule?: string;
  defaultVisibility?: boolean;
  defaultCategoryId?: string;
  importDiscontinued?: boolean;
  categoryFilter?: string[];
  brandFilter?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.sanMarSyncConfig.update({
      where: { id: 1 },
      data: {
        syncEnabled: data.syncEnabled,
        autoSyncEnabled: data.autoSyncEnabled,
        autoSyncSchedule: data.autoSyncSchedule,
        defaultVisibility: data.defaultVisibility,
        defaultCategoryId: data.defaultCategoryId,
        importDiscontinued: data.importDiscontinued,
        categoryFilter: data.categoryFilter,
        brandFilter: data.brandFilter,
      },
    });

    return { success: true };
  } catch (error) {
    adminLogger.error('Failed to update SanMar sync settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    };
  }
}

/**
 * Test SanMar API connection with current config
 */
export async function testSanMarConfigConnection(): Promise<{ success: boolean; error?: string }> {
  const credentials = await getSanMarCredentials();

  if (!credentials) {
    return { success: false, error: 'No credentials configured' };
  }

  const config = await getSanMarConfig();
  const environment = process.env.SANMAR_ENVIRONMENT === 'test' ? 'test' : 'production';

  return testSanMarConnection(credentials, environment);
}

/**
 * Get configured SanMar client
 */
export async function getSanMarClient() {
  const credentials = await getSanMarCredentials();

  if (!credentials) {
    return null;
  }

  const environment = process.env.SANMAR_ENVIRONMENT === 'test' ? 'test' : 'production';
  return createSanMarClient(credentials, environment);
}

/**
 * Check if SanMar integration is enabled and configured
 */
export async function isSanMarEnabled(): Promise<boolean> {
  const config = await getSanMarConfig();
  return !!(config?.syncEnabled && config?.customerNumber && config?.username && config?.passwordEncrypted);
}

/**
 * Update sync timestamps after successful sync
 */
export async function updateSyncTimestamp(
  syncType: 'bulk' | 'delta' | 'inventory' | 'pricing'
): Promise<void> {
  const fieldMap = {
    bulk: 'lastBulkSyncAt',
    delta: 'lastDeltaSyncAt',
    inventory: 'lastInventorySyncAt',
    pricing: 'lastPricingSyncAt',
  } as const;

  try {
    await prisma.sanMarSyncConfig.update({
      where: { id: 1 },
      data: {
        [fieldMap[syncType]]: new Date(),
      },
    });
  } catch (error) {
    adminLogger.error('Failed to update sync timestamp', {
      syncType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Update sync statistics
 */
export async function updateSyncStats(
  productsCount: number,
  variantsCount: number
): Promise<void> {
  try {
    await prisma.sanMarSyncConfig.update({
      where: { id: 1 },
      data: {
        totalProductsSynced: productsCount,
        totalVariantsSynced: variantsCount,
      },
    });
  } catch (error) {
    adminLogger.error('Failed to update sync stats', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Initialize category mappings with SanMar default categories
 */
export async function initializeCategoryMappings(): Promise<void> {
  try {
    for (const category of SANMAR_CATEGORIES) {
      await prisma.sanMarCategoryMapping.upsert({
        where: { sanmarCategory: category },
        create: {
          sanmarCategory: category,
          localCategoryId: null, // Admin needs to map these
          autoCreate: false,
        },
        update: {}, // Don't update existing mappings
      });
    }

    adminLogger.info('SanMar category mappings initialized', {
      categories: SANMAR_CATEGORIES.length,
    });
  } catch (error) {
    adminLogger.error('Failed to initialize category mappings', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get category mappings
 */
export async function getCategoryMappings(): Promise<
  { sanmarCategory: string; localCategoryId: string | null; autoCreate: boolean }[]
> {
  try {
    const mappings = await prisma.sanMarCategoryMapping.findMany({
      orderBy: { sanmarCategory: 'asc' },
    });
    return mappings;
  } catch (error) {
    adminLogger.error('Failed to get category mappings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Update a category mapping
 */
export async function updateCategoryMapping(
  sanmarCategory: string,
  localCategoryId: string | null,
  autoCreate: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.sanMarCategoryMapping.upsert({
      where: { sanmarCategory },
      create: {
        sanmarCategory,
        localCategoryId,
        autoCreate,
      },
      update: {
        localCategoryId,
        autoCreate,
      },
    });
    return { success: true };
  } catch (error) {
    adminLogger.error('Failed to update category mapping', {
      sanmarCategory,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update mapping',
    };
  }
}

/**
 * Get the local category ID for a SanMar category
 */
export async function getLocalCategoryId(sanmarCategory: string): Promise<string | null> {
  try {
    const mapping = await prisma.sanMarCategoryMapping.findUnique({
      where: { sanmarCategory },
    });

    if (!mapping) return null;

    // If autoCreate is enabled and no local category exists, create one
    if (mapping.autoCreate && !mapping.localCategoryId) {
      const slug = sanmarCategory
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const category = await prisma.category.create({
        data: {
          slug,
          title: sanmarCategory,
          description: `Products from SanMar ${sanmarCategory} category`,
        },
      });

      // Update the mapping with the new category ID
      await prisma.sanMarCategoryMapping.update({
        where: { sanmarCategory },
        data: { localCategoryId: category.id },
      });

      return category.id;
    }

    return mapping.localCategoryId;
  } catch (error) {
    adminLogger.error('Failed to get local category ID', {
      sanmarCategory,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
