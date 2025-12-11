import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { trackEntityActivity, trackQuoteFunnelEvent } from '@/lib/analytics';
import { notifyQuoteOwnerStatusChange } from '@/lib/notifications';
import { logQuoteStatusChange } from '@/lib/quote-audit';

type RouteParams = {
  params: Promise<{ token: string }>;
};

// GET /api/quote/[token] - Get quote by access token (public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { token } = await params;

    const quote = await prisma.quote.findUnique({
      where: { accessToken: token },
      include: {
        customer: {
          select: {
            contactName: true,
            companyName: true,
            email: true,
          },
        },
        lineItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Don't expose internal fields
    const publicQuote = {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      customerName: quote.customer?.contactName || quote.customerName,
      customerCompany: quote.customer?.companyName || quote.customerCompany,
      notes: quote.notes,
      validUntil: quote.validUntil,
      requestedDelivery: quote.requestedDelivery,
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax: quote.tax,
      shipping: quote.shipping,
      total: quote.total,
      status: quote.status,
      sentAt: quote.sentAt,
      approvedAt: quote.approvedAt,
      declinedAt: quote.declinedAt,
      lineItems: quote.lineItems.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };

    return NextResponse.json({ ok: true, data: publicQuote });
  } catch (error) {
    adminLogger.error('Failed to fetch public quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

// POST /api/quote/[token] - Approve or decline quote (public)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { token } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['approve', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "decline".' },
        { status: 400 }
      );
    }

    const quote = await prisma.quote.findUnique({
      where: { accessToken: token },
      include: {
        customer: {
          select: {
            contactName: true,
            companyName: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check if quote is in SENT status (can only approve/decline sent quotes)
    if (quote.status !== 'SENT') {
      return NextResponse.json(
        { error: `This quote has already been ${quote.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    // Check if quote is still valid
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return NextResponse.json(
        { error: 'This quote has expired and is no longer valid.' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'DECLINED';
    const timestamp = new Date();

    const updatedQuote = await prisma.quote.update({
      where: { accessToken: token },
      data: {
        status: newStatus,
        approvedAt: action === 'approve' ? timestamp : null,
        declinedAt: action === 'decline' ? timestamp : null,
        lastModifiedAt: timestamp,
      },
    });

    adminLogger.info(`Quote ${action}d by customer`, {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      action,
    });

    // Log audit trail - customer action
    await logQuoteStatusChange(
      quote.id,
      quote.quoteNumber,
      quote.status,
      newStatus,
      { type: 'CUSTOMER' }
    );

    // Track activity
    await trackEntityActivity({
      entityType: 'QUOTE',
      entityId: quote.id,
      activityType: 'STATUS_CHANGED',
      oldValue: { status: quote.status },
      newValue: { status: newStatus, by: 'customer' },
    });

    // Track funnel event
    await trackQuoteFunnelEvent({
      stage: action === 'approve' ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
      quoteId: quote.id,
      customerId: quote.customerId || undefined,
    });

    // Notify quote owner of the status change
    if (quote.owner) {
      const quoteContext = {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        total: quote.total.toString(),
        status: newStatus,
        customerName: quote.customer?.contactName || quote.customerName,
        customerCompany: quote.customer?.companyName || quote.customerCompany,
        title: quote.title,
      };

      await notifyQuoteOwnerStatusChange(
        quoteContext,
        quote.owner,
        quote.status,
        newStatus
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        status: updatedQuote.status,
        message: action === 'approve'
          ? 'Thank you! Your quote has been approved. We will be in touch shortly.'
          : 'Quote declined. If you have any questions or would like to discuss alternatives, please contact us.',
      },
    });
  } catch (error) {
    adminLogger.error('Failed to update quote status', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update quote' },
      { status: 500 }
    );
  }
}
