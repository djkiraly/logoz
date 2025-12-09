import { DesignGallery } from '@/components/sections/design-gallery';
import { getDesigns } from '@/lib/site-data';

export default async function DesignStudioPage() {
  const designs = await getDesigns();

  return (
    <div className="px-4 py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Design Studio</p>
        <h1 className="text-4xl font-semibold text-white">Collaborative art direction</h1>
        <p className="text-base text-white/70">
          AI assisted prompts, merch-ready templates, approvals, and handoff packages that slot
          directly into production.
        </p>
        <div className="glass-panel space-y-4 p-6 text-left">
          <h2 className="text-xl font-semibold text-white">Workflow highlights</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-white/70">
            <li>Share live boards with clients and merch partners for real-time comments.</li>
            <li>Lock Pantone palettes and placement notes that flow to production tickets.</li>
            <li>Upload embroidery DST, vector, raster and PDF assets with version control.</li>
          </ul>
        </div>
      </div>
      <DesignGallery designs={designs} />
    </div>
  );
}




