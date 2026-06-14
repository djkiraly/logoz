import Link from 'next/link';
import { ProductFilter } from '@/components/sections/product-filter';
import { getCategories, getVisibleProductsPage } from '@/lib/site-data';

type ProductsPageProps = {
  searchParams: Promise<{ category?: string; page?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category, page: pageParam } = await searchParams;
  const selectedSlug = category ?? null;
  const page = Number.parseInt(pageParam ?? '1', 10) || 1;

  const [pageData, categories] = await Promise.all([
    getVisibleProductsPage(selectedSlug, page),
    getCategories(),
  ]);

  // Transform categories to include id for filtering
  const categoriesWithId = categories.map((cat) => ({
    id: cat.id || cat.slug,
    slug: cat.slug,
    title: cat.title,
    description: cat.description,
    imageUrl: cat.imageUrl,
    featured: cat.featured,
  }));

  // Transform products to include categoryId and convert Decimal to number
  const productsWithCategoryId = pageData.products.map((product) => ({
    ...product,
    categoryId: product.categoryId || product.category?.id,
    basePrice: product.basePrice ? Number(product.basePrice) : 0,
  }));

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Catalog</p>
          <h1 className="text-4xl font-semibold text-white">Shop by program</h1>
          <p className="text-base text-white/70">
            Browse our products by category. Filter by type to find exactly what you need.
          </p>
        </header>

        {/* Featured Categories */}
        {categoriesWithId.filter((cat) => cat.featured).length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {categoriesWithId
              .filter((cat) => cat.featured)
              .slice(0, 3)
              .map((category) => (
                <Link
                  key={category.slug}
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="group block rounded-3xl border border-white/10 bg-white/5 overflow-hidden text-left hover:bg-white/10 transition-colors"
                >
                  {category.imageUrl && (
                    <div className="aspect-[16/9] overflow-hidden">
                      <div
                        className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url(${category.imageUrl})` }}
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Category</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">{category.title}</h2>
                    <p className="mt-2 text-sm text-white/70 line-clamp-2">{category.description}</p>
                    <div className="mt-4 text-sm font-semibold text-cyan-400">View products →</div>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>

      {/* Products with Filter */}
      <ProductFilter
        products={productsWithCategoryId}
        categories={categoriesWithId}
        selectedSlug={selectedSlug}
        page={pageData.page}
        totalPages={pageData.totalPages}
        total={pageData.total}
      />
    </div>
  );
}




