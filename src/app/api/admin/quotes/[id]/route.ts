import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { trackEntityActivity, trackQuoteFunnelEvent } from '@/lib/analytics';
import type { QuoteFunnelStage } from '@prisma/client';
import {
  logQuoteStatusChange,
  logLineItemsChanged,
  logCustomerChanged,
  logOwnerChanged,
  logPricingUpdated,
  logQuoteUpdated,
} from '@/lib/quote-audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/quotes/[id] - Get a single quote
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          include: {
            product: true,
            supplier: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: quote });
  } catch (error) {
    adminLogger.error('Failed to fetch quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

// PUT /api/admin/quotes/[id] - Update a quote
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check quote exists
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existingQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const {
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      customerCompany,
      title,
      notes,
      internalNotes,
      validUntil,
      requestedDelivery,
      discount,
      discountType,
      taxRate,
      shipping,
      status,
      lineItems,
      ownerId,
      artworkRequired,
    } = body;

    // Calculate totals if line items are provided
    let subtotal = new Prisma.Decimal(0);
    let processedLineItems: Prisma.QuoteLineItemCreateWithoutQuoteInput[] | undefined;

    if (lineItems && Array.isArray(lineItems)) {
      processedLineItems = [];
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const quantity = item.quantity || 1;
        const unitPrice = new Prisma.Decimal(item.unitPrice || 0);
        const itemDiscount = new Prisma.Decimal(item.discount || 0);
        const itemTotal = unitPrice.mul(quantity).sub(itemDiscount);

        subtotal = subtotal.add(itemTotal);

        const lineItem: Prisma.QuoteLineItemCreateWithoutQuoteInput = {
          itemType: item.itemType || 'PRODUCT',
          sku: item.sku || null,
          name: item.name,
          description: item.description || null,
          serviceType: item.serviceType || null,
          serviceOptions: item.serviceOptions || null,
          quantity,
          unitPrice,
          discount: itemDiscount,
          total: itemTotal,
          sortOrder: i,
        };

        if (item.productId) {
          lineItem.product = { connect: { id: item.productId } };
        }
        if (item.supplierId) {
          lineItem.supplier = { connect: { id: item.supplierId } };
        }

        processedLineItems.push(lineItem);
      }
    }

    // Build update data
    const updateData: Prisma.QuoteUpdateInput = {
      lastModifiedAt: new Date(),
    };

    if (customerId !== undefined) {
      updateData.customer = customerId ? { connect: { id: customerId } } : { disconnect: true };
      // Clear manual customer info if linking to customer
      if (customerId) {
        updateData.customerName = null;
        updateData.customerEmail = null;
        updateData.customerPhone = null;
        updateData.customerCompany = null;
      }
    }
    if (!customerId && customerName !== undefined) updateData.customerName = customerName || null;
    if (!customerId && customerEmail !== undefined) updateData.customerEmail = customerEmail || null;
    if (!customerId && customerPhone !== undefined) updateData.customerPhone = customerPhone || null;
    if (!customerId && customerCompany !== undefined) updateData.customerCompany = customerCompany || null;
    if (title !== undefined) updateData.title = title || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null;
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (requestedDelivery !== undefined) updateData.requestedDelivery = requestedDelivery ? new Date(requestedDelivery) : null;
    if (ownerId !== undefined) {
      updateData.owner = ownerId ? { connect: { id: ownerId } } : { disconnect: true };
    }
    if (artworkRequired !== undefined) updateData.artworkRequired = artworkRequired;

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'SENT' && !existingQuote.sentAt) {
        updateData.sentAt = new Date();
      }
      if (status === 'APPROVED' && !existingQuote.approvedAt) {
        updateData.approvedAt = new Date();
      }
    }

    // Recalculate totals if line items or pricing changed
    if (processedLineItems !== undefined || discount !== undefined || taxRate !== undefined || shipping !== undefined || discountType !== undefined) {
      const currentSubtotal = processedLineItems !== undefined ? subtotal : existingQuote.subtotal;
      const currentDiscountType = discountType !== undefined ? discountType : existingQuote.discountType;
      // Use discountValue for user's input, fall back to existing discountValue
      const currentDiscountValue = discount !== undefined ? discount : Number((existingQuote as { discountValue?: unknown }).discountValue || existingQuote.discount);
      const currentTaxRate = taxRate !== undefined ? taxRate : Number(existingQuote.taxRate);
      const currentShipping = shipping !== undefined ? shipping : Number(existingQuote.shipping);

      const discountAmount = currentDiscountType === 'PERCENTAGE'
        ? new Prisma.Decimal(currentSubtotal).mul(currentDiscountValue).div(100)
        : new Prisma.Decimal(currentDiscountValue);

      const afterDiscount = new Prisma.Decimal(currentSubtotal).sub(discountAmount);
      const taxAmount = afterDiscount.mul(currentTaxRate).div(100);
      const total = afterDiscount.add(taxAmount).add(new Prisma.Decimal(currentShipping));

      updateData.subtotal = currentSubtotal;
      updateData.discountValue = new Prisma.Decimal(currentDiscountValue);
      updateData.discount = discountAmount;
      updateData.discountType = currentDiscountType;
      updateData.tax = taxAmount;
      updateData.taxRate = new Prisma.Decimal(currentTaxRate);
      updateData.shipping = new Prisma.Decimal(currentShipping);
      updateData.total = total;
    }

    // Update with line items if provided
    if (processedLineItems !== undefined) {
      // Delete existing line items and create new ones
      await prisma.quoteLineItem.deleteMany({
        where: { quoteId: id },
      });

      updateData.lineItems = {
        create: processedLineItems,
      };
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          include: {
            product: true,
            supplier: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    adminLogger.info('Quote updated', {
      userId: user.id,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
    });

    const actor = { id: user.id, name: user.name, email: user.email };

    // Log audit trail entries based on what changed
    const auditPromises: Promise<void>[] = [];

    // Status change
    if (status !== undefined && status !== existingQuote.status) {
      auditPromises.push(
        logQuoteStatusChange(
          quote.id,
          quote.quoteNumber,
          existingQuote.status,
          status,
          { type: 'ADMIN', id: user.id, name: user.name, email: user.email }
        )
      );
    }

    // Customer change
    if (customerId !== undefined && customerId !== existingQuote.customerId) {
      auditPromises.push(
        logCustomerChanged(
          quote.id,
          quote.quoteNumber,
          { name: existingQuote.customerName, email: existingQuote.customerEmail },
          { name: quote.customerName, email: quote.customerEmail },
          actor
        )
      );
    }

    // Owner change
    if (ownerId !== undefined && ownerId !== existingQuote.ownerId) {
      auditPromises.push(
        logOwnerChanged(
          quote.id,
          quote.quoteNumber,
          existingQuote.ownerId ? { name: 'Previous Owner' } : null,
          quote.owner ? { name: quote.owner.name } : null,
          actor
        )
      );
    }

    // Line items change - compare actual content, not just presence
    if (processedLineItems !== undefined) {
      const prevItems = existingQuote.lineItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      }));
      const newItems = quote.lineItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      }));

      // Only log if line items actually changed
      const lineItemsChanged = JSON.stringify(prevItems) !== JSON.stringify(newItems);
      if (lineItemsChanged) {
        auditPromises.push(
          logLineItemsChanged(quote.id, quote.quoteNumber, prevItems, newItems, actor)
        );
      }
    }

    // Pricing change - only log if values actually changed
    const pricingChanged =
      (discount !== undefined && Number(discount) !== Number(existingQuote.discountValue || existingQuote.discount)) ||
      (taxRate !== undefined && Number(taxRate) !== Number(existingQuote.taxRate)) ||
      (shipping !== undefined && Number(shipping) !== Number(existingQuote.shipping)) ||
      (discountType !== undefined && discountType !== existingQuote.discountType);

    if (pricingChanged) {
      auditPromises.push(
        logPricingUpdated(
          quote.id,
          quote.quoteNumber,
          {
            subtotal: Number(existingQuote.subtotal),
            discount: Number(existingQuote.discount),
            tax: Number(existingQuote.tax),
            total: Number(existingQuote.total),
          },
          {
            subtotal: Number(quote.subtotal),
            discount: Number(quote.discount),
            tax: Number(quote.tax),
            total: Number(quote.total),
          },
          actor
        )
      );
    }

    // General field updates (title, notes, dates) - compare actual values
    const generalChanges: string[] = [];
    if (title !== undefined && title !== existingQuote.title) generalChanges.push('title');
    if (notes !== undefined && notes !== existingQuote.notes) generalChanges.push('notes');
    if (internalNotes !== undefined && internalNotes !== existingQuote.internalNotes) generalChanges.push('internal notes');

    // Compare dates properly (handle null and date string comparison)
    if (validUntil !== undefined) {
      const existingValid = existingQuote.validUntil ? existingQuote.validUntil.toISOString().split('T')[0] : null;
      const newValid = validUntil ? new Date(validUntil).toISOString().split('T')[0] : null;
      if (existingValid !== newValid) generalChanges.push('valid until date');
    }
    if (requestedDelivery !== undefined) {
      const existingDelivery = existingQuote.requestedDelivery ? existingQuote.requestedDelivery.toISOString().split('T')[0] : null;
      const newDelivery = requestedDelivery ? new Date(requestedDelivery).toISOString().split('T')[0] : null;
      if (existingDelivery !== newDelivery) generalChanges.push('requested delivery date');
    }

    // Log general changes even if other audit entries exist
    if (generalChanges.length > 0) {
      auditPromises.push(
        logQuoteUpdated(quote.id, quote.quoteNumber, generalChanges, actor)
      );
    }

    // Execute all audit log promises
    await Promise.all(auditPromises);

    // Track status change activity and funnel events
    if (status !== undefined && status !== existingQuote.status) {
      await trackEntityActivity({
        entityType: 'QUOTE',
        entityId: quote.id,
        activityType: 'STATUS_CHANGED',
        userId: user.id,
        oldValue: { status: existingQuote.status },
        newValue: { status: quote.status },
      });

      // Map quote status to funnel stage
      const statusToFunnelStage: Record<string, QuoteFunnelStage> = {
        'SENT': 'QUOTE_SENT',
        'APPROVED': 'QUOTE_APPROVED',
        'ARCHIVED': 'QUOTE_REJECTED',
      };

      const funnelStage = statusToFunnelStage[status];
      if (funnelStage) {
        await trackQuoteFunnelEvent({
          stage: funnelStage,
          quoteId: quote.id,
          customerId: quote.customerId || undefined,
        });
      }
    } else {
      // Track general update
      await trackEntityActivity({
        entityType: 'QUOTE',
        entityId: quote.id,
        activityType: 'UPDATED',
        userId: user.id,
      });
    }

    return NextResponse.json({ ok: true, data: quote });
  } catch (error) {
    adminLogger.error('Failed to update quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update quote' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/quotes/[id] - Delete a quote (SUPER_ADMIN only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete quotes
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can delete quotes' },
        { status: 403 }
      );
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;

    // Check quote exists
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
    });

    if (!existingQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Delete the quote (line items will cascade delete)
    await prisma.quote.delete({
      where: { id },
    });

    adminLogger.info('Quote deleted', {
      userId: user.id,
      quoteId: id,
      quoteNumber: existingQuote.quoteNumber,
    });

    // Track entity activity
    await trackEntityActivity({
      entityType: 'QUOTE',
      entityId: id,
      activityType: 'DELETED',
      userId: user.id,
      oldValue: { quoteNumber: existingQuote.quoteNumber, status: existingQuote.status },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    adminLogger.error('Failed to delete quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete quote' },
      { status: 500 }
    );
  }
}
