import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// GET /api/admin/customers - List all customers
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
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    // Build where clause
    const where: Prisma.CustomerWhereInput = {};

    if (status) {
      where.status = status as Prisma.EnumCustomerStatusFilter['equals'];
    }

    if (type) {
      where.customerType = type as Prisma.EnumCustomerTypeFilter['equals'];
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, data: customers });
  } catch (error) {
    adminLogger.error('Failed to fetch customers', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// POST /api/admin/customers - Create a new customer
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
    } = body;

    // Validate required fields
    if (!contactName || !email) {
      return NextResponse.json(
        { error: 'Contact name and email are required' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'A customer with this email already exists' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        companyName: companyName || null,
        customerType: customerType || 'BUSINESS',
        website: website || null,
        industry: industry || null,
        employeeCount: employeeCount || null,
        annualRevenue: annualRevenue || null,
        contactName,
        contactTitle: contactTitle || null,
        email,
        phone: phone || null,
        mobilePhone: mobilePhone || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        country: country || 'USA',
        shippingAddressLine1: shippingAddressLine1 || null,
        shippingAddressLine2: shippingAddressLine2 || null,
        shippingCity: shippingCity || null,
        shippingState: shippingState || null,
        shippingPostalCode: shippingPostalCode || null,
        shippingCountry: shippingCountry || null,
        status: status || 'LEAD',
        source: source || null,
        assignedTo: assignedTo || null,
        tags: tags || [],
        taxExempt: taxExempt ?? false,
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        creditLimit: creditLimit ? new Prisma.Decimal(creditLimit) : null,
        preferredContact: preferredContact || null,
        marketingOptIn: marketingOptIn ?? true,
        notes: notes || null,
      },
    });

    adminLogger.info('Customer created', {
      userId: user.id,
      customerId: customer.id,
      email: customer.email,
    });

    return NextResponse.json({ ok: true, data: customer }, { status: 201 });
  } catch (error) {
    adminLogger.error('Failed to create customer', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create customer' },
      { status: 500 }
    );
  }
}
