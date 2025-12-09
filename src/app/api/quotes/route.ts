import { NextResponse } from 'next/server';
import { FulfillmentMethod } from '@prisma/client';
import { quoteSchema } from '@/lib/validation';
import { isDatabaseEnabled, prisma } from '@/lib/prisma';
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from '@/lib/rate-limit';
import {
  handleApiError,
  validateRequest,
  ApiException,
  getCacheHeaders,
} from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    validateRequest(request, { allowedMethods: ['GET'] });

    if (!isDatabaseEnabled) {
      return NextResponse.json({ data: [] });
    }

    const quotes = await prisma.quoteRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      { data: quotes },
      {
        headers: {
          ...getCacheHeaders({ maxAge: 0 }), // No caching for sensitive data
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const reqLogger = createRequestLogger(request);
  reqLogger.info('Quote request received');

  try {
    validateRequest(request, {
      allowedMethods: ['POST'],
      requireContentType: 'application/json',
    });

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(clientIp);

    if (!rateLimitResult.success) {
      reqLogger.warn('Rate limit exceeded', { clientIp });
      throw new ApiException(
        'Too many quote requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
        {
          limit: rateLimitResult.limit,
          reset: new Date(rateLimitResult.reset).toISOString(),
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = quoteSchema.safeParse({
      ...body,
      quantity: Number(body.quantity),
    });

    if (!parsed.success) {
      reqLogger.warn('Quote validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const payload = parsed.data;

    if (isDatabaseEnabled) {
      // Check for duplicate quote in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const existingQuote = await prisma.quoteRequest.findFirst({
        where: {
          email: payload.email,
          serviceType: payload.service as FulfillmentMethod,
          quantity: payload.quantity,
          createdAt: {
            gte: fiveMinutesAgo,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingQuote) {
        reqLogger.info('Duplicate quote detected', {
          quoteId: existingQuote.id,
          email: existingQuote.email,
        });

        return NextResponse.json(
          {
            ok: true,
            duplicate: true,
            message: 'This quote was already submitted recently',
          },
          {
            status: 200,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }

      // Create new quote
      const quote = await prisma.quoteRequest.create({
        data: {
          contactName: payload.name,
          company: payload.company,
          email: payload.email,
          phone: payload.phone,
          quantity: payload.quantity,
          serviceType: payload.service as FulfillmentMethod,
          notes: payload.notes,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        },
      });

      reqLogger.info('Quote created successfully', {
        quoteId: quote.id,
        email: quote.email,
        service: quote.serviceType,
      });
    } else {
      reqLogger.info('Quote request processed (no database)', {
        email: payload.email,
        service: payload.service,
      });
    }

    return NextResponse.json(
      { ok: true },
      {
        status: 201,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  } catch (error) {
    reqLogger.error('Quote request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error);
  }
}
