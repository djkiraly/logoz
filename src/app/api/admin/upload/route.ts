import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  uploadFile,
  validateFileType,
  validateFileSize,
  ALLOWED_IMAGE_TYPES,
  isGcsEnabled,
} from '@/lib/gcs';
import { adminLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if GCS is enabled
    const gcsEnabled = await isGcsEnabled();
    if (!gcsEnabled) {
      return NextResponse.json(
        { error: 'Google Cloud Storage is not configured. Please configure it in Settings.' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!validateFileType(file.type, ALLOWED_IMAGE_TYPES)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP, SVG).' },
        { status: 400 }
      );
    }

    // Validate file size
    if (!validateFileSize(file.size, file.type)) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB for images.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to GCS
    const result = await uploadFile(buffer, file.name, {
      folder: folder || 'products',
      contentType: file.type,
      public: true,
    });

    adminLogger.info('File uploaded via admin API', {
      userId: user.id,
      fileName: result.fileName,
      size: result.size,
    });

    return NextResponse.json({
      ok: true,
      data: {
        url: result.publicUrl,
        fileName: result.fileName,
        size: result.size,
        contentType: result.contentType,
      },
    });
  } catch (error) {
    adminLogger.error('Upload failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
