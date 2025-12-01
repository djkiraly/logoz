export default function SuppliersLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Page header skeleton */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 h-12 w-72 animate-pulse rounded-lg bg-white/5" />
        <div className="mx-auto h-6 w-80 animate-pulse rounded bg-white/5" />
      </div>

      {/* Suppliers grid skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="mb-4 flex items-center gap-4">
              <div className="h-16 w-16 animate-pulse rounded-xl bg-white/5" />
              <div className="flex-1">
                <div className="mb-2 h-6 w-32 animate-pulse rounded bg-white/5" />
                <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <div className="h-4 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-white/5" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[...Array(3)].map((_, j) => (
                <div
                  key={j}
                  className="h-6 w-20 animate-pulse rounded-full bg-white/5"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
