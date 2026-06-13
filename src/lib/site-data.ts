import { cache } from 'react';
import { prisma, isDatabaseEnabled } from './prisma';
import * as fallback from './static-content';
import { dbLogger } from './logger';

type WithFallback<T> = Promise<T>;

const loadOrFallback = async <T>(
  loader: () => Promise<T | null>,
  fallbackValue: unknown,
  loaderName?: string,
): WithFallback<T> => {
  const safeFallback = fallbackValue as T;
  if (!isDatabaseEnabled) {
    dbLogger.debug('Database disabled, using fallback', { loader: loaderName });
    return safeFallback;
  }

  try {
    const result = await loader();
    return (result as T) ?? safeFallback;
  } catch (error) {
    dbLogger.warn('Database query failed, using fallback', {
      loader: loaderName,
      error: error instanceof Error ? error.message : String(error),
    });
    return safeFallback;
  }
};

export type SiteSettings = {
  siteName: string;
  heroTagline: string;
  heroHeading: string;
  heroCopy: string;
  ctaLabel: string;
  ctaLink: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  announcement?: string | null;
  bannerEnabled: boolean;
  headerCtaEnabled: boolean;
  headerCtaLabel: string;
  headerCtaLink: string;
  copyrightText: string;
  faviconUrl?: string | null;
  logoUrl?: string | null;
  // Hero Image
  heroImageUrl?: string | null;
  // Hero Video Intro
  heroVideoEnabled: boolean;
  heroVideoUrl?: string | null;
  heroVideoAutoplay: boolean;
  heroVideoMuted: boolean;
  heroVideoDuration?: number | null;
};

const normalizeSettings = (settings: Partial<SiteSettings>): SiteSettings => ({
  siteName: settings.siteName ?? fallback.siteSettings.siteName,
  heroTagline: settings.heroTagline ?? 'Cloud print operating system',
  heroHeading: settings.heroHeading ?? fallback.siteSettings.heroHeading,
  heroCopy: settings.heroCopy ?? fallback.siteSettings.heroCopy,
  ctaLabel: settings.ctaLabel ?? fallback.siteSettings.ctaLabel,
  ctaLink: settings.ctaLink ?? fallback.siteSettings.ctaLink,
  contactEmail: settings.contactEmail ?? fallback.siteSettings.contactEmail,
  contactPhone: settings.contactPhone ?? fallback.siteSettings.contactPhone,
  address: settings.address ?? fallback.siteSettings.address,
  announcement: settings.announcement ?? fallback.siteSettings.announcement,
  bannerEnabled: settings.bannerEnabled ?? true,
  headerCtaEnabled: settings.headerCtaEnabled ?? true,
  headerCtaLabel: settings.headerCtaLabel ?? 'Build a design',
  headerCtaLink: settings.headerCtaLink ?? '/design-studio',
  copyrightText: settings.copyrightText ?? 'Crafted in the cloud.',
  faviconUrl: settings.faviconUrl ?? null,
  logoUrl: settings.logoUrl ?? null,
  // Hero Image
  heroImageUrl: settings.heroImageUrl ?? null,
  // Hero Video Intro
  heroVideoEnabled: settings.heroVideoEnabled ?? false,
  heroVideoUrl: settings.heroVideoUrl ?? null,
  heroVideoAutoplay: settings.heroVideoAutoplay ?? true,
  heroVideoMuted: settings.heroVideoMuted ?? true,
  heroVideoDuration: settings.heroVideoDuration ?? null,
});

export const getSiteSettings = cache(async () => {
  if (!isDatabaseEnabled) {
    return normalizeSettings(fallback.siteSettings);
  }

  const record = await prisma.siteSetting.findFirst();
  return normalizeSettings((record as SiteSettings) ?? fallback.siteSettings);
});

export const getCategories = cache(async () =>
  loadOrFallback(
    () =>
      prisma.category.findMany({
        // Public pages only show categories that are active AND have at least
        // one visible product, so deactivated or empty/hidden-only categories
        // don't appear in nav/filters.
        where: { active: true, products: { some: { visible: true } } },
        include: { services: true },
        orderBy: { title: 'asc' },
      }),
    fallback.categories,
  ),
);

export const getServices = cache(async () =>
  loadOrFallback(
    () =>
      prisma.service.findMany({
        orderBy: { title: 'asc' },
      }),
    fallback.services,
  ),
);

export const getSuppliers = cache(async () =>
  loadOrFallback(
    () =>
      prisma.supplier.findMany({
        orderBy: [
          { featured: 'desc' },
          { name: 'asc' },
        ],
      }),
    fallback.suppliers,
  ),
);

export const getProducts = cache(async () =>
  loadOrFallback(
    () =>
      prisma.product.findMany({
        where: { visible: true },
        // Never expose supplier cost on public pages.
        omit: { cost: true },
        include: { category: true, supplier: true },
        take: 12,
        orderBy: [
          { featured: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    fallback.products,
  ),
);

export type PublicColorImage = {
  color: string;
  swatch: string | null;
  front: string | null;
  back: string | null;
  frontFlat: string | null;
  backFlat: string | null;
};

export type PublicProductDetail = {
  id: string;
  sku: string;
  name: string;
  description: string;
  heroImageUrl: string | null;
  gallery: string[];
  images: string[];
  colorImages: PublicColorImage[];
  basePrice: number;
  minQuantity: number;
  fulfillment: string[];
  productStatus: string;
  featured: boolean;
  category: { title: string; slug: string } | null;
  supplier: { name: string; logoUrl: string | null } | null;
  colors: string[];
  sizes: string[];
};

// Apparel size ordering for display; unknown sizes sort to the end alphabetically.
const SIZE_ORDER = [
  'XS', 'S', 'SM', 'M', 'MD', 'L', 'LG', 'XL', 'XLT',
  '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL', 'OSFA', 'ONE SIZE',
];

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function dedupe(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Fetch a single visible product for the public detail page. Returns ONLY
 * public-safe fields — supplier cost and per-variant wholesale prices are never
 * selected, so they cannot leak into the client payload.
 */
export const getProductBySku = cache(async (sku: string): Promise<PublicProductDetail | null> => {
  if (!isDatabaseEnabled) return null;

  try {
    const product = await prisma.product.findFirst({
      where: { sku, visible: true },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        heroImageUrl: true,
        gallery: true,
        colorImages: true,
        basePrice: true,
        minQuantity: true,
        fulfillment: true,
        productStatus: true,
        featured: true,
        category: { select: { title: true, slug: true } },
        supplier: { select: { name: true, logoUrl: true, sanmarBrandLogoUrl: true } },
        variants: { select: { color: true, size: true } },
      },
    });

    if (!product) return null;

    const colorImages = (product.colorImages as PublicColorImage[] | null) ?? [];
    const images = dedupe([product.heroImageUrl, ...product.gallery]);
    const colors = dedupe(product.variants.map((v) => v.color));
    const sizes = sortSizes(dedupe(product.variants.map((v) => v.size)));

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      heroImageUrl: product.heroImageUrl,
      gallery: product.gallery,
      images,
      colorImages,
      basePrice: Number(product.basePrice),
      minQuantity: product.minQuantity,
      fulfillment: product.fulfillment,
      productStatus: product.productStatus,
      featured: product.featured,
      category: product.category,
      supplier: product.supplier
        ? {
            name: product.supplier.name,
            logoUrl: product.supplier.logoUrl ?? product.supplier.sanmarBrandLogoUrl ?? null,
          }
        : null,
      colors,
      sizes,
    };
  } catch (error) {
    dbLogger.warn('Failed to load product by sku', {
      sku,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
});

export const getCollections = cache(async () =>
  loadOrFallback(
    () =>
      prisma.collection.findMany({
        include: { products: true },
      }),
    fallback.collections,
  ),
);

export const getDesigns = cache(async () =>
  loadOrFallback(
    () =>
      prisma.design.findMany({
        orderBy: { title: 'asc' },
      }),
    fallback.designs,
  ),
);

export const getFaqs = cache(async () =>
  loadOrFallback(
    () =>
      prisma.faq.findMany({
        orderBy: { category: 'asc' },
      }),
    fallback.faqs,
  ),
);

export const getTestimonials = cache(async () =>
  loadOrFallback(
    () =>
      prisma.testimonial.findMany({
        orderBy: { author: 'asc' },
      }),
    fallback.testimonials,
  ),
);

export const getMarketingSnapshot = cache(async () => {
  const [settings, services, suppliers, products, testimonials] = await Promise.all([
    getSiteSettings(),
    getServices(),
    getSuppliers(),
    getProducts(),
    getTestimonials(),
  ]);

  return {
    settings,
    services,
    suppliers,
    products,
    testimonials,
    stats: fallback.stats,
  };
});

