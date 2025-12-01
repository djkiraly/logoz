import { ServiceDeck } from '@/components/sections/service-deck';
import { getServices } from '@/lib/site-data';

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Production</p>
        <h1 className="text-4xl font-semibold text-white">Methods & install teams</h1>
        <p className="text-base text-white/70">
          Align art, operations and logistics. Every service lane includes proofing, QA reporting,
          and fulfillment dashboards.
        </p>
      </div>
      <ServiceDeck services={services} />
    </div>
  );
}




