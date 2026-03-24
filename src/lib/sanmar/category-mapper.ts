/**
 * SanMar Category Mapper
 * Maps SanMar categories to local Category records
 */

import { prisma } from '../prisma';
import { adminLogger } from '../logger';
import { SANMAR_CATEGORIES, SanMarCategory } from './types';

export interface CategoryMappingResult {
  categoryId: string | null;
  sanmarCategory: string;
  localCategoryName?: string;
  skipped: boolean;
}

// Cache for category mappings to reduce DB queries during sync
const categoryCache = new Map<string, string | null>();

/**
 * Clear the category cache (call when starting a new sync)
 */
export function clearCategoryCache(): void {
  categoryCache.clear();
}

/**
 * Normalize category name for consistent matching
 */
function normalizeCategoryName(category: string): string {
  return category.trim().replace(/&amp;/g, '&');
}

/**
 * Generate a URL-safe slug from a category name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Default category descriptions for auto-created categories
 */
const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  'Activewear': 'Athletic and performance apparel for sports and fitness activities.',
  'Accessories': 'Complementary items including scarves, gloves, and other accessories.',
  'Bags': 'Totes, backpacks, duffel bags, and other carrying solutions.',
  'Bottoms': 'Pants, shorts, and skirts for all occasions.',
  'Caps': 'Baseball caps, beanies, visors, and other headwear.',
  'Infant & Toddler': 'Apparel designed for babies and young children.',
  'Juniors & Young Men': 'Trendy styles for teens and young adults.',
  'Outerwear': 'Jackets, coats, vests, and layering pieces.',
  'Personal Protection': 'Safety and protective equipment and apparel.',
  'Polos/Knits': 'Classic polo shirts and knit tops for business casual wear.',
  'Sweatshirts/Fleece': 'Comfortable sweatshirts, hoodies, and fleece apparel.',
  'T-Shirts': 'Essential tees in various styles and fits.',
  'Tall': 'Extended length apparel for taller individuals.',
  'Women\'s': 'Apparel designed specifically for women.',
  'Workwear': 'Durable clothing for industrial and trade professionals.',
  'Woven Shirts': 'Button-down shirts and dress shirts.',
  'Youth': 'Apparel sized for children and young people.',
};

/**
 * Get mapping for a SanMar category
 */
export async function getCategoryMapping(sanmarCategory: string): Promise<CategoryMappingResult> {
  const normalized = normalizeCategoryName(sanmarCategory);

  // Check cache first
  if (categoryCache.has(normalized)) {
    const cachedId = categoryCache.get(normalized);
    return {
      categoryId: cachedId ?? null,
      sanmarCategory: normalized,
      skipped: cachedId === null,
    };
  }

  try {
    // Look up the mapping
    const mapping = await prisma.sanMarCategoryMapping.findUnique({
      where: { sanmarCategory: normalized },
    });

    if (!mapping) {
      // No mapping exists - cache as null (skip)
      categoryCache.set(normalized, null);
      return {
        categoryId: null,
        sanmarCategory: normalized,
        skipped: true,
      };
    }

    if (mapping.localCategoryId) {
      // Has explicit mapping
      categoryCache.set(normalized, mapping.localCategoryId);

      const category = await prisma.category.findUnique({
        where: { id: mapping.localCategoryId },
        select: { title: true },
      });

      return {
        categoryId: mapping.localCategoryId,
        sanmarCategory: normalized,
        localCategoryName: category?.title,
        skipped: false,
      };
    }

    if (mapping.autoCreate) {
      // Auto-create the category
      const categoryId = await autoCreateCategory(normalized);
      if (categoryId) {
        categoryCache.set(normalized, categoryId);
        return {
          categoryId,
          sanmarCategory: normalized,
          localCategoryName: normalized,
          skipped: false,
        };
      }
    }

    // No mapping and no auto-create
    categoryCache.set(normalized, null);
    return {
      categoryId: null,
      sanmarCategory: normalized,
      skipped: true,
    };
  } catch (error) {
    adminLogger.error('Failed to get category mapping', {
      sanmarCategory: normalized,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      categoryId: null,
      sanmarCategory: normalized,
      skipped: true,
    };
  }
}

/**
 * Auto-create a local category from SanMar category
 */
async function autoCreateCategory(sanmarCategory: string): Promise<string | null> {
  const slug = generateSlug(sanmarCategory);

  try {
    // Check if category with this slug already exists
    const existing = await prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      // Update the mapping to point to existing category
      await prisma.sanMarCategoryMapping.update({
        where: { sanmarCategory },
        data: { localCategoryId: existing.id },
      });
      return existing.id;
    }

    // Create new category
    const category = await prisma.category.create({
      data: {
        slug,
        title: sanmarCategory,
        description: DEFAULT_DESCRIPTIONS[sanmarCategory] || `Products from the ${sanmarCategory} category.`,
        featured: false,
      },
    });

    // Update the mapping
    await prisma.sanMarCategoryMapping.update({
      where: { sanmarCategory },
      data: { localCategoryId: category.id },
    });

    adminLogger.info('Auto-created category', {
      categoryId: category.id,
      sanmarCategory,
      slug,
    });

    return category.id;
  } catch (error) {
    adminLogger.error('Failed to auto-create category', {
      sanmarCategory,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Initialize all SanMar category mappings
 */
export async function initializeCategoryMappings(): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;

  for (const category of SANMAR_CATEGORIES) {
    try {
      const result = await prisma.sanMarCategoryMapping.upsert({
        where: { sanmarCategory: category },
        create: {
          sanmarCategory: category,
          localCategoryId: null,
          autoCreate: false,
        },
        update: {}, // Don't update existing mappings
      });

      // Check if it was created (id will be new) or existing
      const existingMapping = await prisma.sanMarCategoryMapping.findUnique({
        where: { sanmarCategory: category },
      });

      if (existingMapping?.localCategoryId === null && result.localCategoryId === null) {
        created++;
      } else {
        existing++;
      }
    } catch (error) {
      adminLogger.error('Failed to initialize category mapping', {
        category,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  adminLogger.info('Category mappings initialized', { created, existing });
  return { created, existing };
}

/**
 * Get all category mappings with local category info
 */
export async function getAllCategoryMappings(): Promise<
  {
    id: string;
    sanmarCategory: string;
    localCategoryId: string | null;
    localCategoryName: string | null;
    autoCreate: boolean;
  }[]
> {
  const mappings = await prisma.sanMarCategoryMapping.findMany({
    orderBy: { sanmarCategory: 'asc' },
  });

  const result = await Promise.all(
    mappings.map(async (mapping) => {
      let localCategoryName: string | null = null;

      if (mapping.localCategoryId) {
        const category = await prisma.category.findUnique({
          where: { id: mapping.localCategoryId },
          select: { title: true },
        });
        localCategoryName = category?.title ?? null;
      }

      return {
        id: mapping.id,
        sanmarCategory: mapping.sanmarCategory,
        localCategoryId: mapping.localCategoryId,
        localCategoryName,
        autoCreate: mapping.autoCreate,
      };
    })
  );

  return result;
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

    // Clear cache for this category
    categoryCache.delete(sanmarCategory);

    adminLogger.info('Updated category mapping', {
      sanmarCategory,
      localCategoryId,
      autoCreate,
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
 * Enable auto-create for all unmapped categories
 */
export async function enableAutoCreateForAll(): Promise<{ updated: number }> {
  const result = await prisma.sanMarCategoryMapping.updateMany({
    where: { localCategoryId: null },
    data: { autoCreate: true },
  });

  clearCategoryCache();

  return { updated: result.count };
}

/**
 * Get local categories for dropdown selection
 */
export async function getLocalCategories(): Promise<{ id: string; title: string; slug: string }[]> {
  return prisma.category.findMany({
    select: { id: true, title: true, slug: true },
    orderBy: { title: 'asc' },
  });
}

/**
 * Bulk map categories - assign same local category to multiple SanMar categories
 */
export async function bulkMapCategories(
  sanmarCategories: string[],
  localCategoryId: string
): Promise<{ success: boolean; mapped: number; error?: string }> {
  try {
    const result = await prisma.sanMarCategoryMapping.updateMany({
      where: { sanmarCategory: { in: sanmarCategories } },
      data: { localCategoryId },
    });

    // Clear cache
    sanmarCategories.forEach((cat) => categoryCache.delete(cat));

    return { success: true, mapped: result.count };
  } catch (error) {
    return {
      success: false,
      mapped: 0,
      error: error instanceof Error ? error.message : 'Failed to bulk map categories',
    };
  }
}
