import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/customers/[id] - Get a single customer
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

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: customer });
  } catch (error) {
    adminLogger.error('Failed to fetch customer', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}

// PUT /api/admin/customers/[id] - Update a customer
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

    // Check customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const {
      companyName,
      customerType,
      website,
      industry,
      employeeCount,
      annualRevenue,
      contactName,
      contactTitle,
      email,
      phone,
      mobilePhone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      shippingAddressLine1,
      shippingAddressLine2,
      shippingCity,
      shippingState,
      shippingPostalCode,
      shippingCountry,
      status,
      source,
      assignedTo,
      tags,
      taxExempt,
      taxId,
      paymentTerms,
      creditLimit,
      preferredContact,
      marketingOptIn,
      notes,
      lastContactAt,
    } = body;

    // Check for duplicate email if changed
    if (email && email !== existingCustomer.email) {
      const duplicateEmail = await prisma.customer.findUnique({
        where: { email },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'A customer with this email already exists' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Prisma.CustomerUpdateInput = {};

    if (companyName !== undefined) updateData.companyName = companyName || null;
    if (customerType !== undefined) updateData.customerType = customerType;
    if (website !== undefined) updateData.website = website || null;
    if (industry !== undefined) updateData.industry = industry || null;
    if (employeeCount !== undefined) updateData.employeeCount = employeeCount || null;
    if (annualRevenue !== undefined) updateData.annualRevenue = annualRevenue || null;
    if (contactName !== undefined) updateData.contactName = contactName;
    if (contactTitle !== undefined) updateData.contactTitle = contactTitle || null;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (mobilePhone !== undefined) updateData.mobilePhone = mobilePhone || null;
    if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1 || null;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2 || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (postalCode !== undefined) updateData.postalCode = postalCode || null;
    if (country !== undefined) updateData.country = country || null;
    if (shippingAddressLine1 !== undefined) updateData.shippingAddressLine1 = shippingAddressLine1 || null;
    if (shippingAddressLine2 !== undefined) updateData.shippingAddressLine2 = shippingAddressLine2 || null;
    if (shippingCity !== undefined) updateData.shippingCity = shippingCity || null;
    if (shippingState !== undefined) updateData.shippingState = shippingState || null;
    if (shippingPostalCode !== undefined) updateData.shippingPostalCode = shippingPostalCode || null;
    if (shippingCountry !== undefined) updateData.shippingCountry = shippingCountry || null;
    if (status !== undefined) updateData.status = status;
    if (source !== undefined) updateData.source = source || null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (tags !== undefined) updateData.tags = tags;
    if (taxExempt !== undefined) updateData.taxExempt = taxExempt;
    if (taxId !== undefined) updateData.taxId = taxId || null;
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms || null;
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit ? new Prisma.Decimal(creditLimit) : null;
    if (preferredContact !== undefined) updateData.preferredContact = preferredContact || null;
    if (marketingOptIn !== undefined) updateData.marketingOptIn = marketingOptIn;
    if (notes !== undefined) updateData.notes = notes || null;
    if (lastContactAt !== undefined) updateData.lastContactAt = lastContactAt ? new Date(lastContactAt) : null;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    adminLogger.info('Customer updated', {
      userId: user.id,
      customerId: customer.id,
      email: customer.email,
    });

    return NextResponse.json({ ok: true, data: customer });
  } catch (error) {
    adminLogger.error('Failed to update customer', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/customers/[id] - Delete a customer
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

    // Check customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await prisma.customer.delete({
      where: { id },
    });

    adminLogger.info('Customer deleted', {
      userId: user.id,
      customerId: id,
      email: existingCustomer.email,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    adminLogger.error('Failed to delete customer', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
