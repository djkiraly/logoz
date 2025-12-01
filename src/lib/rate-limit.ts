import { LRUCache } from 'lru-cache';

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

type RateLimitConfig = {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Max requests per interval
};

// Default: 5 requests per hour for quote submissions
const DEFAULT_CONFIG: RateLimitConfig = {
  interval: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
};

// Store rate limit entries in LRU cache
const rateLimitCache = new LRUCache<string, RateLimitEntry>({
  max: 10000, // Max 10k unique identifiers
  ttl: DEFAULT_CONFIG.interval, // Auto-expire after interval
});

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Check rate limit for an identifier (IP address or user ID)
 *
 * @param identifier - Unique identifier for rate limiting (usually IP)
 * @param config - Optional custom rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = rateLimitCache.get(identifier);

  // No existing entry - first request
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.interval,
    };
    rateLimitCache.set(identifier, newEntry);

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: newEntry.resetTime,
    };
  }

  // Existing entry - check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitCache.set(identifier, entry);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client IP address from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: Request): string {
  // Check various headers for real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return 'unknown';
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Clear rate limit for an identifier (useful for testing)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitCache.delete(identifier);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitCache.clear();
}
