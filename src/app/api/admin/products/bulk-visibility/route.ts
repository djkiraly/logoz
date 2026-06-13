import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// POST /api/admin/products/bulk-visibility
// Bulk publish/hide products matching the same filters used by the product
// list (search / categoryId / supplierId / visibility). One UPDATE statement.
//
// Body: { visible: boolean, search?, categoryId?, supplierId?, visibility? }
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireRole(user, 'ADMIN')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const body = await request.json();
  const visible = Boolean(body.visible);
  const search = (body.search || '').trim();
  const categoryId = body.categoryId || undefined;
  const supplierId = body.supplierId || undefined;
  const visibility = body.visibility || 'all';

  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (supplierId) where.supplierId = supplierId;
  if (visibility === 'visible') where.visible = true;
  else if (visibility === 'hidden') where.visible = false;

  const result = await prisma.product.updateMany({ where, data: { visible } });

  adminLogger.info('Bulk product visibility update', {
    userId: user.id,
    visible,
    updated: result.count,
    categoryId: categoryId ?? null,
    supplierId: supplierId ?? null,
    search: search || null,
    visibility,
  });

  return NextResponse.json({ ok: true, data: { updated: result.count } });
}
