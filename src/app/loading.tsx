export default function Loading() {
  return (
    <div className="min-h-screen bg-[#05060a]">
      <div className="container mx-auto px-4 py-12">
        {/* Hero skeleton */}
        <div className="mb-16 space-y-4">
          <div className="h-16 w-3/4 animate-pulse rounded-lg bg-white/5" />
          <div className="h-8 w-1/2 animate-pulse rounded-lg bg-white/5" />
          <div className="h-12 w-48 animate-pulse rounded-full bg-white/5" />
        </div>

        {/* Category rail skeleton */}
        <div className="mb-12">
          <div className="mb-4 h-8 w-48 animate-pulse rounded bg-white/5" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-24 w-32 flex-shrink-0 animate-pulse rounded-2xl bg-white/5"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Content grid skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-3xl border border-white/5 bg-white/5"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
