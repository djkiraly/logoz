/**
 * SanMar Image Resolver
 * Handles extraction and organization of product images from SanMar CDN
 */

import { adminLogger } from '../logger';
import {
  SanMarProductImageInfo,
  MediaContent,
  MEDIA_CLASS_TYPES,
} from './types';

export interface ResolvedImages {
  heroImage: string | null;
  gallery: string[];
  colorSwatch: string | null;
  brandLogo: string | null;
  specSheet: string | null;
}

export interface ColorImages {
  color: string;
  primary: string | null;
  front: string | null;
  back: string | null;
  side: string | null;
  threeQuarter: string | null;
  swatch: string | null;
}

/**
 * SanMar CDN base URLs
 */
const CDN_BASES = {
  catalog: 'https://cdnm.sanmar.com/catalog/images/',
  imglib: 'https://cdnm.sanmar.com/imglib/',
  swatch: 'https://cdnm.sanmar.com/swatch/gifs/',
  cache: 'https://cdnm.sanmar.com/cache/',
};

/**
 * Validate that a URL points to SanMar CDN
 */
export function isValidSanMarUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('https://cdnm.sanmar.com/') ||
    url.startsWith('https://cdn.sanmar.com/') ||
    url.startsWith('http://cdnm.sanmar.com/') ||
    url.startsWith('http://cdn.sanmar.com/')
  );
}

/**
 * Ensure URL uses HTTPS
 */
export function ensureHttps(url: string): string {
  if (!url) return url;
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * Filter and validate image URLs
 */
function filterValidUrls(urls: (string | undefined | null)[]): string[] {
  return urls
    .filter((url): url is string => !!url && isValidSanMarUrl(url))
    .map(ensureHttps);
}

/**
 * Remove duplicate URLs while preserving order
 */
function deduplicateUrls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

/**
 * Resolve images from SanMar Standard API response
 */
export function resolveImagesFromStandard(
  imageInfo: SanMarProductImageInfo
): ResolvedImages {
  // Prioritize images for hero: colorProductImage > frontModel > productImage
  const heroImage = ensureHttps(
    imageInfo.colorProductImage ||
    imageInfo.frontModel ||
    imageInfo.productImage ||
    ''
  ) || null;

  // Build gallery from available images
  const galleryUrls = filterValidUrls([
    imageInfo.frontModel,
    imageInfo.backModel,
    imageInfo.sideModel,
    imageInfo.threeQModel,
    imageInfo.frontFlat,
    imageInfo.backFlat,
    imageInfo.colorProductImage,
    imageInfo.productImage,
  ]);

  // Remove hero from gallery to avoid duplication
  const gallery = deduplicateUrls(
    galleryUrls.filter((url) => url !== heroImage)
  );

  return {
    heroImage,
    gallery,
    colorSwatch: ensureHttps(imageInfo.colorSquareImage || imageInfo.colorSwatchImage || '') || null,
    brandLogo: ensureHttps(imageInfo.brandLogoImage || '') || null,
    specSheet: ensureHttps(imageInfo.specSheet || '') || null,
  };
}

/**
 * Resolve images from PromoStandards Media Content response
 */
export function resolveImagesFromMediaContent(
  mediaContent: MediaContent[]
): ResolvedImages {
  // Filter to only image content
  const images = mediaContent.filter((m) => m.mediaType === 'Image');

  // Find primary/hero image
  const primaryImage = images.find((m) =>
    m.classTypeArray.some((ct) => ct.classTypeId === MEDIA_CLASS_TYPES.PRIMARY)
  );

  // Find high-res image
  const highResImage = images.find((m) =>
    m.classTypeArray.some((ct) => ct.classTypeId === MEDIA_CLASS_TYPES.HIGH)
  );

  // Find front image
  const frontImage = images.find((m) =>
    m.classTypeArray.some((ct) => ct.classTypeId === MEDIA_CLASS_TYPES.FRONT)
  );

  // Determine hero image
  const heroImage = ensureHttps(
    highResImage?.url || frontImage?.url || primaryImage?.url || ''
  ) || null;

  // Build gallery (exclude swatch images)
  const galleryImages = images
    .filter((m) => !m.classTypeArray.some((ct) => ct.classTypeId === MEDIA_CLASS_TYPES.SWATCH))
    .map((m) => ensureHttps(m.url));

  const gallery = deduplicateUrls(
    galleryImages.filter((url) => url !== heroImage)
  );

  // Find swatch
  const swatchImage = images.find((m) =>
    m.classTypeArray.some((ct) => ct.classTypeId === MEDIA_CLASS_TYPES.SWATCH)
  );

  // Find spec sheet (document type)
  const documents = mediaContent.filter((m) => m.mediaType === 'Document');
  const specSheet = documents.length > 0 ? ensureHttps(documents[0].url) : null;

  return {
    heroImage,
    gallery,
    colorSwatch: swatchImage ? ensureHttps(swatchImage.url) : null,
    brandLogo: null, // Not available in media content response
    specSheet,
  };
}

/**
 * Extract images organized by color from media content
 */
export function resolveImagesByColor(
  mediaContent: MediaContent[]
): Map<string, ColorImages> {
  const colorMap = new Map<string, ColorImages>();

  // Filter to only image content
  const images = mediaContent.filter((m) => m.mediaType === 'Image');

  for (const image of images) {
    const color = image.color || 'default';

    if (!colorMap.has(color)) {
      colorMap.set(color, {
        color,
        primary: null,
        front: null,
        back: null,
        side: null,
        threeQuarter: null,
        swatch: null,
      });
    }

    const colorImages = colorMap.get(color)!;

    for (const classType of image.classTypeArray) {
      const url = ensureHttps(image.url);

      switch (classType.classTypeId) {
        case MEDIA_CLASS_TYPES.PRIMARY:
          if (!colorImages.primary) colorImages.primary = url;
          break;
        case MEDIA_CLASS_TYPES.FRONT:
          if (!colorImages.front) colorImages.front = url;
          break;
        case MEDIA_CLASS_TYPES.REAR:
          if (!colorImages.back) colorImages.back = url;
          break;
        case MEDIA_CLASS_TYPES.SWATCH:
          if (!colorImages.swatch) colorImages.swatch = url;
          break;
        case MEDIA_CLASS_TYPES.HIGH:
          // High-res can serve as primary if no primary exists
          if (!colorImages.primary) colorImages.primary = url;
          break;
        case MEDIA_CLASS_TYPES.CUSTOM_SIDE:
          if (!colorImages.side) colorImages.side = url;
          break;
      }
    }
  }

  return colorMap;
}

/**
 * Build a complete gallery array from multiple color images
 */
export function buildGalleryFromColors(
  colorImagesMap: Map<string, ColorImages>,
  primaryColor?: string
): string[] {
  const gallery: string[] = [];
  const seenUrls = new Set<string>();

  // If primary color specified, add those images first
  if (primaryColor && colorImagesMap.has(primaryColor)) {
    const primaryImages = colorImagesMap.get(primaryColor)!;
    const orderedImages = [
      primaryImages.primary,
      primaryImages.front,
      primaryImages.back,
      primaryImages.side,
      primaryImages.threeQuarter,
    ];

    for (const url of orderedImages) {
      if (url && !seenUrls.has(url)) {
        gallery.push(url);
        seenUrls.add(url);
      }
    }
  }

  // Add images from other colors
  const entries = Array.from(colorImagesMap.entries());
  for (const [color, images] of entries) {
    if (color === primaryColor) continue;

    const orderedImages = [
      images.primary,
      images.front,
      images.back,
      images.side,
      images.threeQuarter,
    ];

    for (const url of orderedImages) {
      if (url && !seenUrls.has(url)) {
        gallery.push(url);
        seenUrls.add(url);
      }
    }
  }

  return gallery;
}

/**
 * Get the best hero image for a product
 */
export function selectBestHeroImage(
  standardImages?: SanMarProductImageInfo,
  mediaContent?: MediaContent[]
): string | null {
  // Try media content first (usually higher quality)
  if (mediaContent && mediaContent.length > 0) {
    const resolved = resolveImagesFromMediaContent(mediaContent);
    if (resolved.heroImage) return resolved.heroImage;
  }

  // Fall back to standard images
  if (standardImages) {
    const resolved = resolveImagesFromStandard(standardImages);
    if (resolved.heroImage) return resolved.heroImage;
  }

  return null;
}

/**
 * Construct a SanMar image URL from parts
 */
export function constructImageUrl(
  type: 'catalog' | 'highres' | 'swatch',
  style: string,
  color?: string,
  view?: 'front' | 'back' | 'side' | '3q'
): string {
  switch (type) {
    case 'catalog':
      return `${CDN_BASES.catalog}${style.toUpperCase()}.jpg`;
    case 'highres':
      if (color && view) {
        return `${CDN_BASES.imglib}mresjpg/${style}_${color}_model_${view}.jpg`;
      }
      return `${CDN_BASES.imglib}mresjpg/${style}.jpg`;
    case 'swatch':
      return `${CDN_BASES.catalog}${style.toUpperCase()}sw.jpg`;
    default:
      return `${CDN_BASES.catalog}${style.toUpperCase()}.jpg`;
  }
}

/**
 * Validate image URLs are accessible (optional - can be expensive)
 */
export async function validateImageUrls(
  urls: string[],
  timeout: number = 5000
): Promise<{ valid: string[]; invalid: string[] }> {
  const valid: string[] = [];
  const invalid: string[] = [];

  await Promise.all(
    urls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          valid.push(url);
        } else {
          invalid.push(url);
        }
      } catch {
        invalid.push(url);
      }
    })
  );

  return { valid, invalid };
}

/**
 * Log image resolution results for debugging
 */
export function logImageResolution(
  styleId: string,
  resolved: ResolvedImages
): void {
  adminLogger.debug('Resolved images for product', {
    styleId,
    heroImage: resolved.heroImage ? 'present' : 'missing',
    galleryCount: resolved.gallery.length,
    hasSwatch: !!resolved.colorSwatch,
    hasBrandLogo: !!resolved.brandLogo,
    hasSpecSheet: !!resolved.specSheet,
  });
}
