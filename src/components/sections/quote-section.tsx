import { QuoteForm } from '@/components/forms/quote-form';

type QuoteSectionProps = {
  services: { slug: string; title: string; methods?: string[] | null }[];
  contactEmail: string;
};

export function QuoteSection({ services, contactEmail }: QuoteSectionProps) {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-8 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-indigo-200/10 p-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">
            Start a production brief
          </p>
          <h2 className="text-3xl font-semibold text-white">White-glove rush support</h2>
          <p className="text-base text-white/80">
            Drop your artwork, timeline and key specs. A real producer reviews every quote and
            confirms blanks, proofs and logistics in under 24 hours.
          </p>
          <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-white/70">
            Prefer email? Send specs to{' '}
            <a href={`mailto:${contactEmail}`} className="text-white underline">
              {contactEmail}
            </a>
          </div>
        </div>
        <div className="rounded-3xl border border-white/15 bg-black/20 p-6 shadow-[0_25px_85px_rgba(15,18,34,0.6)]">
          <QuoteForm
            services={services.map((service) => ({
              slug: service.slug,
              title: service.title,
              method: service.methods?.[0],
            }))}
          />
        </div>
      </div>
    </section>
  );
}

