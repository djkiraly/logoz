export default function ProductsLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Page title skeleton */}
      <div className="mb-8 h-12 w-64 animate-pulse rounded-lg bg-white/5" />

      {/* Filters skeleton */}
      <div className="mb-8 flex flex-wrap gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-10 w-24 animate-pulse rounded-full bg-white/5"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Products grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="space-y-3"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="aspect-square animate-pulse rounded-2xl bg-white/5" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
