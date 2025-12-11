import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/categories/[id] - Get a single category
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await context.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: category });
  } catch (error) {
    adminLogger.error('Failed to fetch category', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 });
  }
}

// PUT /api/admin/categories/[id] - Update a category
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { title, description, imageUrl, featured } = body;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      title?: string;
      slug?: string;
      description?: string;
      imageUrl?: string | null;
      featured?: boolean;
    } = {};

    if (title !== undefined && title.trim()) {
      updateData.title = title.trim();
      // Update slug if title changed
      const newSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if new slug conflicts with another category
      if (newSlug !== existingCategory.slug) {
        const slugConflict = await prisma.category.findUnique({
          where: { slug: newSlug },
        });
        if (slugConflict && slugConflict.id !== id) {
          return NextResponse.json(
            { error: 'A category with this name already exists' },
            { status: 400 }
          );
        }
        updateData.slug = newSlug;
      }
    }

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl || null;
    }

    if (featured !== undefined) {
      updateData.featured = featured;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    adminLogger.info('Category updated', {
      userId: user.id,
      categoryId: category.id,
      updates: Object.keys(updateData),
    });

    return NextResponse.json({ ok: true, data: category });
  } catch (error) {
    adminLogger.error('Failed to update category', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/admin/categories/[id] - Delete a category
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await context.params;

    // Check if category exists and has products
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Prevent deletion if category has products
    if (category._count.products > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${category._count.products} product(s). Please reassign or delete the products first.`,
        },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    adminLogger.info('Category deleted', {
      userId: user.id,
      categoryId: id,
      title: category.title,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    adminLogger.error('Failed to delete category', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
