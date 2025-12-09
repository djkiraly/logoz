import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard API error response format
 */
export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

/**
 * Custom exception class for API errors
 */
export class ApiException extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

/**
 * Handle errors in API routes and return appropriate response
 */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  // Log error with context
  console.error('[API Error]', {
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.flatten(),
      },
      { status: 400 }
    );
  }

  // Handle custom API exceptions
  if (error instanceof ApiException) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: 'Invalid request format',
        code: 'INVALID_JSON',
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors (check for Prisma error codes)
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: unknown };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'A record with this information already exists',
          code: 'DUPLICATE_ENTRY',
        },
        { status: 409 }
      );
    }

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        {
          error: 'Record not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Connection errors
    if (prismaError.code === 'P2024') {
      return NextResponse.json(
        {
          error: 'Database connection timeout',
          code: 'DB_TIMEOUT',
        },
        { status: 503 }
      );
    }
  }

  // Generic internal error
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Validate incoming request
 */
export function validateRequest(
  request: Request,
  options?: {
    allowedMethods?: string[];
    requireContentType?: string;
  }
): void {
  // Validate HTTP method
  if (
    options?.allowedMethods &&
    !options.allowedMethods.includes(request.method)
  ) {
    throw new ApiException(
      `Method ${request.method} not allowed`,
      405,
      'METHOD_NOT_ALLOWED'
    );
  }

  // Validate Content-Type for POST/PUT requests
  if (options?.requireContentType) {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes(options.requireContentType)) {
      throw new ApiException(
        `Content-Type must be ${options.requireContentType}`,
        415,
        'INVALID_CONTENT_TYPE'
      );
    }
  }

  // Validate origin in production
  if (process.env.NODE_ENV === 'production') {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_SITE_URL,
      'https://logoz-cloud.vercel.app',
    ].filter(Boolean);

    // Only validate if origin header is present (API calls may not have it)
    if (origin && !allowedOrigins.some((allowed) => origin.startsWith(allowed || ''))) {
      throw new ApiException('Origin not allowed', 403, 'FORBIDDEN_ORIGIN');
    }
  }
}

/**
 * Create standard success response with caching headers
 */
export type CacheConfig = {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
};

export function getCacheHeaders(config: CacheConfig): Record<string, string> {
  const parts: string[] = [];

  if (config.maxAge !== undefined) {
    parts.push(`max-age=${config.maxAge}`);
  }

  if (config.sMaxAge !== undefined) {
    parts.push(`s-maxage=${config.sMaxAge}`);
  }

  if (config.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (parts.length === 0) {
    return { 'Cache-Control': 'no-store' };
  }

  return {
    'Cache-Control': `public, ${parts.join(', ')}`,
  };
}

/**
 * Create JSON response with standard headers
 */
export function jsonResponse<T>(
  data: T,
  options?: {
    status?: number;
    headers?: Record<string, string>;
    cache?: CacheConfig;
  }
): NextResponse<T> {
  const headers: Record<string, string> = {
    ...options?.headers,
    ...(options?.cache ? getCacheHeaders(options.cache) : {}),
  };

  return NextResponse.json(data, {
    status: options?.status ?? 200,
    headers,
  });
}
