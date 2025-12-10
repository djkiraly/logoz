type Product = {
  sku: string;
  name: string;
  description: string;
  heroImageUrl?: string | null;
  gallery?: string[];
  basePrice?: number | string | { toString(): string };
  minQuantity?: number | null;
  category?: { title: string } | null;
};

type ProductShowcaseProps = {
  products: Product[];
};

export function ProductShowcase({ products }: ProductShowcaseProps) {
  const formatPrice = (price: Product['basePrice']) => {
    if (!price) return '0.00';
    if (typeof price === 'number') {
      return price.toFixed(2);
    }
    if (typeof price === 'string') {
      return Number(price).toFixed(2);
    }

    return price.toString();
  };

  // Don't render the section if there are no products
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Catalog</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Fresh drops & program staples
          </h2>
          <p className="text-base text-white/70">
            Mix made-to-order and stocked inventory. Sync pricing with suppliers automatically.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.sku}
              className="group flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-black/30">
                {product.heroImageUrl ? (
                  <div
                    className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${product.heroImageUrl})` }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/40">
                    Render preview
                  </div>
                )}
              </div>
              <div className="mt-4 flex-1 space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-white/40">
                  {product.category?.title ?? 'Programs'}
                </p>
                <h3 className="text-xl font-semibold text-white">{product.name}</h3>
                <p className="text-sm text-white/70">{product.description}</p>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm text-white/80">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">From</p>
                  <p className="text-lg font-semibold text-white">${formatPrice(product.basePrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">Min</p>
                  <p className="text-lg font-semibold text-white">
                    {product.minQuantity ?? 12} pcs
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

