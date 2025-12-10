import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

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
    const updateData: Prisma.QuoteUpdateInput = {};

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
    if (processedLineItems !== undefined || discount !== undefined || taxRate !== undefined || shipping !== undefined) {
      const currentSubtotal = processedLineItems !== undefined ? subtotal : existingQuote.subtotal;
      const currentDiscountType = discountType || existingQuote.discountType;
      const currentDiscount = discount !== undefined ? discount : Number(existingQuote.discount);
      const currentTaxRate = taxRate !== undefined ? taxRate : Number(existingQuote.taxRate);
      const currentShipping = shipping !== undefined ? shipping : Number(existingQuote.shipping);

      const discountAmount = currentDiscountType === 'PERCENTAGE'
        ? new Prisma.Decimal(currentSubtotal).mul(currentDiscount).div(100)
        : new Prisma.Decimal(currentDiscount);

      const afterDiscount = new Prisma.Decimal(currentSubtotal).sub(discountAmount);
      const taxAmount = afterDiscount.mul(currentTaxRate).div(100);
      const total = afterDiscount.add(taxAmount).add(new Prisma.Decimal(currentShipping));

      updateData.subtotal = currentSubtotal;
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

// DELETE /api/admin/quotes/[id] - Delete a quote
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
