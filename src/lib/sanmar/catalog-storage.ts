/**
 * Shared storage location for uploaded SanMar catalog (SDL) files.
 *
 * Both the admin upload API and the CLI importer resolve the catalog directory
 * through this module so they always agree on where files live. Files are large
 * (hundreds of MB), so callers should stream to/from these paths — never buffer.
 *
 * Directory: $SANMAR_CATALOG_DIR, else <cwd>/data/sanmar-catalog. On the VPS set
 * SANMAR_CATALOG_DIR=/var/www/logoz/data/sanmar-catalog in .env so the Next.js
 * server (which may run from .next/standalone) and the CLI use the same path.
 */

import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

/** Extensions we accept for catalog files. */
const ALLOWED_EXTENSIONS = ['.txt', '.csv', '.tsv'];

/** Suffix used for in-progress uploads (atomic rename on completion). */
export const UPLOAD_TEMP_SUFFIX = '.uploading';

export interface CatalogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

/** Absolute path to the catalog storage directory (not guaranteed to exist). */
export function getCatalogDir(): string {
  return process.env.SANMAR_CATALOG_DIR || path.join(process.cwd(), 'data', 'sanmar-catalog');
}

/** Ensure the catalog directory exists and return its absolute path. */
export async function ensureCatalogDir(): Promise<string> {
  const dir = getCatalogDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Sanitize a user-supplied catalog filename: basename only (no path segments),
 * a conservative character set, and an allowed extension. Throws on anything
 * suspicious so path traversal can never reach outside the catalog directory.
 */
export function sanitizeCatalogName(name: string): string {
  const base = path.basename((name || '').trim());
  if (!base || base === '.' || base === '..') {
    throw new Error('Invalid filename');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(base)) {
    throw new Error('Filename may only contain letters, numbers, dot, dash and underscore');
  }
  if (!ALLOWED_EXTENSIONS.includes(path.extname(base).toLowerCase())) {
    throw new Error(`Filename must end in one of: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  return base;
}

/**
 * Resolve a catalog filename to an absolute path inside the storage directory,
 * verifying the result cannot escape it.
 */
export async function resolveCatalogPath(name: string): Promise<string> {
  const dir = await ensureCatalogDir();
  const full = path.join(dir, sanitizeCatalogName(name));
  const rel = path.relative(dir, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Resolved path escapes the catalog directory');
  }
  return full;
}

/** List stored catalog files (newest first), skipping in-progress uploads. */
export async function listCatalogFiles(): Promise<CatalogFileInfo[]> {
  const dir = await ensureCatalogDir();
  const entries = await readdir(dir, { withFileTypes: true });
  const files: CatalogFileInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.endsWith(UPLOAD_TEMP_SUFFIX)) continue;
    const info = await stat(path.join(dir, entry.name));
    files.push({ name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() });
  }
  files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return files;
}

/** Delete a stored catalog file. Returns false if it did not exist. */
export async function deleteCatalogFile(name: string): Promise<boolean> {
  const full = await resolveCatalogPath(name);
  try {
    await unlink(full);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}
