import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { deleteFile } from '@/lib/gcs';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/products/[id] - Get a single product
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

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        variants: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    adminLogger.error('Failed to fetch product', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// PUT /api/admin/products/[id] - Update a product
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

    // Check product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

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

    // Check for duplicate SKU if changed
    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku },
      });
      if (duplicateSku) {
        return NextResponse.json(
          { error: 'A product with this SKU already exists' },
          { status: 400 }
        );
      }
    }

    // Validate category if provided
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
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

    // Build update data - using Record type to allow new fields pending Prisma regeneration
    const updateData: Record<string, unknown> = {};

    if (sku !== undefined) updateData.sku = sku;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (heroImageUrl !== undefined) updateData.heroImageUrl = heroImageUrl || null;
    if (gallery !== undefined) updateData.gallery = gallery;
    if (basePrice !== undefined) updateData.basePrice = new Prisma.Decimal(basePrice);
    if (cost !== undefined) updateData.cost = cost ? new Prisma.Decimal(cost) : null;
    if (minQuantity !== undefined) updateData.minQuantity = minQuantity;
    if (categoryId !== undefined) updateData.category = { connect: { id: categoryId } };
    if (supplierId !== undefined) {
      updateData.supplier = supplierId ? { connect: { id: supplierId } } : { disconnect: true };
    }
    if (fulfillment !== undefined) updateData.fulfillment = fulfillment;
    if (visible !== undefined) updateData.visible = visible;
    if (featured !== undefined) updateData.featured = featured;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        supplier: true,
      },
    });

    adminLogger.info('Product updated', {
      userId: user.id,
      productId: product.id,
      sku: product.sku,
    });

    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    adminLogger.error('Failed to update product', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Delete a product
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

    // Check product exists and get image info
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Delete the product (variants will cascade delete)
    await prisma.product.delete({
      where: { id },
    });

    // Try to delete associated images from GCS
    if (existingProduct.heroImageUrl) {
      try {
        const fileName = extractGcsFileName(existingProduct.heroImageUrl);
        if (fileName) {
          await deleteFile(fileName);
        }
      } catch (e) {
        // Log but don't fail if image deletion fails
        adminLogger.warn('Failed to delete hero image from GCS', {
          url: existingProduct.heroImageUrl,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Try to delete gallery images
    for (const imageUrl of existingProduct.gallery) {
      try {
        const fileName = extractGcsFileName(imageUrl);
        if (fileName) {
          await deleteFile(fileName);
        }
      } catch (e) {
        adminLogger.warn('Failed to delete gallery image from GCS', {
          url: imageUrl,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    adminLogger.info('Product deleted', {
      userId: user.id,
      productId: id,
      sku: existingProduct.sku,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    adminLogger.error('Failed to delete product', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete product' },
      { status: 500 }
    );
  }
}

// Helper to extract GCS file name from URL
function extractGcsFileName(url: string): string | null {
  try {
    const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
