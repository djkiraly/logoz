import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'node:fs';
import { rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { adminLogger } from '@/lib/logger';
import {
  ensureCatalogDir,
  sanitizeCatalogName,
  resolveCatalogPath,
  listCatalogFiles,
  deleteCatalogFile,
  UPLOAD_TEMP_SUFFIX,
} from '@/lib/sanmar/catalog-storage';

// Stream the raw request body straight to disk — never buffer the whole file.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!requireRole(user, 'ADMIN')) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { user };
}

/**
 * GET — list stored catalog files.
 */
export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;

  try {
    const files = await listCatalogFiles();
    return NextResponse.json({ ok: true, data: { files } });
  } catch (error) {
    adminLogger.error('Failed to list catalog files', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list catalog files' }, { status: 500 });
  }
}

/**
 * POST — upload a catalog file. The browser sends the raw File as the request
 * body (NOT multipart) with the desired filename in the `x-filename` header, so
 * we can stream it to disk with flat memory regardless of size. The upload lands
 * on a temp path and is atomically renamed into place on success.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  if (!request.body) {
    return NextResponse.json({ error: 'No file data in request body' }, { status: 400 });
  }

  let safeName: string;
  try {
    safeName = sanitizeCatalogName(request.headers.get('x-filename') || '');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid filename' },
      { status: 400 }
    );
  }

  const dir = await ensureCatalogDir();
  const finalPath = path.join(dir, safeName);
  const tempPath = finalPath + UPLOAD_TEMP_SUFFIX;

  try {
    await pipeline(
      Readable.fromWeb(request.body as unknown as WebReadableStream<Uint8Array>),
      createWriteStream(tempPath)
    );
    await rename(tempPath, finalPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    adminLogger.error('Catalog upload failed', {
      fileName: safeName,
      userId: auth.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Upload failed while writing the file' }, { status: 500 });
  }

  const info = await stat(finalPath);
  adminLogger.info('Catalog file uploaded', {
    fileName: safeName,
    size: info.size,
    userId: auth.user.id,
  });

  return NextResponse.json({
    ok: true,
    data: { name: safeName, size: info.size, modifiedAt: info.mtime.toISOString() },
  });
}

/**
 * DELETE — remove a stored catalog file to free disk space. Pass `?name=<file>`.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: 'Missing ?name= parameter' }, { status: 400 });
  }

  try {
    // resolveCatalogPath validates/sanitizes before we touch the filesystem.
    await resolveCatalogPath(name);
    const deleted = await deleteCatalogFile(name);
    if (!deleted) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    adminLogger.info('Catalog file deleted', { fileName: name, userId: auth.user.id });
    return NextResponse.json({ ok: true, data: { deleted: name } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 400 }
    );
  }
}
