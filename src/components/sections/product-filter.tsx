'use client';

import { useState, useMemo } from 'react';
import { Filter, X } from 'lucide-react';

type Category = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  featured?: boolean;
};

type Product = {
  id?: string;
  sku: string;
  name: string;
  description: string;
  heroImageUrl?: string | null;
  gallery?: string[];
  basePrice?: number | string | { toString(): string };
  minQuantity?: number | null;
  category?: { id?: string; title: string } | null;
  categoryId?: string;
};

type ProductFilterProps = {
  products: Product[];
  categories: Category[];
};

export function ProductFilter({ products, categories }: ProductFilterProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return products;
    }
    return products.filter((product) => {
      const categoryId = product.categoryId || product.category?.id;
      return categoryId === selectedCategory;
    });
  }, [products, selectedCategory]);

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

  // Don't render if there are no products and no categories
  if (products.length === 0 && categories.length === 0) {
    return null;
  }

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Catalog</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Fresh drops & program staples
          </h2>
          <p className="text-base text-white/70">
            Mix made-to-order and stocked inventory. Sync pricing with suppliers automatically.
          </p>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-white/60 mr-2">
              <Filter className="w-4 h-4" />
              <span>Filter:</span>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              All Products
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {category.title}
              </button>
            ))}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">
              {selectedCategory
                ? 'No products found in this category.'
                : 'No products available yet.'}
            </p>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="mt-4 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                View all products
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {filteredProducts.map((product) => (
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
                    {product.category?.title ?? 'Products'}
                  </p>
                  <h3 className="text-xl font-semibold text-white">{product.name}</h3>
                  <p className="text-sm text-white/70 line-clamp-2">{product.description}</p>
                </div>
                <div className="mt-6 flex items-center justify-between text-sm text-white/80">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">From</p>
                    <p className="text-lg font-semibold text-white">
                      ${formatPrice(product.basePrice)}
                    </p>
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
        )}

        {/* Results count */}
        {filteredProducts.length > 0 && (
          <p className="text-center text-sm text-white/40">
            Showing {filteredProducts.length} of {products.length} products
            {selectedCategory && (
              <> in selected category</>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
