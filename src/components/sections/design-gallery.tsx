type Design = {
  id: string;
  title: string;
  description?: string | null;
  previewUrl?: string | null;
  tags?: string[] | null;
};

type DesignGalleryProps = {
  designs: Design[];
};

export function DesignGallery({ designs }: DesignGalleryProps) {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Design system</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Use templates or upload</h2>
          <p className="text-base text-white/70">
            Editable Figma kits, AI prompts and illustrator files pre-sized for every imprint method.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {designs.map((design) => (
            <article
              key={design.id ?? design.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <div className="aspect-video rounded-2xl bg-black/30">
                {design.previewUrl ? (
                  <div
                    className="h-full w-full rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${design.previewUrl})` }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/40">
                    Concept art
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-semibold text-white">{design.title}</h3>
                <p className="text-sm text-white/70">{design.description}</p>
                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
                  {design.tags?.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}




