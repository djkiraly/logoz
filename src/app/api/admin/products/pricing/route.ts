import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/admin/products/pricing - current global default markup %.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const setting = await prisma.siteSetting.findUnique({
    where: { id: 1 },
    select: { defaultMarkupPercent: true },
  });
  return NextResponse.json({
    ok: true,
    data: { defaultMarkupPercent: setting?.defaultMarkupPercent ?? 0 },
  });
}

// PUT /api/admin/products/pricing - set the global default markup %.
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(user, 'ADMIN')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const body = await request.json();
  const value = Number(body.defaultMarkupPercent);
  if (!Number.isFinite(value) || value < 0 || value > 1000) {
    return NextResponse.json(
      { error: 'defaultMarkupPercent must be a number between 0 and 1000' },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.siteSetting.update({
      where: { id: 1 },
      data: { defaultMarkupPercent: value },
      select: { defaultMarkupPercent: true },
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Site settings not initialized yet. Save Settings once, then retry.' },
        { status: 400 }
      );
    }
    adminLogger.error('Failed to update default markup', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update markup' }, { status: 500 });
  }
}

// POST /api/admin/products/pricing - recalculate public prices from cost.
//
// For every product that has a cost and is NOT price-overridden, sets
// basePrice = cost x (1 + markup/100), where markup is the product's category
// markupPercent, falling back to the global default. Optionally scope to one
// category via { categoryId }.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(user, 'ADMIN')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  let body: { categoryId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body = recalculate all categories
  }

  const setting = await prisma.siteSetting.findUnique({
    where: { id: 1 },
    select: { defaultMarkupPercent: true },
  });
  const defaultMarkup = setting?.defaultMarkupPercent ?? 0;

  const categories = await prisma.category.findMany({
    where: body.categoryId ? { id: body.categoryId } : undefined,
    select: { id: true, markupPercent: true },
  });

  let updated = 0;
  for (const category of categories) {
    const markup = category.markupPercent ?? defaultMarkup;
    // One UPDATE per category — fast, and never touches overridden products.
    const count = await prisma.$executeRaw`
      UPDATE "Product"
      SET "basePrice" = "cost" * (1 + (${markup}::float8 / 100))
      WHERE "categoryId" = ${category.id}
        AND "priceOverridden" = false
        AND "cost" IS NOT NULL
    `;
    updated += count;
  }

  adminLogger.info('Recalculated product prices', {
    userId: user.id,
    categoriesProcessed: categories.length,
    productsUpdated: updated,
    scopedCategoryId: body.categoryId ?? null,
  });

  return NextResponse.json({
    ok: true,
    data: { updated, categoriesProcessed: categories.length },
  });
}
