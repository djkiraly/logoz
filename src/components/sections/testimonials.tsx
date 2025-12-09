type Testimonial = {
  id?: string;
  author: string;
  title?: string | null;
  role?: string | null;
  company?: string | null;
  quote: string;
};

type TestimonialsProps = {
  testimonials: Testimonial[];
};

export function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Signals</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Ops teams trust Logoz Cloud
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article
              key={`${testimonial.author}-${testimonial.company}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <p className="text-sm text-white/80">{testimonial.quote}</p>
              <div className="mt-4 text-sm text-white">
                <p className="font-semibold">{testimonial.author}</p>
                <p className="text-white/60">
                  {testimonial.role ?? testimonial.title} · {testimonial.company}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}




