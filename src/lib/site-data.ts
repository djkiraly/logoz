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
};

const normalizeSettings = (settings: Partial<SiteSettings>): SiteSettings => ({
  siteName: settings.siteName ?? fallback.siteSettings.siteName,
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

