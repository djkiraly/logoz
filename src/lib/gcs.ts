import { Storage, Bucket } from '@google-cloud/storage';
import { prisma, isDatabaseEnabled } from './prisma';
import { adminLogger } from './logger';

// GCS Configuration type stored in database
export type GcsConfig = {
  projectId: string;
  bucketName: string;
  clientEmail: string;
  privateKey: string;
  enabled: boolean;
};

// File upload options
export type UploadOptions = {
  folder?: string;
  contentType?: string;
  public?: boolean;
  metadata?: Record<string, string>;
};

// Upload result
export type UploadResult = {
  url: string;
  publicUrl: string;
  fileName: string;
  size: number;
  contentType: string;
};

/**
 * Format the private key properly for Google Cloud authentication
 */
function formatPrivateKey(key: string): string {
  if (!key || key.trim() === '') {
    return key;
  }

  let formattedKey = key.trim();

  // Remove surrounding quotes if present
  if ((formattedKey.startsWith('"') && formattedKey.endsWith('"')) ||
      (formattedKey.startsWith("'") && formattedKey.endsWith("'"))) {
    formattedKey = formattedKey.slice(1, -1);
  }

  // Replace literal \n with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');

  // Remove carriage returns
  formattedKey = formattedKey.replace(/\r/g, '');

  formattedKey = formattedKey.trim();

  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    return formattedKey;
  }

  const lines = formattedKey.split('\n');
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine !== '') {
      cleanedLines.push(trimmedLine);
    }
  }

  return cleanedLines.join('\n');
}

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

// Max file sizes (in bytes)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

// Cache for GCS client
let cachedStorage: Storage | null = null;
let cachedBucket: Bucket | null = null;
let cachedConfig: GcsConfig | null = null;

/**
 * Get GCS configuration from database
 */
export async function getGcsConfig(): Promise<GcsConfig | null> {
  if (!isDatabaseEnabled) {
    return null;
  }

  try {
    const settings = await prisma.siteSetting.findFirst();
    if (!settings?.gcsConfig) {
      return null;
    }

    const config = settings.gcsConfig as GcsConfig;
    if (!config.enabled) {
      return null;
    }

    return config;
  } catch (error) {
    adminLogger.error('Failed to get GCS config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Initialize Google Cloud Storage client
 */
export async function getGcsClient(): Promise<{ storage: Storage; bucket: Bucket } | null> {
  const config = await getGcsConfig();

  if (!config) {
    return null;
  }

  if (
    cachedStorage &&
    cachedBucket &&
    cachedConfig &&
    cachedConfig.projectId === config.projectId &&
    cachedConfig.bucketName === config.bucketName &&
    cachedConfig.clientEmail === config.clientEmail
  ) {
    return { storage: cachedStorage, bucket: cachedBucket };
  }

  try {
    const formattedKey = formatPrivateKey(config.privateKey);

    const credentials = {
      type: 'service_account' as const,
      project_id: config.projectId,
      client_email: config.clientEmail,
      private_key: formattedKey,
    };

    const storage = new Storage({
      projectId: config.projectId,
      credentials,
    });

    const bucket = storage.bucket(config.bucketName);

    const [exists] = await bucket.exists();
    if (!exists) {
      adminLogger.error('GCS bucket does not exist', { bucket: config.bucketName });
      return null;
    }

    cachedStorage = storage;
    cachedBucket = bucket;
    cachedConfig = config;

    adminLogger.info('GCS client initialized', {
      projectId: config.projectId,
      bucket: config.bucketName,
    });

    return { storage, bucket };
  } catch (error) {
    adminLogger.error('Failed to initialize GCS client', {
      error: error instanceof Error ? error.message : String(error),
    });
    cachedStorage = null;
    cachedBucket = null;
    cachedConfig = null;
    return null;
  }
}

/**
 * Clear cached GCS client
 */
export function clearGcsCache(): void {
  cachedStorage = null;
  cachedBucket = null;
  cachedConfig = null;
}

/**
 * Generate a unique file name
 */
export function generateFileName(originalName: string, folder?: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const safeName = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .substring(0, 50);

  const fileName = `${safeName}-${timestamp}-${randomId}${ext ? `.${ext}` : ''}`;
  return folder ? `${folder}/${fileName}` : fileName;
}

/**
 * Validate file type
 */
export function validateFileType(
  contentType: string,
  allowedTypes: string[] = ALLOWED_FILE_TYPES
): boolean {
  return allowedTypes.includes(contentType);
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, contentType: string): boolean {
  if (ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return size <= MAX_IMAGE_SIZE;
  }
  if (ALLOWED_DOCUMENT_TYPES.includes(contentType)) {
    return size <= MAX_DOCUMENT_SIZE;
  }
  return false;
}

/**
 * Upload a file to Google Cloud Storage
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const client = await getGcsClient();

  if (!client) {
    throw new Error('Google Cloud Storage is not configured or enabled');
  }

  const { bucket } = client;
  const config = cachedConfig!;

  const fileName = generateFileName(originalName, options.folder);
  const file = bucket.file(fileName);

  const contentType = options.contentType || 'application/octet-stream';

  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      ...options.metadata,
    },
    public: options.public ?? false,
  });

  let publicUrl: string;
  let url: string;

  if (options.public) {
    publicUrl = `https://storage.googleapis.com/${config.bucketName}/${fileName}`;
    url = publicUrl;
  } else {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    url = signedUrl;
    publicUrl = `https://storage.googleapis.com/${config.bucketName}/${fileName}`;
  }

  adminLogger.info('File uploaded to GCS', {
    fileName,
    size: buffer.length,
    contentType,
    public: options.public,
  });

  return {
    url,
    publicUrl,
    fileName,
    size: buffer.length,
    contentType,
  };
}

/**
 * Delete a file from Google Cloud Storage
 */
export async function deleteFile(fileName: string): Promise<boolean> {
  const client = await getGcsClient();

  if (!client) {
    throw new Error('Google Cloud Storage is not configured or enabled');
  }

  const { bucket } = client;

  try {
    await bucket.file(fileName).delete();
    adminLogger.info('File deleted from GCS', { fileName });
    return true;
  } catch (error) {
    adminLogger.error('Failed to delete file from GCS', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get a signed URL for a file
 */
export async function getSignedUrl(
  fileName: string,
  expiresInMinutes: number = 60
): Promise<string | null> {
  const client = await getGcsClient();

  if (!client) {
    return null;
  }

  const { bucket } = client;

  try {
    const [signedUrl] = await bucket.file(fileName).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return signedUrl;
  } catch (error) {
    adminLogger.error('Failed to generate signed URL', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * List files in a folder
 */
export async function listFiles(
  folder?: string,
  maxResults: number = 100
): Promise<{ name: string; size: number; updated: Date }[]> {
  const client = await getGcsClient();

  if (!client) {
    return [];
  }

  const { bucket } = client;

  try {
    const [files] = await bucket.getFiles({
      prefix: folder,
      maxResults,
    });

    return files.map((file) => ({
      name: file.name,
      size: parseInt(file.metadata.size as string, 10) || 0,
      updated: new Date(file.metadata.updated as string),
    }));
  } catch (error) {
    adminLogger.error('Failed to list files from GCS', {
      folder,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Check if GCS is configured and enabled
 */
export async function isGcsEnabled(): Promise<boolean> {
  const config = await getGcsConfig();
  return config !== null && config.enabled;
}

/**
 * Test GCS connection with provided configuration
 */
export async function testGcsConnection(config: GcsConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedKey = formatPrivateKey(config.privateKey);

    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----') ||
        !formattedKey.includes('-----END PRIVATE KEY-----')) {
      return {
        success: false,
        error: 'Invalid private key format. The key should start with "-----BEGIN PRIVATE KEY-----" and end with "-----END PRIVATE KEY-----"'
      };
    }

    const credentials = {
      type: 'service_account' as const,
      project_id: config.projectId,
      client_email: config.clientEmail,
      private_key: formattedKey,
    };

    const storage = new Storage({
      projectId: config.projectId,
      credentials,
    });

    const bucket = storage.bucket(config.bucketName);
    const [exists] = await bucket.exists();

    if (!exists) {
      return { success: false, error: `Bucket "${config.bucketName}" does not exist or is not accessible` };
    }

    await bucket.getMetadata();

    return { success: true };
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);

    if (message.includes('DECODER') || message.includes('unsupported')) {
      message = 'Private key format error. Please ensure you copied the entire private_key value from the JSON file.';
    } else if (message.includes('invalid_grant')) {
      message = 'Invalid credentials. Please verify the service account email matches the private key.';
    } else if (message.includes('ENOTFOUND') || message.includes('network')) {
      message = 'Network error. Please check your internet connection.';
    }

    adminLogger.error('GCS connection test failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return { success: false, error: message };
  }
}
