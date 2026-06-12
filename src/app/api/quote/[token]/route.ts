import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { trackEntityActivity, trackQuoteFunnelEvent } from '@/lib/analytics';
import { notifyQuoteOwnerStatusChange } from '@/lib/notifications';
import { logQuoteStatusChange } from '@/lib/quote-audit';
import { activateCustomerOnApproval } from '@/lib/customer-status';

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

    // Check token expiry
    if (quote.accessTokenExpiresAt && new Date(quote.accessTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'This quote link has expired.' }, { status: 410 });
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

    // Check token expiry
    if (quote.accessTokenExpiresAt && new Date(quote.accessTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'This quote link has expired.' }, { status: 410 });
    }

    // A customer may approve/decline from the main quote link whether the quote
    // is simply SENT or is in any artwork stage — as long as they have not
    // already responded. This keeps the main link and the artwork-token flow in
    // sync (previously an ARTWORK_* quote could not be approved here at all).
    if (quote.approvedAt || quote.declinedAt) {
      return NextResponse.json(
        { error: 'You have already responded to this quote.' },
        { status: 400 }
      );
    }

    const respondableStatuses = ['SENT', 'ARTWORK_PENDING', 'ARTWORK_APPROVED', 'ARTWORK_DECLINED'];
    if (!respondableStatuses.includes(quote.status)) {
      return NextResponse.json(
        { error: `This quote cannot be responded to in its current state (${quote.status.toLowerCase()}).` },
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

    // Atomic guard against a concurrent double-submit: only the first request
    // whose row still has no approvedAt/declinedAt wins.
    const updateResult = await prisma.quote.updateMany({
      where: { accessToken: token, approvedAt: null, declinedAt: null },
      data: {
        status: newStatus,
        approvedAt: action === 'approve' ? timestamp : null,
        declinedAt: action === 'decline' ? timestamp : null,
        lastModifiedAt: timestamp,
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'You have already responded to this quote.' },
        { status: 400 }
      );
    }

    const updatedQuote = { status: newStatus };

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

    // Promote the linked customer from LEAD/PROSPECT to ACTIVE on approval.
    if (action === 'approve') {
      await activateCustomerOnApproval(quote.customerId);
    }

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
