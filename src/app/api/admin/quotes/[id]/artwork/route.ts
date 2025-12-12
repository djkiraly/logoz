import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import {
  logArtworkUploaded,
  logArtworkSentToCustomer,
  logArtworkUpdated,
  logQuoteStatusChange,
} from '@/lib/quote-audit';
import { notifyArtworkForApproval } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const artworkUploadSchema = z.object({
  // Allow both full URLs and relative paths (e.g., /api/images/...)
  artworkUrl: z.string().min(1, 'Artwork URL is required'),
  artworkFileName: z.string().min(1, 'Filename is required').max(255),
});

const sendArtworkSchema = z.object({
  sendEmail: z.boolean().default(true),
});

// Helper to build base URL from request
function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

// GET - Get artwork details for a quote
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteNumber: true,
        artworkRequired: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkToken: true,
        artworkSentAt: true,
        artworkApprovedAt: true,
        artworkDeclinedAt: true,
        artworkNotes: true,
        artworkVersion: true,
        status: true,
        customerEmail: true,
        customer: {
          select: {
            email: true,
            contactName: true,
          },
        },
      },
    });

    if (!quote) {
      throw new ApiException('Quote not found', 404, 'NOT_FOUND');
    }

    // Build public URL for artwork approval
    const baseUrl = getBaseUrl(request);
    const artworkApprovalUrl = quote.artworkToken
      ? `${baseUrl}/artwork/${quote.artworkToken}`
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        ...quote,
        artworkApprovalUrl,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Upload artwork to a quote
export async function POST(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteNumber: true,
        artworkRequired: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkToken: true,
        artworkVersion: true,
        artworkSentAt: true,
        artworkApprovedAt: true,
        artworkDeclinedAt: true,
        artworkNotes: true,
        status: true,
      },
    });

    if (!quote) {
      throw new ApiException('Quote not found', 404, 'NOT_FOUND');
    }

    const body = await request.json();
    const parsed = artworkUploadSchema.safeParse(body);

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

    const { artworkUrl, artworkFileName } = parsed.data;
    const isUpdate = !!quote.artworkUrl;
    const newVersion = isUpdate ? quote.artworkVersion + 1 : 1;

    // If there's existing artwork, archive it to version history
    if (isUpdate && quote.artworkUrl && quote.artworkFileName) {
      // Determine the status of the previous artwork
      let previousStatus = 'PENDING';
      if (quote.artworkApprovedAt) {
        previousStatus = 'APPROVED';
      } else if (quote.artworkDeclinedAt) {
        previousStatus = 'DECLINED';
      } else if (quote.artworkSentAt) {
        previousStatus = 'SENT';
      }

      // Save previous version to history
      await prisma.artworkVersion.create({
        data: {
          quoteId: quote.id,
          version: quote.artworkVersion,
          url: quote.artworkUrl,
          fileName: quote.artworkFileName,
          status: previousStatus,
          sentAt: quote.artworkSentAt,
          approvedAt: quote.artworkApprovedAt,
          declinedAt: quote.artworkDeclinedAt,
          customerNotes: quote.artworkNotes,
          uploadedById: user.id,
          uploadedByName: user.name,
          uploadedByEmail: user.email,
        },
      });
    }

    // Generate artwork token if not exists
    const artworkToken = quote.artworkToken
      ? undefined // Keep existing token
      : crypto.randomBytes(32).toString('hex');

    // Update quote with new artwork
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: {
        artworkRequired: true,
        artworkUrl,
        artworkFileName,
        artworkVersion: newVersion,
        artworkSentAt: null, // Reset - new artwork hasn't been sent yet
        artworkApprovedAt: null, // Reset approval when new artwork uploaded
        artworkDeclinedAt: null,
        artworkNotes: null,
        ...(artworkToken && { artworkToken }),
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        quoteNumber: true,
        artworkRequired: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkToken: true,
        artworkVersion: true,
        status: true,
      },
    });

    // Log audit
    const actor = { id: user.id, name: user.name, email: user.email };
    if (isUpdate) {
      await logArtworkUpdated(
        quote.id,
        quote.quoteNumber,
        quote.artworkFileName,
        artworkFileName,
        newVersion,
        actor,
        artworkUrl,
        quote.artworkUrl
      );
    } else {
      await logArtworkUploaded(quote.id, quote.quoteNumber, artworkFileName, newVersion, actor, artworkUrl);
    }

    reqLogger.info('Artwork uploaded', {
      userId: user.id,
      quoteId: quote.id,
      artworkFileName,
      version: newVersion,
    });

    // Build public URL
    const baseUrl = getBaseUrl(request);
    const artworkApprovalUrl = `${baseUrl}/artwork/${updatedQuote.artworkToken}`;

    return NextResponse.json({
      ok: true,
      data: {
        ...updatedQuote,
        artworkApprovalUrl,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Send artwork to customer for approval
export async function PUT(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (user.role === 'EDITOR') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteNumber: true,
        title: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkToken: true,
        artworkVersion: true,
        status: true,
        customerEmail: true,
        customer: {
          select: {
            email: true,
            contactName: true,
            companyName: true,
          },
        },
      },
    });

    if (!quote) {
      throw new ApiException('Quote not found', 404, 'NOT_FOUND');
    }

    if (!quote.artworkUrl || !quote.artworkToken) {
      throw new ApiException('No artwork uploaded', 400, 'NO_ARTWORK');
    }

    const customerEmail = quote.customer?.email || quote.customerEmail;
    if (!customerEmail) {
      throw new ApiException('No customer email available', 400, 'NO_CUSTOMER_EMAIL');
    }

    const body = await request.json();
    const parsed = sendArtworkSchema.safeParse(body);

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

    const previousStatus = quote.status;

    // Update quote status to ARTWORK_PENDING
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: {
        status: 'ARTWORK_PENDING',
        artworkSentAt: new Date(),
        artworkApprovedAt: null,
        artworkDeclinedAt: null,
        artworkNotes: null,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        quoteNumber: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkToken: true,
        artworkSentAt: true,
        status: true,
      },
    });

    // Log audit entries
    const actor = { id: user.id, name: user.name, email: user.email };
    await logArtworkSentToCustomer(
      quote.id,
      quote.quoteNumber,
      customerEmail,
      quote.artworkFileName || 'artwork',
      actor
    );

    if (previousStatus !== 'ARTWORK_PENDING') {
      await logQuoteStatusChange(
        quote.id,
        quote.quoteNumber,
        previousStatus,
        'ARTWORK_PENDING',
        { type: 'ADMIN', id: user.id, name: user.name, email: user.email }
      );
    }

    // Build public URL
    const baseUrl = getBaseUrl(request);
    const artworkApprovalUrl = `${baseUrl}/artwork/${updatedQuote.artworkToken}`;

    // Send email notification to customer
    const customerName = quote.customer?.contactName || 'Valued Customer';
    const emailResult = await notifyArtworkForApproval(
      {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        total: 0, // Not needed for artwork email
        status: 'ARTWORK_PENDING',
        customerName,
        customerEmail,
        customerCompany: quote.customer?.companyName,
      },
      {
        url: quote.artworkUrl!,
        fileName: quote.artworkFileName || 'artwork',
        version: quote.artworkVersion,
        approvalUrl: artworkApprovalUrl,
      }
    );

    if (!emailResult.success) {
      reqLogger.warn('Failed to send artwork email', {
        userId: user.id,
        quoteId: quote.id,
        customerEmail,
        error: emailResult.error,
      });
    } else {
      reqLogger.info('Artwork email sent to customer', {
        userId: user.id,
        quoteId: quote.id,
        customerEmail,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...updatedQuote,
        artworkApprovalUrl,
        customerEmail,
      },
      message: emailResult.success
        ? `Artwork sent to ${customerEmail} for approval`
        : `Quote updated but email failed: ${emailResult.error}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Remove artwork from quote
export async function DELETE(request: Request, context: RouteContext) {
  const reqLogger = createRequestLogger(request);

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (user.role !== 'SUPER_ADMIN') {
      throw new ApiException('Insufficient permissions', 403, 'FORBIDDEN');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteNumber: true,
        artworkFileName: true,
        status: true,
      },
    });

    if (!quote) {
      throw new ApiException('Quote not found', 404, 'NOT_FOUND');
    }

    // Reset artwork fields
    await prisma.quote.update({
      where: { id },
      data: {
        artworkUrl: null,
        artworkFileName: null,
        artworkToken: null,
        artworkSentAt: null,
        artworkApprovedAt: null,
        artworkDeclinedAt: null,
        artworkNotes: null,
        artworkVersion: 1,
        // Don't change artworkRequired - that's a quote setting
        // Revert status if it was artwork-related
        ...(quote.status === 'ARTWORK_PENDING' ||
        quote.status === 'ARTWORK_APPROVED' ||
        quote.status === 'ARTWORK_DECLINED'
          ? { status: 'PENDING' }
          : {}),
        lastModifiedAt: new Date(),
      },
    });

    reqLogger.info('Artwork removed from quote', {
      userId: user.id,
      quoteId: quote.id,
    });

    return NextResponse.json({
      ok: true,
      message: 'Artwork removed successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
