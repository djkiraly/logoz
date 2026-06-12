import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { trackEntityActivity } from '@/lib/analytics';

// Allowed page sizes for the admin product list.
const ALLOWED_PAGE_SIZES = [25, 50, 100, 500];

// Whitelist of sortable fields -> Prisma orderBy (prevents arbitrary sort input).
function buildOrderBy(
  field: string | null,
  order: Prisma.SortOrder
): Prisma.ProductOrderByWithRelationInput {
  switch (field) {
    case 'name':
      return { name: order };
    case 'sku':
      return { sku: order };
    case 'basePrice':
      return { basePrice: order };
    case 'visible':
      return { visible: order };
    case 'featured':
      return { featured: order };
    case 'category':
      return { category: { title: order } };
    case 'updatedAt':
      return { updatedAt: order };
    case 'createdAt':
    default:
      return { createdAt: order };
  }
}

// GET /api/admin/products - List products with optional search/filter/sort/paging.
//
// Query params (all optional):
//   search      - case-insensitive match on name / sku / description
//   categoryId  - filter by category
//   supplierId  - filter by supplier
//   visibility  - all | visible | hidden
//   sort        - name | sku | basePrice | category | visible | featured | createdAt | updatedAt
//   order       - asc | desc (default desc)
//   page        - 1-based page number (default 1)
//   pageSize    - 25 | 50 | 100 | 500; pagination only applies when this is a
//                 valid value, so callers that omit it (e.g. the quote builder)
//                 still receive the full list.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);

    // ----- Filtering -----
    const search = (searchParams.get('search') || '').trim();
    const categoryId = searchParams.get('categoryId') || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const visibility = searchParams.get('visibility') || 'all';

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

    // ----- Sorting -----
    const order: Prisma.SortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const orderBy = buildOrderBy(searchParams.get('sort'), order);

    // ----- Pagination (opt-in via a valid pageSize) -----
    const pageSizeRaw = parseInt(searchParams.get('pageSize') || '', 10);
    const paginate = ALLOWED_PAGE_SIZES.includes(pageSizeRaw);
    const pageSize = paginate ? pageSizeRaw : 0;

    const total = await prisma.product.count({ where });

    let page = 1;
    if (paginate) {
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1), totalPages);
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy,
      ...(paginate ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    });

    return NextResponse.json({
      ok: true,
      data: products,
      pagination: {
        page,
        pageSize: paginate ? pageSize : total,
        total,
        totalPages: paginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
      },
    });
  } catch (error) {
    adminLogger.error('Failed to fetch products', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST /api/admin/products - Create a new product
export async function POST(request: NextRequest) {
  try {
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
    const {
      sku,
      name,
      description,
      heroImageUrl,
      gallery,
      basePrice,
      cost,
      minQuantity,
      categoryId,
      supplierId,
      fulfillment,
      visible,
      featured,
      priceOverridden,
    } = body;

    // Validate required fields
    if (!sku || !name || !description || !categoryId) {
      return NextResponse.json(
        { error: 'SKU, name, description, and category are required' },
        { status: 400 }
      );
    }

    // Check for duplicate SKU
    const existingProduct = await prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: 'A product with this SKU already exists' },
        { status: 400 }
      );
    }

    // Validate category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Validate supplier if provided
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) {
        return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 });
      }
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        heroImageUrl: heroImageUrl || null,
        gallery: gallery || [],
        basePrice: new Prisma.Decimal(basePrice || 0),
        cost: cost ? new Prisma.Decimal(cost) : null,
        minQuantity: minQuantity || 1,
        categoryId,
        supplierId: supplierId || null,
        fulfillment: fulfillment || [],
        visible: visible ?? false,
        featured: featured ?? false,
        priceOverridden: priceOverridden ?? false,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    adminLogger.info('Product created', {
      userId: user.id,
      productId: product.id,
      sku: product.sku,
    });

    // Track entity activity
    await trackEntityActivity({
      entityType: 'PRODUCT',
      entityId: product.id,
      activityType: 'CREATED',
      userId: user.id,
      newValue: { sku: product.sku, name: product.name },
    });

    return NextResponse.json({ ok: true, data: product }, { status: 201 });
  } catch (error) {
    adminLogger.error('Failed to create product', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    );
  }
}
