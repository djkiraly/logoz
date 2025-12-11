import { ProductFilter } from '@/components/sections/product-filter';
import { getCategories, getProducts } from '@/lib/site-data';

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  // Transform categories to include id for filtering
  const categoriesWithId = categories.map((cat) => ({
    id: cat.id || cat.slug,
    slug: cat.slug,
    title: cat.title,
    description: cat.description,
    imageUrl: cat.imageUrl,
    featured: cat.featured,
  }));

  // Transform products to include categoryId for filtering
  const productsWithCategoryId = products.map((product) => ({
    ...product,
    categoryId: product.categoryId || product.category?.id,
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
                <article
                  key={category.slug}
                  className="group rounded-3xl border border-white/10 bg-white/5 overflow-hidden text-left hover:bg-white/10 transition-colors cursor-pointer"
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
                </article>
              ))}
          </div>
        )}
      </div>

      {/* Products with Filter */}
      <ProductFilter products={productsWithCategoryId} categories={categoriesWithId} />
    </div>
  );
}




