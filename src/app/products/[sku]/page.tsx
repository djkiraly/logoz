import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { getProductBySku } from '@/lib/site-data';
import { ProductGallery } from '@/components/sections/product-gallery';

type PageProps = {
  params: Promise<{ sku: string }>;
};

const FULFILLMENT_LABELS: Record<string, string> = {
  EMBROIDERY: 'Embroidery',
  SCREEN_PRINT: 'Screen Print',
  DTG: 'DTG',
  VINYL: 'Vinyl',
  SUBLIMATION: 'Sublimation',
  LASER: 'Laser',
  PROMO: 'Promotional',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sku } = await params;
  const product = await getProductBySku(decodeURIComponent(sku));
  if (!product) return { title: 'Product not found' };
  return {
    title: product.name,
    description: product.description?.slice(0, 160),
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { sku } = await params;
  const product = await getProductBySku(decodeURIComponent(sku));

  if (!product) notFound();

  // Map color name -> swatch URL for the color chips.
  const swatchByColor = new Map(
    product.colorImages.map((c) => [c.color, c.swatch] as const)
  );

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-sm text-white/60" aria-label="Breadcrumb">
          <Link href="/products" className="inline-flex items-center gap-1 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Products
          </Link>
          {product.category && (
            <>
              <ChevronRight className="h-4 w-4 text-white/30" />
              <Link
                href={`/products?category=${product.category.slug}`}
                className="hover:text-white transition-colors"
              >
                {product.category.title}
              </Link>
            </>
          )}
          <ChevronRight className="h-4 w-4 text-white/30" />
          <span className="text-white/90">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <ProductGallery images={product.images} productName={product.name} />

          {/* Details */}
          <div className="space-y-6">
            <div className="space-y-2">
              {product.category && (
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  {product.category.title}
                </p>
              )}
              <h1 className="text-3xl font-semibold text-white">{product.name}</h1>
              {product.supplier && (
                <p className="text-sm text-white/60">by {product.supplier.name}</p>
              )}
            </div>

            {/* Price (public) + min qty */}
            <div className="flex items-end gap-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">From</p>
                <p className="text-3xl font-semibold text-white">${product.basePrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">Min order</p>
                <p className="text-3xl font-semibold text-white">{product.minQuantity} pcs</p>
              </div>
            </div>

            {/* Colors */}
            {product.colors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">
                  Colors <span className="text-white/40">({product.colors.length})</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => {
                    const swatch = swatchByColor.get(color);
                    return (
                      <span
                        key={color}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-sm text-white/80"
                      >
                        {swatch ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={swatch} alt={color} className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-white/15" />
                        )}
                        {color}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes */}
            {product.sizes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Sizes</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <span
                      key={size}
                      className="inline-flex min-w-[2.75rem] justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Fulfillment / decoration */}
            {product.fulfillment.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Decoration methods</p>
                <div className="flex flex-wrap gap-2">
                  {product.fulfillment.map((method) => (
                    <span
                      key={method}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300"
                    >
                      {FULFILLMENT_LABELS[method] ?? method}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/contact?product=${encodeURIComponent(product.sku)}`}
                className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-cyan-600"
              >
                Request a Quote
              </Link>
              <Link
                href="/design-studio"
                className="rounded-lg border border-white/15 px-5 py-2.5 font-semibold text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                Start a Design
              </Link>
            </div>

            {/* Description */}
            {product.description && (
              <div className="space-y-2 border-t border-white/10 pt-6">
                <p className="text-sm font-medium text-white/80">Details</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
