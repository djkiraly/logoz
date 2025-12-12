import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import {
  logArtworkApprovedByCustomer,
  logArtworkDeclinedByCustomer,
  logQuoteStatusChange,
  logQuoteApprovedByCustomer,
  logQuoteDeclinedByCustomer,
} from '@/lib/quote-audit';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string }>;
};

const artworkResponseSchema = z.object({
  action: z.enum(['approve', 'decline']),
  notes: z.string().max(2000).optional(),
  type: z.enum(['artwork', 'quote']).default('artwork'),
});

// GET - Get artwork details for public viewing
export async function GET(request: Request, context: RouteContext) {
  try {
    if (!isDatabaseEnabled) {
      throw new ApiException('Service unavailable', 503, 'SERVICE_UNAVAILABLE');
    }

    const { token } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { artworkToken: token },
      select: {
        id: true,
        quoteNumber: true,
        title: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkVersion: true,
        artworkSentAt: true,
        artworkApprovedAt: true,
        artworkDeclinedAt: true,
        artworkNotes: true,
        status: true,
        approvedAt: true,
        declinedAt: true,
        customerName: true,
        customerCompany: true,
        customer: {
          select: {
            contactName: true,
            companyName: true,
          },
        },
        lineItems: {
          select: {
            name: true,
            description: true,
            quantity: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new ApiException('Artwork not found or link expired', 404, 'NOT_FOUND');
    }

    // Check if artwork was sent
    if (!quote.artworkSentAt) {
      throw new ApiException('Artwork has not been shared yet', 400, 'NOT_SHARED');
    }

    // Determine response state
    let responseState: 'pending' | 'approved' | 'declined' = 'pending';
    if (quote.artworkApprovedAt) {
      responseState = 'approved';
    } else if (quote.artworkDeclinedAt) {
      responseState = 'declined';
    }

    // Build customer display name
    const customerName =
      quote.customer?.contactName ||
      quote.customerName ||
      quote.customer?.companyName ||
      quote.customerCompany ||
      'Customer';

    // Determine quote approval state
    let quoteState: 'pending' | 'approved' | 'declined' = 'pending';
    if (quote.approvedAt) {
      quoteState = 'approved';
    } else if (quote.declinedAt) {
      quoteState = 'declined';
    }

    return NextResponse.json({
      ok: true,
      data: {
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        customerName,
        companyName: quote.customer?.companyName || quote.customerCompany,
        artworkUrl: quote.artworkUrl,
        artworkFileName: quote.artworkFileName,
        artworkVersion: quote.artworkVersion,
        artworkSentAt: quote.artworkSentAt,
        responseState,
        respondedAt: quote.artworkApprovedAt || quote.artworkDeclinedAt,
        notes: quote.artworkNotes,
        quoteStatus: quote.status,
        quoteState,
        quoteApprovedAt: quote.approvedAt,
        quoteDeclinedAt: quote.declinedAt,
        lineItems: quote.lineItems.map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Submit artwork approval or decline
export async function POST(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    if (!isDatabaseEnabled) {
      throw new ApiException('Service unavailable', 503, 'SERVICE_UNAVAILABLE');
    }

    const { token } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { artworkToken: token },
      select: {
        id: true,
        quoteNumber: true,
        artworkUrl: true,
        artworkSentAt: true,
        artworkApprovedAt: true,
        artworkDeclinedAt: true,
        approvedAt: true,
        declinedAt: true,
        status: true,
        customerEmail: true,
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!quote) {
      throw new ApiException('Artwork not found or link expired', 404, 'NOT_FOUND');
    }

    if (!quote.artworkSentAt) {
      throw new ApiException('Artwork has not been shared yet', 400, 'NOT_SHARED');
    }

    const body = await request.json();
    const parsed = artworkResponseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { action, notes, type } = parsed.data;
    const customerEmail = quote.customer?.email || quote.customerEmail || 'unknown';
    const previousStatus = quote.status;
    const isApproved = action === 'approve';

    // Handle quote approval/decline
    if (type === 'quote') {
      // Check if artwork is approved first
      if (!quote.artworkApprovedAt) {
        throw new ApiException(
          'Please approve the artwork first before approving the quote.',
          400,
          'ARTWORK_NOT_APPROVED'
        );
      }

      // Check if quote already responded
      if (quote.approvedAt || quote.declinedAt) {
        throw new ApiException(
          'You have already responded to this quote. Please contact us if you need to make changes.',
          400,
          'ALREADY_RESPONDED'
        );
      }

      const newStatus = isApproved ? 'APPROVED' : 'DECLINED';

      // Update quote
      const updatedQuote = await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: newStatus,
          approvedAt: isApproved ? new Date() : null,
          declinedAt: !isApproved ? new Date() : null,
          lastModifiedAt: new Date(),
        },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          approvedAt: true,
          declinedAt: true,
        },
      });

      // Log audit entries
      if (isApproved) {
        await logQuoteApprovedByCustomer(quote.id, quote.quoteNumber, customerEmail);
      } else {
        await logQuoteDeclinedByCustomer(quote.id, quote.quoteNumber, customerEmail, notes);
      }

      await logQuoteStatusChange(quote.id, quote.quoteNumber, previousStatus, newStatus, {
        type: 'CUSTOMER',
        email: customerEmail,
      });

      reqLogger.info('Customer responded to quote', {
        quoteId: quote.id,
        action,
        customerEmail,
      });

      return NextResponse.json({
        ok: true,
        data: {
          action,
          type: 'quote',
          respondedAt: isApproved ? updatedQuote.approvedAt : updatedQuote.declinedAt,
        },
        message: isApproved
          ? 'Thank you! Your quote has been approved. We will begin processing your order.'
          : 'Thank you for your feedback. Please contact us to discuss your requirements.',
      });
    }

    // Handle artwork approval/decline (existing logic)
    // Check if already responded
    if (quote.artworkApprovedAt || quote.artworkDeclinedAt) {
      throw new ApiException(
        'You have already responded to this artwork. Please contact us if you need to make changes.',
        400,
        'ALREADY_RESPONDED'
      );
    }

    const newStatus = isApproved ? 'ARTWORK_APPROVED' : 'ARTWORK_DECLINED';

    // Update quote
    const updatedQuote = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: newStatus,
        artworkApprovedAt: isApproved ? new Date() : null,
        artworkDeclinedAt: !isApproved ? new Date() : null,
        artworkNotes: notes || null,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        artworkApprovedAt: true,
        artworkDeclinedAt: true,
        artworkNotes: true,
      },
    });

    // Log audit entries
    if (isApproved) {
      await logArtworkApprovedByCustomer(quote.id, quote.quoteNumber, customerEmail, notes);
    } else {
      await logArtworkDeclinedByCustomer(quote.id, quote.quoteNumber, customerEmail, notes);
    }

    await logQuoteStatusChange(quote.id, quote.quoteNumber, previousStatus, newStatus, {
      type: 'CUSTOMER',
      email: customerEmail,
    });

    reqLogger.info('Customer responded to artwork', {
      quoteId: quote.id,
      action,
      customerEmail,
    });

    return NextResponse.json({
      ok: true,
      data: {
        action,
        type: 'artwork',
        respondedAt: isApproved ? updatedQuote.artworkApprovedAt : updatedQuote.artworkDeclinedAt,
      },
      message: isApproved
        ? 'Thank you! Your artwork has been approved.'
        : 'Thank you for your feedback. We will revise the artwork and send you a new version.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
