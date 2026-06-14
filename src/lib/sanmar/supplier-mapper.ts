/**
 * SanMar Supplier/Brand Mapper
 * Maps SanMar brand names to local Supplier records
 */

import { prisma } from '../prisma';
import { adminLogger } from '../logger';
import { RESTRICTED_BRANDS, MAP_RESTRICTED_BRANDS } from './types';

export interface SupplierMappingResult {
  supplierId: string;
  created: boolean;
  brandName: string;
}

// Cache for supplier mappings to reduce DB queries during sync
const supplierCache = new Map<string, string>();
// Brands whose Supplier already has a brand logo, so we skip redundant backfill
// writes once we've confirmed (or set) one during this run.
const suppliersWithLogo = new Set<string>();

/**
 * Clear the supplier cache (call when starting a new sync)
 */
export function clearSupplierCache(): void {
  supplierCache.clear();
  suppliersWithLogo.clear();
}

/**
 * Check if a brand has embellishment requirements
 */
export function isRestrictedBrand(brandName: string): boolean {
  return RESTRICTED_BRANDS.some(
    (brand) => brand.toLowerCase() === brandName.toLowerCase()
  );
}

/**
 * Get MAP restriction level for a brand
 */
export function getMapRestriction(brandName: string): '10_PERCENT' | '20_PERCENT' | 'MSRP' | 'NO_MAP' | null {
  const normalizedBrand = brandName.toLowerCase();

  for (const [level, brands] of Object.entries(MAP_RESTRICTED_BRANDS)) {
    if (brands.some((b) => b.toLowerCase() === normalizedBrand)) {
      return level as '10_PERCENT' | '20_PERCENT' | 'MSRP' | 'NO_MAP';
    }
  }

  return null;
}

/**
 * Normalize brand name for consistent matching
 */
function normalizeBrandName(brandName: string): string {
  return brandName
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/**
 * Get or create a Supplier record for a SanMar brand
 */
export async function getOrCreateSupplier(
  brandName: string,
  brandLogoUrl?: string
): Promise<SupplierMappingResult> {
  const normalizedBrand = normalizeBrandName(brandName);

  // Check cache first
  const cachedId = supplierCache.get(normalizedBrand);
  if (cachedId) {
    // The first row for a brand may not carry its logo; a later row might.
    // Backfill it (only where still missing) so the logo isn't lost to caching.
    if (brandLogoUrl && !suppliersWithLogo.has(normalizedBrand)) {
      await prisma.supplier.updateMany({
        where: { id: cachedId, sanmarBrandLogoUrl: null },
        data: { sanmarBrandLogoUrl: brandLogoUrl },
      });
      suppliersWithLogo.add(normalizedBrand);
    }
    return { supplierId: cachedId, created: false, brandName: normalizedBrand };
  }

  try {
    // Check if supplier exists by SanMar brand name
    let supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { sanmarBrandName: normalizedBrand },
          { name: normalizedBrand },
        ],
      },
    });

    if (supplier) {
      // Update SanMar fields if not set
      if (!supplier.sanmarBrandName || !supplier.isSanmarBrand) {
        supplier = await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            sanmarBrandName: normalizedBrand,
            isSanmarBrand: true,
            sanmarBrandLogoUrl: brandLogoUrl || supplier.sanmarBrandLogoUrl,
            mapRestricted: getMapRestriction(normalizedBrand) !== 'NO_MAP' && getMapRestriction(normalizedBrand) !== null,
            embellishRequired: isRestrictedBrand(normalizedBrand),
          },
        });
      }

      // Backfill the brand logo even for an already-mapped supplier — the gate
      // above is skipped on re-import, so without this an existing supplier that
      // first came in logo-less would never get one.
      if (brandLogoUrl && !supplier.sanmarBrandLogoUrl) {
        supplier = await prisma.supplier.update({
          where: { id: supplier.id },
          data: { sanmarBrandLogoUrl: brandLogoUrl },
        });
      }

      supplierCache.set(normalizedBrand, supplier.id);
      if (supplier.sanmarBrandLogoUrl) suppliersWithLogo.add(normalizedBrand);
      return { supplierId: supplier.id, created: false, brandName: normalizedBrand };
    }

    // Create new supplier
    supplier = await prisma.supplier.create({
      data: {
        name: normalizedBrand,
        sanmarBrandName: normalizedBrand,
        sanmarBrandLogoUrl: brandLogoUrl,
        isSanmarBrand: true,
        mapRestricted: getMapRestriction(normalizedBrand) !== 'NO_MAP' && getMapRestriction(normalizedBrand) !== null,
        embellishRequired: isRestrictedBrand(normalizedBrand),
        featured: false,
      },
    });

    supplierCache.set(normalizedBrand, supplier.id);
    if (supplier.sanmarBrandLogoUrl) suppliersWithLogo.add(normalizedBrand);

    adminLogger.info('Created SanMar supplier', {
      supplierId: supplier.id,
      brandName: normalizedBrand,
    });

    return { supplierId: supplier.id, created: true, brandName: normalizedBrand };
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      const existing = await prisma.supplier.findFirst({
        where: { sanmarBrandName: normalizedBrand },
      });

      if (existing) {
        supplierCache.set(normalizedBrand, existing.id);
        return { supplierId: existing.id, created: false, brandName: normalizedBrand };
      }
    }

    adminLogger.error('Failed to get/create supplier', {
      brandName: normalizedBrand,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Batch get or create suppliers for multiple brands
 */
export async function batchGetOrCreateSuppliers(
  brands: { brandName: string; brandLogoUrl?: string }[]
): Promise<Map<string, SupplierMappingResult>> {
  const results = new Map<string, SupplierMappingResult>();
  const uniqueBrands = new Map<string, { brandName: string; brandLogoUrl?: string }>();

  // Deduplicate brands
  for (const brand of brands) {
    const normalized = normalizeBrandName(brand.brandName);
    if (!uniqueBrands.has(normalized)) {
      uniqueBrands.set(normalized, { brandName: normalized, brandLogoUrl: brand.brandLogoUrl });
    }
  }

  // Process in batches of 10
  const brandArray = Array.from(uniqueBrands.values());
  const batchSize = 10;

  for (let i = 0; i < brandArray.length; i += batchSize) {
    const batch = brandArray.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (brand) => {
        const result = await getOrCreateSupplier(brand.brandName, brand.brandLogoUrl);
        results.set(brand.brandName, result);
      })
    );
  }

  return results;
}

/**
 * Get supplier ID by SanMar brand name
 */
export async function getSupplierByBrand(brandName: string): Promise<string | null> {
  const normalizedBrand = normalizeBrandName(brandName);

  // Check cache first
  const cachedId = supplierCache.get(normalizedBrand);
  if (cachedId) {
    return cachedId;
  }

  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { sanmarBrandName: normalizedBrand },
        { name: normalizedBrand },
      ],
    },
    select: { id: true },
  });

  if (supplier) {
    supplierCache.set(normalizedBrand, supplier.id);
    return supplier.id;
  }

  return null;
}

/**
 * Get all SanMar suppliers
 */
export async function getSanMarSuppliers(): Promise<
  { id: string; name: string; sanmarBrandName: string | null; mapRestricted: boolean; embellishRequired: boolean }[]
> {
  return prisma.supplier.findMany({
    where: { isSanmarBrand: true },
    select: {
      id: true,
      name: true,
      sanmarBrandName: true,
      mapRestricted: true,
      embellishRequired: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Update supplier restrictions based on current restriction lists
 */
export async function updateSupplierRestrictions(): Promise<{ updated: number }> {
  const suppliers = await prisma.supplier.findMany({
    where: { isSanmarBrand: true },
  });

  let updated = 0;

  for (const supplier of suppliers) {
    const brandName = supplier.sanmarBrandName || supplier.name;
    const mapRestricted = getMapRestriction(brandName) !== 'NO_MAP' && getMapRestriction(brandName) !== null;
    const embellishRequired = isRestrictedBrand(brandName);

    if (supplier.mapRestricted !== mapRestricted || supplier.embellishRequired !== embellishRequired) {
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { mapRestricted, embellishRequired },
      });
      updated++;
    }
  }

  return { updated };
}
