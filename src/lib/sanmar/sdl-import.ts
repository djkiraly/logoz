/**
 * SanMar SDL (catalog data file) importer.
 *
 * Imports products directly from SanMar's downloadable tab-delimited catalog
 * file ("SanMar Data Library" / SDL) instead of the SOAP sync. The file is one
 * row per Style x Color x Size, sorted by style. We stream it line-by-line,
 * buffer the rows for the current style, and flush a Product + its Variants when
 * the style changes — so memory stays flat regardless of file size.
 *
 * Image strategy: SanMar provides per-COLOR absolute CDN URLs
 * (FRONT/BACK_MODEL_IMAGE_URL, FRONT/BACK_FLAT_IMAGE_URL). We reference those
 * directly (imageSource = REMOTE) and store them per color in Product.colorImages
 * so the product page can swap imagery when a color is selected. Bare filename
 * columns (brand logo, color swatch gif) are prefixed with the catalog CDN base.
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { prisma } from '../prisma';
import { adminLogger } from '../logger';
import { Prisma, ImageSource, ProductStatus } from '@prisma/client';
import { getOrCreateSupplier, clearSupplierCache } from './supplier-mapper';
import { ensureCategory, clearCategoryCache } from './category-mapper';

/** SanMar CDN base for bare (filename-only) image columns. */
const CDN_CATALOG_BASE = 'https://cdnm.sanmar.com/catalog/images/';

export interface SdlImportOptions {
  filePath: string;
  /** Mark imported products visible immediately. Default false (admin reviews). */
  visible?: boolean;
  /** Parse + map only; perform no database writes. */
  dryRun?: boolean;
  /** Stop after importing this many styles (for testing on a slice). */
  limitStyles?: number;
  /** Invoked roughly every `progressEvery` styles with running totals. */
  onProgress?: (summary: SdlImportSummary) => void;
  progressEvery?: number;
  /** Invoked (dry-run) with each mapped style so callers can inspect the mapping. */
  onSample?: (mapped: MappedStyle) => void;
}

export interface SdlImportSummary {
  rowsRead: number;
  stylesProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  variantsUpserted: number;
  suppliersCreated: number;
  errors: number;
}

/** One per-color image set stored as JSON on Product.colorImages. */
interface ColorImageSet {
  color: string;
  swatch: string | null;
  front: string | null;
  back: string | null;
  frontFlat: string | null;
  backFlat: string | null;
}

/** Columns we read from the SDL header. Names match the file's header row. */
const REQUIRED_COLUMNS = ['STYLE#', 'COLOR_NAME', 'SIZE'] as const;

function cleanText(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNum(value: string | undefined): number | null {
  if (value == null) return null;
  const n = Number.parseFloat(value.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value: string | undefined): number | null {
  const n = parseNum(value);
  return n == null ? null : Math.round(n);
}

/**
 * Split one delimited line into fields. SanMar ships the catalog as either
 * tab-delimited (.txt) or comma-delimited (.csv) with identical columns. Quotes
 * are handled per RFC-4180 (a quoted field may contain the delimiter; `""` is an
 * escaped quote) so a comma inside a quoted field doesn't shift columns. Lines
 * with no quote character take a fast plain-split path.
 */
function splitDelimited(line: string, delimiter: string): string[] {
  if (line.indexOf('"') === -1) return line.split(delimiter);

  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/**
 * Normalize a GTIN to digits, or null. Rejects Excel-mangled scientific
 * notation (e.g. "1.94422E+11") rather than storing a lossy/invalid barcode —
 * a sign the source CSV was opened in Excel; re-export the raw file for clean
 * GTINs.
 */
function normalizeGtin(value: string | undefined): string | null {
  const v = cleanText(value);
  if (!v || /[eE]/.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/** Detect the field delimiter from the header line (tab vs comma). */
function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return commas > tabs ? ',' : '\t';
}

/** Resolve an image column: pass absolute URLs through, prefix bare filenames. */
function resolveImageRef(value: string | undefined, base = CDN_CATALOG_BASE): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://');
  return base + v;
}

function mapProductStatus(raw: string | undefined): ProductStatus {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('discontin')) return ProductStatus.DISCONTINUED;
  if (s.includes('coming')) return ProductStatus.COMING_SOON;
  if (s.includes('new')) return ProductStatus.NEW;
  return ProductStatus.ACTIVE;
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

/** A parsed row keyed by column name. */
type Row = Record<string, string>;

/** The catalog-derived shape for one style, independent of the database. */
export interface MappedStyle {
  style: string;
  brand: string;
  sanmarCategory: string;
  name: string;
  description: string;
  basePrice: number;
  cost: number | null;
  productStatus: ProductStatus;
  heroImageUrl: string | null;
  gallery: string[];
  colorImages: ColorImageSet[];
  keywords: string[];
  priceCode: string | null;
  brandLogoUrl: string | null;
  sanmarInventoryKey: string | null;
  variants: {
    color: string;
    size: string;
    piecePrice: number | null;
    casePrice: number | null;
    caseSize: number | null;
    pieceWeight: number | null;
    gtin: string | null;
    sanmarCatalogColor: string | null;
    sanmarUniqueKey: string | null;
    sanmarPartId: string | null;
  }[];
}

/**
 * Pure mapping: a style's rows -> the record we will persist. No database, no
 * I/O — this is the single source of truth for how SDL columns map to our model
 * and is what `--dry-run` prints so the mapping can be eyeballed before a write.
 */
export function mapStyleRows(rows: Row[]): MappedStyle | null {
  const head = rows[0];
  const style = cleanText(head['STYLE#']);
  if (!style) return null;

  const brand = cleanText(head['MILL']) || cleanText(head['BRAND']) || 'SanMar';
  const colorImages = buildColorImages(rows);
  const primary = colorImages[0];

  const heroImageUrl = primary?.front ?? primary?.frontFlat ?? primary?.swatch ?? null;
  const gallery = dedupe([
    primary?.front,
    primary?.back,
    primary?.frontFlat,
    primary?.backFlat,
    ...colorImages.slice(1).flatMap((c) => [c.front, c.back]),
  ]);

  // Lowest prices across the size matrix become the product "from" price + cost.
  const piecePrices = rows.map((r) => parseNum(r['PIECE_PRICE'])).filter((n): n is number => n != null);
  const suggested = rows.map((r) => parseNum(r['SUGGESTED_PRICE'])).filter((n): n is number => n != null);
  const cost = piecePrices.length ? Math.min(...piecePrices) : null;
  const basePrice = suggested.length ? Math.min(...suggested) : cost ?? 0;

  const keywords = dedupe([
    brand.toLowerCase(),
    cleanText(head['CATEGORY_NAME']).toLowerCase(),
    cleanText(head['SUBCATEGORY_NAME']).toLowerCase(),
    style.toLowerCase(),
    ...colorImages.map((c) => c.color.toLowerCase()),
  ]).slice(0, 30);

  return {
    style,
    brand,
    sanmarCategory: cleanText(head['CATEGORY_NAME']),
    name: cleanText(head['PRODUCT_TITLE']) || style,
    description: cleanText(head['PRODUCT_DESCRIPTION']),
    basePrice,
    cost,
    productStatus: mapProductStatus(head['PRODUCT_STATUS']),
    heroImageUrl,
    gallery,
    colorImages,
    keywords,
    priceCode: cleanText(head['PRICE_GROUP']) || null,
    brandLogoUrl: resolveImageRef(head['BRAND_LOGO_IMAGE']),
    sanmarInventoryKey: cleanText(head['INVENTORY_KEY']) || null,
    variants: rows.map((r) => ({
      color: cleanText(r['COLOR_NAME']) || 'Default',
      size: cleanText(r['SIZE']) || 'OSFA',
      piecePrice: parseNum(r['PIECE_PRICE']),
      casePrice: parseNum(r['CASE_PRICE']),
      caseSize: parseInteger(r['CASE_SIZE']),
      pieceWeight: parseNum(r['PIECE_WEIGHT']),
      gtin: normalizeGtin(r['GTIN']),
      sanmarCatalogColor: cleanText(r['SANMAR_MAINFRAME_COLOR']) || null,
      sanmarUniqueKey: cleanText(r['UNIQUE_KEY']) || null,
      sanmarPartId: cleanText(r['INVENTORY_KEY']) || null,
    })),
  };
}

/** Build the per-color image sets for a style's rows (first row wins per color). */
function buildColorImages(rows: Row[]): ColorImageSet[] {
  const byColor = new Map<string, ColorImageSet>();
  for (const r of rows) {
    const color = cleanText(r['COLOR_NAME']) || 'Default';
    if (byColor.has(color)) continue;
    byColor.set(color, {
      color,
      swatch: resolveImageRef(r['COLOR_SQUARE_IMAGE']),
      front: resolveImageRef(r['FRONT_MODEL_IMAGE_URL']),
      back: resolveImageRef(r['BACK_MODEL_IMAGE_URL']),
      frontFlat: resolveImageRef(r['FRONT_FLAT_IMAGE_URL']),
      backFlat: resolveImageRef(r['BACK_FLAT_IMAGE_URL']),
    });
  }
  return Array.from(byColor.values());
}

/**
 * Import a single style (all its color/size rows) into Product + Variants.
 * Idempotent: keyed on sanmarStyleId (product) and productId+color+size (variant).
 * On re-import, admin-curated fields (visible, categoryId, supplierId) are
 * preserved; catalog-derived fields (pricing, imagery, description) are refreshed.
 */
async function importStyle(
  rows: Row[],
  opts: SdlImportOptions,
  summary: SdlImportSummary,
): Promise<void> {
  const mapped = mapStyleRows(rows);
  if (!mapped) return;

  if (opts.dryRun) {
    opts.onSample?.(mapped);
    summary.productsCreated += 1; // counted as "would create/update"
    summary.variantsUpserted += mapped.variants.length;
    return;
  }

  // Supplier (brand) and Category — both find-or-create (build if missing), cached.
  const supplierResult = await getOrCreateSupplier(mapped.brand, mapped.brandLogoUrl ?? undefined);
  if (supplierResult.created) summary.suppliersCreated += 1;
  const categoryId = await ensureCategory(mapped.sanmarCategory);

  // Catalog-derived fields refreshed on every import.
  const catalogData = {
    name: mapped.name,
    description: mapped.description,
    heroImageUrl: mapped.heroImageUrl,
    gallery: mapped.gallery,
    colorImages: mapped.colorImages as unknown as Prisma.InputJsonValue,
    basePrice: mapped.basePrice,
    cost: mapped.cost,
    imageSource: ImageSource.REMOTE,
    keywords: mapped.keywords,
    priceCode: mapped.priceCode,
    productStatus: mapped.productStatus,
    sanmarBrand: mapped.brand,
    sanmarCategory: mapped.sanmarCategory || null,
    sanmarInventoryKey: mapped.sanmarInventoryKey,
    syncSource: 'sanmar_sdl',
    lastSyncedAt: new Date(),
  };

  // Find-then-write so we can preserve a manually-set public price.
  const existing = await prisma.product.findUnique({
    where: { sanmarStyleId: mapped.style },
    select: { id: true, priceOverridden: true },
  });

  let productId: string;
  if (existing) {
    // On re-import, refresh catalog fields but preserve admin curation
    // (visible, category, supplier). When the price has been manually
    // overridden, leave basePrice untouched too.
    const { basePrice, ...rest } = catalogData;
    const updateData = existing.priceOverridden ? rest : { ...rest, basePrice };
    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: updateData,
      select: { id: true },
    });
    productId = updated.id;
    summary.productsUpdated += 1;
  } else {
    const created = await prisma.product.create({
      data: {
        sku: mapped.style,
        sanmarStyleId: mapped.style,
        minQuantity: 1,
        visible: opts.visible ?? false,
        ...catalogData,
        category: { connect: { id: categoryId } },
        supplier: { connect: { id: supplierResult.supplierId } },
      },
      select: { id: true },
    });
    productId = created.id;
    summary.productsCreated += 1;
  }

  // Dedupe rows that resolve to the same (color, size) within this style — dirty
  // catalogs can repeat them — so there's exactly one write per variant.
  const uniqueVariants = new Map<string, MappedStyle['variants'][number]>();
  for (const v of mapped.variants) {
    uniqueVariants.set(`${v.color} ${v.size}`, v);
  }

  // Upsert all variants for this style in one transaction.
  const variantUpserts = Array.from(uniqueVariants.values()).map((v) => {
    const { color, size, ...data } = v;
    return prisma.variant.upsert({
      where: { productId_color_size: { productId, color, size } },
      create: { productId, color, size, ...data },
      update: data,
    });
  });

  await prisma.$transaction(variantUpserts);
  summary.variantsUpserted += variantUpserts.length;
}

/**
 * Stream-import the SanMar SDL catalog file. Resolves with running totals.
 */
export async function importSdlCatalog(opts: SdlImportOptions): Promise<SdlImportSummary> {
  const summary: SdlImportSummary = {
    rowsRead: 0,
    stylesProcessed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    variantsUpserted: 0,
    suppliersCreated: 0,
    errors: 0,
  };
  const progressEvery = opts.progressEvery ?? 100;
  clearSupplierCache();
  clearCategoryCache();

  const rl = createInterface({
    input: createReadStream(opts.filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let columns: string[] | null = null;
  let colIndex: Map<string, number> | null = null;
  let delimiter = '\t';
  let currentStyle: string | null = null;
  let buffer: Row[] = [];

  const toRow = (line: string): Row => {
    const cells = splitDelimited(line, delimiter);
    const row: Row = {};
    for (const [name, idx] of colIndex!) row[name] = cells[idx] ?? '';
    return row;
  };

  const flush = async (): Promise<boolean> => {
    if (buffer.length === 0) return true;
    if (opts.limitStyles != null && summary.stylesProcessed >= opts.limitStyles) {
      return false;
    }
    try {
      await importStyle(buffer, opts, summary);
    } catch (err) {
      summary.errors += 1;
      adminLogger.error('SDL import: style failed', {
        style: buffer[0]?.['STYLE#'],
        error: err instanceof Error ? err.message : String(err),
      });
    }
    summary.stylesProcessed += 1;
    if (summary.stylesProcessed % progressEvery === 0) opts.onProgress?.(summary);
    buffer = [];
    return true;
  };

  try {
    for await (const rawLine of rl) {
      const line = rawLine.replace(/\r$/, '');
      if (!columns) {
        // Strip a leading UTF-8 BOM so the first column name stays clean, then
        // auto-detect tab vs comma from the header.
        const headerLine = line.replace(/^\uFEFF/, '');
        delimiter = detectDelimiter(headerLine);
        columns = splitDelimited(headerLine, delimiter).map((c) => c.trim());
        colIndex = new Map(columns.map((c, i) => [c, i]));
        const missing = REQUIRED_COLUMNS.filter((c) => !colIndex!.has(c));
        if (missing.length) {
          throw new Error(`SDL file is missing required columns: ${missing.join(', ')}`);
        }
        continue;
      }
      if (!line.trim()) continue;
      summary.rowsRead += 1;

      const row = toRow(line);
      const style = (row['STYLE#'] ?? '').trim();
      if (!style) continue;

      if (currentStyle != null && style !== currentStyle) {
        const keepGoing = await flush();
        if (!keepGoing) {
          rl.close();
          return summary;
        }
      }
      currentStyle = style;
      buffer.push(row);
    }
    await flush();
  } finally {
    rl.close();
  }

  opts.onProgress?.(summary);
  return summary;
}
