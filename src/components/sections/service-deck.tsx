type Service = {
  slug: string;
  title: string;
  summary: string;
  heroImage?: string | null;
  methods?: string[];
};

type ServiceDeckProps = {
  services: Service[];
};

export function ServiceDeck({ services }: ServiceDeckProps) {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Capabilities</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Full-stack production</h2>
          <p className="text-base text-white/70">
            Embroidery, laser, UV, DTF, sublimation, fulfillment and installs — united in one ops
            layer.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.slug}
              id={service.slug}
              className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">Service</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{service.title}</h3>
              <p className="mt-3 text-sm text-white/70">{service.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/70">
                {service.methods?.map((method) => (
                  <span
                    key={method}
                    className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-wider"
                  >
                    {method.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}




