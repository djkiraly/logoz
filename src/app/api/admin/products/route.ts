import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// GET /api/admin/products - List all products
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const products = await prisma.product.findMany({
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, data: products });
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
