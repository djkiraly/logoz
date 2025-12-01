import { getSiteSettings } from '@/lib/site-data';

export default async function AboutPage() {
  const settings = await getSiteSettings();

  const pillars = [
    {
      title: 'Speed with fidelity',
      copy: 'We keep embroidery, DTG, vinyl and UV under one roof next to fulfillment, so approvals and QC live in the same dashboard.',
    },
    {
      title: 'Supplier neutral',
      copy: 'Choose from preferred distributors or bring your own goods. We provide compliance docs, routing, and serialized tracking.',
    },
    {
      title: 'Cloud native',
      copy: 'Every order emits events into your stack — Slack, Airtable, NetSuite, monday.com — with full read/write APIs.',
    },
  ];

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">About</p>
        <h1 className="text-4xl font-semibold text-white">The Logoz difference</h1>
        <p className="text-base text-white/70">
          We grew out of a Nebraska production shop serving Division I athletics. Today we orchestrate
          enterprise launches, agency drops and NIL programs worldwide.
        </p>
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">{pillar.title}</h2>
            <p className="mt-2 text-sm text-white/70">{pillar.copy}</p>
          </article>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        {settings.address} · {settings.contactPhone} ·{' '}
        <a href={`mailto:${settings.contactEmail}`} className="text-white underline">
          {settings.contactEmail}
        </a>
      </div>
    </div>
  );
}




