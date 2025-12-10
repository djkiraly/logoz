import { headers } from 'next/headers';

/**
 * Get the base URL for the application.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL environment variable (recommended for production)
 * 2. Request headers (x-forwarded-proto + host)
 * 3. Fallback to localhost:3000
 *
 * For production deployments, always set NEXT_PUBLIC_SITE_URL to your domain
 * (e.g., https://yourdomain.com) to ensure email links work correctly.
 */
export async function getBaseUrl(): Promise<string> {
  // First priority: Use environment variable if set (recommended for production)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && envUrl !== 'http://localhost:3000') {
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }

  // Second priority: Try to determine from request headers
  try {
    const headersList = await headers();

    // Check for x-forwarded-host first (common in reverse proxy setups)
    const forwardedHost = headersList.get('x-forwarded-host');
    const host = forwardedHost || headersList.get('host');

    // Check for protocol
    const forwardedProto = headersList.get('x-forwarded-proto');

    if (host && host !== 'localhost:3000') {
      // Determine protocol - default to https for production hosts
      let protocol = forwardedProto || 'https';

      // If host doesn't contain localhost, assume https
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        protocol = 'https';
      }

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
 * Only uses the environment variable.
 */
export function getBaseUrlSync(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}
