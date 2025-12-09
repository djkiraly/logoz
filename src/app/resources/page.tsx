const resources = [
  {
    title: 'Rush launch checklist',
    summary: 'Timeline templates, ship windows and art approval flows for 2-week launches.',
    badge: 'Guide',
  },
  {
    title: 'Decoration matrix',
    summary: 'Compare embroidery, DTG, screen print, UV and laser etching by MOQ and finish.',
    badge: 'Download',
  },
  {
    title: 'Fulfillment playbook',
    summary: 'How to spin up pop-up portals, kit campaigns and NIL drops with zero inventory risk.',
    badge: 'Playbook',
  },
];

export default function ResourcesPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Resources</p>
        <h1 className="text-4xl font-semibold text-white">Blueprints & tooling</h1>
        <p className="text-base text-white/70">
          Implementation kits that help brand, marketing and people teams spin up merch programs
          fast.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {resources.map((resource) => (
          <article
            key={resource.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left"
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">{resource.badge}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{resource.title}</h2>
            <p className="mt-2 text-sm text-white/70">{resource.summary}</p>
            <p className="mt-4 text-sm font-semibold text-white">Download →</p>
          </article>
        ))}
      </div>
    </div>
  );
}




