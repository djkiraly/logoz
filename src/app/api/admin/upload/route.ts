import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  uploadFile,
  validateFileType,
  validateFileSize,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_ARTWORK_TYPES,
  MAX_DOCUMENT_SIZE,
  isGcsEnabled,
  getGcsConfig,
} from '@/lib/gcs';
import { adminLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Configure body size limit for this route
export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      adminLogger.warn('Upload attempt without authentication');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if GCS is enabled
    const gcsEnabled = await isGcsEnabled();
    if (!gcsEnabled) {
      const config = await getGcsConfig();
      adminLogger.warn('Upload attempted but GCS not enabled', {
        configExists: !!config,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Google Cloud Storage is not configured. Please configure it in Settings.' },
        { status: 400 }
      );
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      adminLogger.error('Failed to parse form data', {
        error: formError instanceof Error ? formError.message : String(formError),
      });
      return NextResponse.json(
        { error: 'Failed to parse upload data. Please try again.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;
    const uploadType = formData.get('type') as string | null; // 'artwork' for artwork uploads

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine allowed types and max size based on upload type
    const isArtworkUpload = uploadType === 'artwork';
    const allowedTypes = isArtworkUpload ? ALLOWED_ARTWORK_TYPES : ALLOWED_IMAGE_TYPES;
    const maxSize = isArtworkUpload ? MAX_DOCUMENT_SIZE : undefined;
    const defaultFolder = isArtworkUpload ? 'artwork' : 'products';

    adminLogger.info('Processing upload', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      folder: folder || defaultFolder,
      uploadType: uploadType || 'image',
      userId: user.id,
    });

    // Validate file type
    if (!validateFileType(file.type, allowedTypes)) {
      const typeMessage = isArtworkUpload
        ? 'Only images and design files are allowed (JPEG, PNG, GIF, WebP, SVG, PDF, AI, EPS).'
        : 'Only images are allowed (JPEG, PNG, GIF, WebP, SVG).';
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". ${typeMessage}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (maxSize && file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${maxSize / 1024 / 1024}MB.` },
        { status: 400 }
      );
    } else if (!maxSize && !validateFileSize(file.size, file.type)) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB for images.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (bufferError) {
      adminLogger.error('Failed to read file buffer', {
        error: bufferError instanceof Error ? bufferError.message : String(bufferError),
      });
      return NextResponse.json(
        { error: 'Failed to read file data. Please try again.' },
        { status: 500 }
      );
    }

    // Upload to GCS
    const result = await uploadFile(buffer, file.name, {
      folder: folder || defaultFolder,
      contentType: file.type,
    });

    adminLogger.info('File uploaded via admin API', {
      userId: user.id,
      fileName: result.fileName,
      size: result.size,
      url: result.url,
    });

    return NextResponse.json({
      ok: true,
      data: {
        url: result.url, // This is now the proxy URL
        proxyUrl: result.proxyUrl,
        publicUrl: result.publicUrl,
        fileName: result.fileName,
        size: result.size,
        contentType: result.contentType,
      },
    });
  } catch (error: unknown) {
    // Extract error message properly from various error types
    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // Handle GCS errors and other object errors
      const errObj = error as Record<string, unknown>;
      if (typeof errObj.message === 'string') {
        errorMessage = errObj.message;
      } else if (typeof errObj.error === 'string') {
        errorMessage = errObj.error;
      } else if (errObj.errors && Array.isArray(errObj.errors) && errObj.errors.length > 0) {
        // GCS often returns errors in an array
        const firstError = errObj.errors[0] as Record<string, unknown>;
        errorMessage = (firstError.message as string) || (firstError.reason as string) || 'GCS error';
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Unable to parse error';
        }
      }
    }

    // Log to console for server-side debugging
    console.error('[UPLOAD ERROR]', errorMessage);
    console.error('[UPLOAD ERROR RAW]', error);
    console.error('[UPLOAD STACK]', errorStack);

    adminLogger.error('Upload failed', {
      error: errorMessage,
      stack: errorStack,
    });

    // Provide more specific error messages
    let userMessage = 'Upload failed';
    if (errorMessage.includes('not configured') || errorMessage.includes('not enabled')) {
      userMessage = 'Google Cloud Storage is not configured. Please configure it in Settings.';
    } else if (errorMessage.includes('DECODER') || errorMessage.includes('private key')) {
      userMessage = 'GCS authentication error. Please check the private key configuration in Settings.';
    } else if (errorMessage.includes('bucket') || errorMessage.includes('Bucket')) {
      userMessage = 'GCS bucket error. Please verify the bucket name in Settings.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('Permission') || errorMessage.includes('403')) {
      userMessage = 'GCS permission error. Please check service account permissions.';
    } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      userMessage = 'GCS bucket not found. Please verify the bucket name.';
    } else {
      userMessage = `Upload failed: ${errorMessage}`;
    }

    return NextResponse.json(
      { error: userMessage, details: errorMessage },
      { status: 500 }
    );
  }
}
