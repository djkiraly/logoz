import { headers } from 'next/headers';

/**
 * Check if a URL is a localhost URL
 */
function isLocalhostUrl(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Get the base URL for the application.
 *
 * Priority:
 * 1. SITE_URL environment variable (server-side, recommended for production)
 * 2. NEXT_PUBLIC_SITE_URL environment variable (if not localhost)
 * 3. Request headers (x-forwarded-proto + host)
 * 4. Fallback to http://localhost:3000
 *
 * For production deployments, set SITE_URL (or NEXT_PUBLIC_SITE_URL) to your domain
 * (e.g., https://yourdomain.com) to ensure email links work correctly.
 */
export async function getBaseUrl(): Promise<string> {
  // First priority: Use SITE_URL (server-side env var)
  const siteUrl = process.env.SITE_URL;
  if (siteUrl && !isLocalhostUrl(siteUrl)) {
    return siteUrl.replace(/\/$/, '');
  }

  // Second priority: Use NEXT_PUBLIC_SITE_URL
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !isLocalhostUrl(envUrl)) {
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }

  // Third priority: Try to determine from request headers
  try {
    const headersList = await headers();

    // Check for x-forwarded-host first (common in reverse proxy setups)
    const forwardedHost = headersList.get('x-forwarded-host');
    const host = forwardedHost || headersList.get('host');

    // Check for protocol
    const forwardedProto = headersList.get('x-forwarded-proto');

    if (host && !isLocalhostUrl(host)) {
      // For non-localhost hosts, default to https
      const protocol = forwardedProto || 'https';
      return `${protocol}://${host}`;
    }
  } catch {
    // Headers might not be available in some contexts
  }

  // Fallback for development
  return 'http://localhost:3000';
}

/**
 * Synchronous version for use in client-side code or when headers aren't available.
 * Only uses environment variables.
 */
export function getBaseUrlSync(): string {
  // Try SITE_URL first (server-side)
  const siteUrl = process.env.SITE_URL;
  if (siteUrl && !isLocalhostUrl(siteUrl)) {
    return siteUrl.replace(/\/$/, '');
  }

  // Then try NEXT_PUBLIC_SITE_URL
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !isLocalhostUrl(envUrl)) {
    return envUrl.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}
