import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// Generate a unique quote number
async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q${year}-`;

  // Find the highest quote number for this year
  const lastQuote = await prisma.quote.findFirst({
    where: {
      quoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quoteNumber: 'desc',
    },
  });

  let nextNumber = 1;
  if (lastQuote) {
    const lastNumber = parseInt(lastQuote.quoteNumber.replace(prefix, ''), 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// GET /api/admin/quotes - List all quotes
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');

    // Build where clause
    const where: Prisma.QuoteWhereInput = {};

    if (status) {
      where.status = status as Prisma.EnumQuoteStatusFilter['equals'];
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerCompany: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
        { customer: { contactName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
          },
        },
        lineItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, data: quotes });
  } catch (error) {
    adminLogger.error('Failed to fetch quotes', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

// POST /api/admin/quotes - Create a new quote
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
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
      lineItems,
    } = body;

    // Validate - need either customerId or customer info
    if (!customerId && !customerName && !customerEmail) {
      return NextResponse.json(
        { error: 'Either select a customer or provide customer name/email' },
        { status: 400 }
      );
    }

    // Generate quote number
    const quoteNumber = await generateQuoteNumber();

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    const processedLineItems: Prisma.QuoteLineItemCreateWithoutQuoteInput[] = [];

    if (lineItems && Array.isArray(lineItems)) {
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

    // Calculate final totals
    const discountAmount = discountType === 'PERCENTAGE'
      ? subtotal.mul(new Prisma.Decimal(discount || 0)).div(100)
      : new Prisma.Decimal(discount || 0);

    const afterDiscount = subtotal.sub(discountAmount);
    const taxAmount = afterDiscount.mul(new Prisma.Decimal(taxRate || 0)).div(100);
    const shippingAmount = new Prisma.Decimal(shipping || 0);
    const total = afterDiscount.add(taxAmount).add(shippingAmount);

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerId: customerId || null,
        customerName: customerId ? null : customerName,
        customerEmail: customerId ? null : customerEmail,
        customerPhone: customerId ? null : customerPhone,
        customerCompany: customerId ? null : customerCompany,
        title: title || null,
        notes: notes || null,
        internalNotes: internalNotes || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        requestedDelivery: requestedDelivery ? new Date(requestedDelivery) : null,
        subtotal,
        discount: discountAmount,
        discountType: discountType || 'FIXED',
        tax: taxAmount,
        taxRate: new Prisma.Decimal(taxRate || 0),
        shipping: shippingAmount,
        total,
        createdBy: user.id,
        lineItems: {
          create: processedLineItems,
        },
      },
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

    adminLogger.info('Quote created', {
      userId: user.id,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
    });

    return NextResponse.json({ ok: true, data: quote }, { status: 201 });
  } catch (error) {
    adminLogger.error('Failed to create quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create quote' },
      { status: 500 }
    );
  }
}
