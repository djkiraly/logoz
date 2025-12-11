import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';

// GET /api/admin/customers/lookup?email=... - Lookup customer by email
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const email = request.nextUrl.searchParams.get('email');

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Normalize email for lookup
    const normalizedEmail = email.trim().toLowerCase();

    const customer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
        mobilePhone: true,
        customerType: true,
        status: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ ok: true, found: false, data: null });
    }

    adminLogger.info('Customer lookup by email', {
      userId: user.id,
      email: normalizedEmail,
      found: true,
      customerId: customer.id,
    });

    return NextResponse.json({ ok: true, found: true, data: customer });
  } catch (error) {
    adminLogger.error('Failed to lookup customer', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to lookup customer' }, { status: 500 });
  }
}
