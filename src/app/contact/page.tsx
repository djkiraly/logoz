import { QuoteForm } from '@/components/forms/quote-form';
import { getServices, getSiteSettings } from '@/lib/site-data';

export default async function ContactPage() {
  const [services, settings] = await Promise.all([getServices(), getSiteSettings()]);

  return (
    <div className="px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Contact</p>
          <h1 className="text-4xl font-semibold text-white">Plug into the production team</h1>
          <p className="text-base text-white/70">
            Send specs, schedule a walkthrough, or spin up a portal for your org. We answer within one
            business day.
          </p>
          <div className="space-y-2 text-sm text-white/70">
            <p>{settings.address}</p>
            <p>{settings.contactPhone}</p>
            <a href={`mailto:${settings.contactEmail}`} className="text-white underline">
              {settings.contactEmail}
            </a>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <QuoteForm
            services={services.map((service) => ({
              slug: service.slug,
              title: service.title,
              method: service.methods?.[0],
            }))}
          />
        </div>
      </div>
    </div>
  );
}

