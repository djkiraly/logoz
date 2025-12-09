type Supplier = {
  id?: string;
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
  leadTimeDays?: number | null;
  featured?: boolean | null;
};

type SupplierMarqueeProps = {
  suppliers: Supplier[];
};

export function SupplierMarquee({ suppliers }: SupplierMarqueeProps) {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Supplier network</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            80k+ SKUs ready to plug in
          </h2>
          <p className="text-base text-white/70">
            Preferred distributor terms, live inventory feeds and instant price updates.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {suppliers.map((supplier) => (
            <article
              key={supplier.name}
              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <p className="text-sm font-semibold text-white">{supplier.name}</p>
              <p className="mt-2 text-sm text-white/70">{supplier.description}</p>
              <div className="mt-4 text-xs text-white/50">
                Lead time • {supplier.leadTimeDays ?? '6'} days
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}




