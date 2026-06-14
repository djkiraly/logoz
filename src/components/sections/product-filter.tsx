import Link from 'next/link';
import { Filter } from 'lucide-react';

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
  /** Products for the current page (already filtered + paginated server-side). */
  products: Product[];
  categories: Category[];
  /** Slug of the active category, or null for "All Products". */
  selectedSlug: string | null;
  page: number;
  totalPages: number;
  /** Total matching products across all pages (for the results count). */
  total: number;
};

/** Build a /products href preserving category, omitting defaults (page 1 / all). */
function buildHref(slug: string | null, page: number): string {
  const params = new URLSearchParams();
  if (slug) params.set('category', slug);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/products?${qs}` : '/products';
}

/** Compact page-number window around the current page (with first/last). */
function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current]);
  for (let d = 1; d <= 1; d++) {
    if (current - d > 1) pages.add(current - d);
    if (current + d < totalPages) pages.add(current + d);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('gap');
    out.push(p);
    prev = p;
  }
  return out;
}

function formatPrice(price: Product['basePrice']): string {
  if (!price) return '0.00';
  if (typeof price === 'number') return price.toFixed(2);
  if (typeof price === 'string') return Number(price).toFixed(2);
  return price.toString();
}

export function ProductFilter({
  products,
  categories,
  selectedSlug,
  page,
  totalPages,
  total,
}: ProductFilterProps) {
  // Don't render if there are no products and no categories
  if (products.length === 0 && categories.length === 0) {
    return null;
  }

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
      active
        ? 'bg-cyan-500 text-white'
        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
    }`;

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Heading */}
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Catalog</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Browse Products
          </h2>
          <p className="text-base text-white/70">
            Filter by category to find exactly what you need.
          </p>
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-white/60 mr-2">
              <Filter className="w-4 h-4" />
            </div>
            <Link href={buildHref(null, 1)} className={pillClass(selectedSlug === null)}>
              All Products
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={buildHref(category.slug, 1)}
                className={pillClass(selectedSlug === category.slug)}
              >
                {category.title}
              </Link>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">
              {selectedSlug
                ? 'No products found in this category.'
                : 'No products available yet.'}
            </p>
            {selectedSlug && (
              <Link
                href={buildHref(null, 1)}
                className="mt-4 inline-block px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                View all products
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {products.map((product) => (
              <Link
                key={product.sku}
                href={`/products/${encodeURIComponent(product.sku)}`}
                className="group flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
              >
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-black/30">
                  {product.heroImageUrl ? (
                    <div
                      className="h-full w-full bg-contain bg-center bg-no-repeat transition duration-500 group-hover:scale-105"
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
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            className="flex flex-wrap items-center justify-center gap-2 pt-2"
            aria-label="Pagination"
          >
            {page > 1 ? (
              <Link
                href={buildHref(selectedSlug, page - 1)}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 transition-all"
                rel="prev"
              >
                Prev
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-white/30 border border-white/10 cursor-not-allowed">
                Prev
              </span>
            )}

            {pageWindow(page, totalPages).map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="px-2 text-white/40">
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={buildHref(selectedSlug, p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={pillClass(p === page)}
                >
                  {p}
                </Link>
              )
            )}

            {page < totalPages ? (
              <Link
                href={buildHref(selectedSlug, page + 1)}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 transition-all"
                rel="next"
              >
                Next
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-white/30 border border-white/10 cursor-not-allowed">
                Next
              </span>
            )}
          </nav>
        )}

        {/* Results count */}
        {total > 0 && (
          <p className="text-center text-sm text-white/40">
            Showing {products.length} of {total} products
            {selectedSlug && <> in selected category</>}
            {totalPages > 1 && <> · page {page} of {totalPages}</>}
          </p>
        )}
      </div>
    </section>
  );
}
