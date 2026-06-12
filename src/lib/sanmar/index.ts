/**
 * SanMar Integration Module
 *
 * Provides integration with SanMar Web Services API for:
 * - Product data synchronization
 * - Media/image retrieval
 * - Inventory tracking
 * - Pricing updates
 */

// Types
export * from './types';

// SOAP Client
export {
  SanMarStandardClient,
  PromoStandardsClient,
  createSanMarClient,
  testSanMarConnection,
} from './soap-client';

// Configuration
export {
  getSanMarConfig,
  getSanMarCredentials,
  saveSanMarConfig,
  updateSanMarSyncSettings,
  testSanMarConfigConnection,
  getSanMarClient,
  isSanMarEnabled,
  updateSyncTimestamp,
  updateSyncStats,
  getCategoryMappings,
  updateCategoryMapping,
  getLocalCategoryId,
} from './config';

// Supplier Mapper
export {
  getOrCreateSupplier,
  batchGetOrCreateSuppliers,
  getSupplierByBrand,
  getSanMarSuppliers,
  updateSupplierRestrictions,
  isRestrictedBrand,
  getMapRestriction,
  clearSupplierCache,
} from './supplier-mapper';

// Category Mapper
export {
  getCategoryMapping,
  ensureCategory,
  initializeCategoryMappings,
  getAllCategoryMappings,
  updateCategoryMapping as updateCategoryMappingEntry,
  enableAutoCreateForAll,
  getLocalCategories,
  bulkMapCategories,
  clearCategoryCache,
} from './category-mapper';

// Image Resolver
export {
  resolveImagesFromStandard,
  resolveImagesFromMediaContent,
  resolveImagesByColor,
  buildGalleryFromColors,
  selectBestHeroImage,
  constructImageUrl,
  isValidSanMarUrl,
  ensureHttps,
  validateImageUrls,
  type ResolvedImages,
  type ColorImages,
} from './image-resolver';

// Product Sync
export {
  syncProductFromStandard,
  syncProductFromPromoStandards,
  syncByCategory,
  syncByBrand,
  syncSingleProduct,
  getSyncHistory,
  getSyncStats,
} from './product-sync';
