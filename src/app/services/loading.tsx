export default function ServicesLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Page header skeleton */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 h-12 w-64 animate-pulse rounded-lg bg-white/5" />
        <div className="mx-auto h-6 w-96 animate-pulse rounded bg-white/5" />
      </div>

      {/* Services grid skeleton */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="mb-4 h-48 animate-pulse rounded-2xl bg-white/5" />
            <div className="mb-3 h-7 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="mb-4 space-y-2">
              <div className="h-4 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-white/5" />
            </div>
            <div className="h-10 w-32 animate-pulse rounded-full bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
