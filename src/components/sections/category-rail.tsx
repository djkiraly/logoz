import clsx from 'clsx';

type Category = {
  slug: string;
  title: string;
  description: string;
  featured?: boolean | null;
};

type CategoryRailProps = {
  categories: Category[];
};

export function CategoryRail({ categories }: CategoryRailProps) {
  return (
    <section className="px-4 pb-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">
            Industry templates
          </p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Start from proven kits
          </h2>
          <p className="text-base text-white/70">
            Browse curated flows for campuses, startups, agencies and enterprise launches.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.slug}
              className={clsx(
                'group relative overflow-hidden rounded-3xl border bg-white/5 p-6',
                category.featured ? 'border-white/40' : 'border-white/10',
              )}
            >
              {category.featured ? (
                <span className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  Featured
                </span>
              ) : null}
              <h3 className="text-xl font-semibold text-white">{category.title}</h3>
              <p className="mt-2 text-sm text-white/70">{category.description}</p>
              <div className="mt-6 flex items-center text-sm font-semibold text-white">
                Explore flows
                <span className="ml-2 transition group-hover:translate-x-1">→</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

