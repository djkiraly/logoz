/**
 * SanMar Product Sync Service
 * Main orchestration for synchronizing products from SanMar API
 */

import { prisma } from '../prisma';
import { adminLogger } from '../logger';
import { Prisma, SanMarSyncType, SanMarSyncStatus, ImageSource, ProductStatus } from '@prisma/client';
import { getSanMarClient, getSanMarConfig, updateSyncTimestamp, updateSyncStats } from './config';
import { getOrCreateSupplier, clearSupplierCache } from './supplier-mapper';
import { getCategoryMapping, clearCategoryCache } from './category-mapper';
import { resolveImagesFromStandard, resolveImagesFromMediaContent } from './image-resolver';
import {
  SanMarProductInfo,
  SanMarSyncOptions,
  SyncProgress,
  PromoStandardsProduct,
  MediaContent,
} from './types';

/**
 * Start a sync log entry
 */
async function startSyncLog(
  syncType: SanMarSyncType,
  triggeredBy: string,
  options?: SanMarSyncOptions
): Promise<string> {
  const log = await prisma.sanMarSyncLog.create({
    data: {
      syncType,
      status: SanMarSyncStatus.RUNNING,
      triggeredBy,
      options: options ? JSON.parse(JSON.stringify(options)) : Prisma.JsonNull,
      startedAt: new Date(),
    },
  });
  return log.id;
}

/**
 * Update sync log progress
 */
async function updateSyncLog(
  logId: string,
  progress: Partial<SyncProgress>,
  status?: SanMarSyncStatus
): Promise<void> {
  await prisma.sanMarSyncLog.update({
    where: { id: logId },
    data: {
      status,
      totalItems: progress.totalItems,
      processedItems: progress.processedItems,
      productsAdded: progress.productsAdded,
      productsUpdated: progress.productsUpdated,
      productsSkipped: progress.productsSkipped,
      variantsAdded: progress.variantsAdded,
      variantsUpdated: progress.variantsUpdated,
      suppliersAdded: progress.suppliersAdded,
      errorCount: progress.errors?.length ?? 0,
      errors: progress.errors ? JSON.parse(JSON.stringify(progress.errors)) : Prisma.JsonNull,
      completedAt: status === SanMarSyncStatus.COMPLETED || status === SanMarSyncStatus.FAILED
        ? new Date()
        : undefined,
    },
  });
}

/**
 * Map SanMar product status to local enum
 */
function mapProductStatus(status: string): ProductStatus {
  switch (status?.toLowerCase()) {
    case 'discontinued':
      return ProductStatus.DISCONTINUED;
    case 'new':
      return ProductStatus.NEW;
    case 'coming soon':
      return ProductStatus.COMING_SOON;
    default:
      return ProductStatus.ACTIVE;
  }
}

/**
 * Parse keywords string into array
 */
function parseKeywords(keywordsString: string): string[] {
  if (!keywordsString) return [];
  return keywordsString
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Apply an optional percentage markup to a price (no-op when markup is 0/undefined). */
function applyMarkup(value: number | string, markupPercent?: number): number {
  const base = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
  if (!markupPercent) return base;
  return Math.round(base * (1 + markupPercent / 100) * 100) / 100;
}

/** Delay between API batches to stay within SanMar rate limits. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const BATCH_DELAY_MS = 250;

/**
 * Sync a single product from SanMar Standard API data
 */
export async function syncProductFromStandard(
  productInfo: SanMarProductInfo,
  options: SanMarSyncOptions = {}
): Promise<{ success: boolean; productId?: string; variantCount?: number; error?: string; created: boolean }> {
  const { productBasicInfo, productImageInfo, productPriceInfo } = productInfo;

  try {
    // Skip discontinued if not importing them
    if (productBasicInfo.productStatus === 'Discontinued' && !options.includeDiscontinued) {
      return { success: true, created: false, productId: undefined };
    }

    // Get or create supplier
    const supplierResult = await getOrCreateSupplier(
      productBasicInfo.brandName,
      productImageInfo.brandLogoImage
    );

    // Get category mapping
    const categoryResult = await getCategoryMapping(productBasicInfo.category);

    // Use default category if no mapping and default is set
    const categoryId = categoryResult.categoryId || options.defaultCategoryId;

    if (!categoryId) {
      // Skip product if no category mapping
      return { success: true, created: false, error: 'No category mapping' };
    }

    // Resolve images
    const images = resolveImagesFromStandard(productImageInfo);

    // Check if product already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sanmarStyleId: productBasicInfo.style },
      select: { id: true },
    });

    const productData: Prisma.ProductCreateInput | Prisma.ProductUpdateInput = {
      sku: productBasicInfo.style,
      name: productBasicInfo.productTitle,
      description: productBasicInfo.productDescription,
      heroImageUrl: images.heroImage,
      gallery: images.gallery,
      basePrice: applyMarkup(productPriceInfo.piecePrice, options.markupPercent),
      cost: productPriceInfo.casePrice,
      minQuantity: 1,
      category: { connect: { id: categoryId } },
      supplier: { connect: { id: supplierResult.supplierId } },
      visible: options.defaultVisibility ?? false,
      featured: false,
      // SanMar fields
      sanmarStyleId: productBasicInfo.style,
      sanmarInventoryKey: productBasicInfo.inventoryKey,
      sanmarBrand: productBasicInfo.brandName,
      sanmarCategory: productBasicInfo.category,
      imageSource: ImageSource.REMOTE,
      keywords: parseKeywords(productBasicInfo.keywords),
      priceCode: productBasicInfo.priceCode,
      productStatus: mapProductStatus(productBasicInfo.productStatus),
      syncSource: 'sanmar',
      lastSyncedAt: new Date(),
    };

    // Dry run: report what WOULD happen without writing anything.
    if (options.dryRun) {
      return {
        success: true,
        created: !existingProduct,
        productId: existingProduct?.id,
        variantCount: 1,
      };
    }

    // Respect updateExisting=false: leave existing products untouched (skip).
    if (existingProduct && options.updateExisting === false) {
      return { success: true, created: false, variantCount: 0 };
    }

    let product;
    let created = false;

    if (existingProduct) {
      // Update existing product
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: productData as Prisma.ProductUpdateInput,
      });
    } else {
      // Create new product; if a concurrent batch item created the same style
      // first (unique sanmarStyleId), fall back to updating that row.
      try {
        product = await prisma.product.create({
          data: productData as Prisma.ProductCreateInput,
        });
        created = true;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          product = await prisma.product.update({
            where: { sanmarStyleId: productBasicInfo.style },
            data: productData as Prisma.ProductUpdateInput,
          });
        } else {
          throw err;
        }
      }
    }

    // Sync variant for this specific color/size
    const variantResult = await syncVariantFromStandard(product.id, productInfo, options.markupPercent);

    return {
      success: true,
      productId: product.id,
      variantCount: variantResult.count,
      created,
    };
  } catch (error) {
    adminLogger.error('Failed to sync product', {
      style: productBasicInfo.style,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      created: false,
    };
  }
}

/**
 * Sync variant from SanMar Standard API data
 */
async function syncVariantFromStandard(
  productId: string,
  productInfo: SanMarProductInfo,
  markupPercent?: number
): Promise<{ success: boolean; count: number }> {
  const { productBasicInfo, productPriceInfo } = productInfo;

  try {
    const variantData = {
      color: productBasicInfo.color,
      size: productBasicInfo.size,
      sanmarUniqueKey: productBasicInfo.uniqueKey,
      sanmarCatalogColor: productBasicInfo.catalogColor,
      piecePrice: new Prisma.Decimal(applyMarkup(productPriceInfo.piecePrice, markupPercent)),
      casePrice: new Prisma.Decimal(productPriceInfo.casePrice),
      salePrice: productPriceInfo.pieceSalePrice
        ? new Prisma.Decimal(applyMarkup(productPriceInfo.pieceSalePrice, markupPercent))
        : null,
      caseSize: productBasicInfo.caseSize,
      pieceWeight: new Prisma.Decimal(productBasicInfo.pieceWeight),
    };

    await prisma.variant.upsert({
      where: {
        productId_color_size: {
          productId,
          color: productBasicInfo.color,
          size: productBasicInfo.size,
        },
      },
      create: {
        productId,
        ...variantData,
      },
      update: variantData,
    });

    return { success: true, count: 1 };
  } catch (error) {
    adminLogger.error('Failed to sync variant', {
      productId,
      uniqueKey: productBasicInfo.uniqueKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return { success: false, count: 0 };
  }
}

/**
 * Sync product from PromoStandards API data
 */
export async function syncProductFromPromoStandards(
  product: PromoStandardsProduct,
  mediaContent: MediaContent[] | null,
  options: SanMarSyncOptions = {}
): Promise<{ success: boolean; productId?: string; variantCount?: number; error?: string; created: boolean }> {
  try {
    // Skip closeout/discontinued if not importing them
    if (product.isCloseout && !options.includeDiscontinued) {
      return { success: true, created: false };
    }

    // Get brand name
    const brandName = product.productBrand || 'Unknown Brand';

    // Get or create supplier
    const supplierResult = await getOrCreateSupplier(brandName);

    // Get category from product data
    const sanmarCategory = product.productCategoryArray?.[0]?.category || 'T-Shirts';
    const categoryResult = await getCategoryMapping(sanmarCategory);

    const categoryId = categoryResult.categoryId || options.defaultCategoryId;

    if (!categoryId) {
      return { success: true, created: false, error: 'No category mapping' };
    }

    // Resolve images
    const images = mediaContent
      ? resolveImagesFromMediaContent(mediaContent)
      : {
          heroImage: product.primaryImageUrl || null,
          gallery: [] as string[],
          colorSwatch: null,
          brandLogo: null,
          specSheet: null,
        };

    // Build description from array
    const description = product.description.join('\n');

    // Build keywords
    const keywords = product.productKeywordArray?.map((k) => k.keyword) || [];

    // Get MSRP price if available
    const msrpGroup = product.productPriceGroupArray?.find((g) => g.groupName === 'MSRP');
    const basePrice = applyMarkup(msrpGroup?.productPriceArray?.[0]?.price || 0, options.markupPercent);

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { sanmarStyleId: product.productId },
      select: { id: true },
    });

    // Dry run: report without writing.
    if (options.dryRun) {
      return { success: true, created: !existingProduct, productId: existingProduct?.id, variantCount: 0 };
    }

    // Respect updateExisting=false.
    if (existingProduct && options.updateExisting === false) {
      return { success: true, created: false };
    }

    const productData = {
      sku: product.productId,
      name: product.productName,
      description,
      heroImageUrl: images.heroImage,
      gallery: images.gallery,
      basePrice,
      minQuantity: 1,
      visible: options.defaultVisibility ?? false,
      featured: false,
      // SanMar fields
      sanmarStyleId: product.productId,
      sanmarBrand: brandName,
      sanmarCategory,
      imageSource: ImageSource.REMOTE,
      keywords,
      productStatus: product.isCloseout ? ProductStatus.DISCONTINUED : ProductStatus.ACTIVE,
      syncSource: 'sanmar-promostandards',
      lastSyncedAt: new Date(),
    };

    let dbProduct;
    let created = false;

    if (existingProduct) {
      dbProduct = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          ...productData,
          category: { connect: { id: categoryId } },
          supplier: { connect: { id: supplierResult.supplierId } },
        },
      });
    } else {
      dbProduct = await prisma.product.create({
        data: {
          ...productData,
          category: { connect: { id: categoryId } },
          supplier: { connect: { id: supplierResult.supplierId } },
        },
      });
      created = true;
    }

    // Sync variants from product parts
    let variantCount = 0;
    for (const part of product.productPartArray) {
      const variantResult = await syncVariantFromPromoStandards(dbProduct.id, part);
      if (variantResult.success) variantCount++;
    }

    return {
      success: true,
      productId: dbProduct.id,
      variantCount,
      created,
    };
  } catch (error) {
    adminLogger.error('Failed to sync PromoStandards product', {
      productId: product.productId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      created: false,
    };
  }
}

/**
 * Sync variant from PromoStandards product part
 */
async function syncVariantFromPromoStandards(
  productId: string,
  part: PromoStandardsProduct['productPartArray'][0]
): Promise<{ success: boolean }> {
  try {
    const color = part.primaryColor.standardColorName || part.primaryColor.colorName || 'Default';
    const size = part.apparelSize.labelSize || 'OSFA';

    const variantData = {
      sanmarPartId: part.partId,
      sanmarCatalogColor: part.primaryColor.colorName,
      gtin: part.gtin,
      pieceWeight: part.dimension.weight
        ? new Prisma.Decimal(part.dimension.weight / 16) // Convert oz to lbs
        : null,
    };

    await prisma.variant.upsert({
      where: {
        productId_color_size: {
          productId,
          color,
          size,
        },
      },
      create: {
        productId,
        color,
        size,
        ...variantData,
      },
      update: variantData,
    });

    return { success: true };
  } catch (error) {
    adminLogger.error('Failed to sync PromoStandards variant', {
      productId,
      partId: part.partId,
      error: error instanceof Error ? error.message : String(error),
    });

    return { success: false };
  }
}

/**
 * Sync products by category using Standard API
 */
export async function syncByCategory(
  category: string,
  options: SanMarSyncOptions = {},
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncProgress> {
  const progress: SyncProgress = {
    totalItems: 0,
    processedItems: 0,
    productsAdded: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    variantsAdded: 0,
    variantsUpdated: 0,
    suppliersAdded: 0,
    errors: [],
  };

  const logId = await startSyncLog(SanMarSyncType.BULK, 'manual', options);

  try {
    // Clear caches
    clearSupplierCache();
    clearCategoryCache();

    const client = await getSanMarClient();
    if (!client) {
      throw new Error('SanMar client not configured');
    }

    adminLogger.info('Starting category sync', { category });

    const result = await client.standard.getProductInfoByCategory(category);

    if (result.errorOccured) {
      throw new Error(result.message);
    }

    if (!result.listResponse) {
      adminLogger.info('No products found for category', { category });
      await updateSyncLog(logId, progress, SanMarSyncStatus.COMPLETED);
      return progress;
    }

    progress.totalItems = result.listResponse.length;
    await updateSyncLog(logId, progress);

    // Process products in batches
    const batchSize = 10;
    for (let i = 0; i < result.listResponse.length; i += batchSize) {
      const batch = result.listResponse.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (productInfo) => {
          const syncResult = await syncProductFromStandard(productInfo, options);

          progress.processedItems++;

          if (syncResult.success) {
            if (syncResult.productId) {
              if (syncResult.created) {
                progress.productsAdded++;
              } else {
                progress.productsUpdated++;
              }
              progress.variantsAdded += syncResult.variantCount || 0;
            } else {
              progress.productsSkipped++;
            }
          } else {
            progress.errors.push({
              message: syncResult.error || 'Unknown error',
            });
          }
        })
      );

      // Report progress
      await updateSyncLog(logId, progress);
      onProgress?.(progress);

      // Throttle between batches to respect SanMar rate limits.
      if (i + batchSize < result.listResponse.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    await updateSyncLog(logId, progress, SanMarSyncStatus.COMPLETED);
    await updateSyncTimestamp('bulk');

    adminLogger.info('Category sync completed', {
      category,
      added: progress.productsAdded,
      updated: progress.productsUpdated,
      skipped: progress.productsSkipped,
      errors: progress.errors.length,
    });

    return progress;
  } catch (error) {
    progress.errors.push({
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    await updateSyncLog(logId, progress, SanMarSyncStatus.FAILED);

    adminLogger.error('Category sync failed', {
      category,
      error: error instanceof Error ? error.message : String(error),
    });

    return progress;
  }
}

/**
 * Sync products by brand using Standard API
 */
export async function syncByBrand(
  brandName: string,
  options: SanMarSyncOptions = {},
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncProgress> {
  const progress: SyncProgress = {
    totalItems: 0,
    processedItems: 0,
    productsAdded: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    variantsAdded: 0,
    variantsUpdated: 0,
    suppliersAdded: 0,
    errors: [],
  };

  const logId = await startSyncLog(SanMarSyncType.BULK, 'manual', options);

  try {
    clearSupplierCache();
    clearCategoryCache();

    const client = await getSanMarClient();
    if (!client) {
      throw new Error('SanMar client not configured');
    }

    adminLogger.info('Starting brand sync', { brandName });

    const result = await client.standard.getProductInfoByBrand(brandName);

    if (result.errorOccured) {
      throw new Error(result.message);
    }

    if (!result.listResponse) {
      adminLogger.info('No products found for brand', { brandName });
      await updateSyncLog(logId, progress, SanMarSyncStatus.COMPLETED);
      return progress;
    }

    progress.totalItems = result.listResponse.length;

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < result.listResponse.length; i += batchSize) {
      const batch = result.listResponse.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (productInfo) => {
          const syncResult = await syncProductFromStandard(productInfo, options);

          progress.processedItems++;

          if (syncResult.success && syncResult.productId) {
            if (syncResult.created) {
              progress.productsAdded++;
            } else {
              progress.productsUpdated++;
            }
            progress.variantsAdded += syncResult.variantCount || 0;
          } else if (!syncResult.success) {
            progress.errors.push({ message: syncResult.error || 'Unknown error' });
          } else {
            progress.productsSkipped++;
          }
        })
      );

      await updateSyncLog(logId, progress);
      onProgress?.(progress);

      // Throttle between batches to respect SanMar rate limits.
      if (i + batchSize < result.listResponse.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    await updateSyncLog(logId, progress, SanMarSyncStatus.COMPLETED);
    await updateSyncTimestamp('bulk');

    adminLogger.info('Brand sync completed', {
      brandName,
      added: progress.productsAdded,
      updated: progress.productsUpdated,
      errors: progress.errors.length,
    });

    return progress;
  } catch (error) {
    progress.errors.push({
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    await updateSyncLog(logId, progress, SanMarSyncStatus.FAILED);

    adminLogger.error('Brand sync failed', {
      brandName,
      error: error instanceof Error ? error.message : String(error),
    });

    return progress;
  }
}

/**
 * Sync a single product by style number
 */
export async function syncSingleProduct(
  styleId: string,
  options: SanMarSyncOptions = {}
): Promise<{ success: boolean; productId?: string; error?: string }> {
  try {
    clearSupplierCache();
    clearCategoryCache();

    const client = await getSanMarClient();
    if (!client) {
      return { success: false, error: 'SanMar client not configured' };
    }

    // Get product info
    const result = await client.standard.getProductInfoByStyleColorSize(styleId);

    if (result.errorOccured || !result.listResponse?.length) {
      return { success: false, error: result.message || 'Product not found' };
    }

    // Get media content for images
    const mediaResult = await client.promostandards.getMediaContent(styleId, 'Image');

    // Sync each variant
    let productId: string | undefined;

    for (const productInfo of result.listResponse) {
      const syncResult = await syncProductFromStandard(productInfo, options);
      if (syncResult.productId) {
        productId = syncResult.productId;
      }
    }

    return { success: true, productId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get sync status/history
 */
export async function getSyncHistory(
  limit: number = 20
): Promise<{
  id: string;
  syncType: SanMarSyncType;
  status: SanMarSyncStatus;
  productsAdded: number;
  productsUpdated: number;
  errorCount: number;
  startedAt: Date;
  completedAt: Date | null;
}[]> {
  return prisma.sanMarSyncLog.findMany({
    take: limit,
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      syncType: true,
      status: true,
      productsAdded: true,
      productsUpdated: true,
      errorCount: true,
      startedAt: true,
      completedAt: true,
    },
  });
}

/**
 * Get current sync stats
 */
export async function getSyncStats(): Promise<{
  totalProducts: number;
  totalVariants: number;
  lastSync: Date | null;
  supplierCount: number;
}> {
  const [productCount, variantCount, supplierCount, config] = await Promise.all([
    prisma.product.count({ where: { syncSource: 'sanmar' } }),
    prisma.variant.count({ where: { sanmarUniqueKey: { not: null } } }),
    prisma.supplier.count({ where: { isSanmarBrand: true } }),
    getSanMarConfig(),
  ]);

  const lastSync = config?.lastBulkSyncAt || config?.lastDeltaSyncAt || null;

  return {
    totalProducts: productCount,
    totalVariants: variantCount,
    lastSync,
    supplierCount,
  };
}
