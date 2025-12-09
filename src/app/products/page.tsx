import { ProductShowcase } from '@/components/sections/product-showcase';
import { getCategories, getProducts } from '@/lib/site-data';

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Catalog</p>
          <h1 className="text-4xl font-semibold text-white">Shop by program</h1>
          <p className="text-base text-white/70">
            Filter by fulfillment type, suppliers and sustainability badges. Everything syncs with
            live inventory.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.slug}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Category</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{category.title}</h2>
              <p className="mt-2 text-sm text-white/70">{category.description}</p>
              <div className="mt-4 text-sm font-semibold text-white">View curated kits →</div>
            </article>
          ))}
        </div>
      </div>
      <ProductShowcase products={products} />
    </div>
  );
}




