type Faq = {
  id?: string;
  question: string;
  answer: string;
  category?: string | null;
};

type FaqAccordionProps = {
  faqs: Faq[];
};

export function FaqAccordion({ faqs }: FaqAccordionProps) {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">FAQ</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Answers on deck</h2>
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.id ?? faq.question}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <summary className="flex cursor-pointer items-center justify-between text-left text-lg font-semibold text-white">
                <span>{faq.question}</span>
                <span className="text-sm text-white/60 group-open:hidden">+</span>
                <span className="hidden text-sm text-white/60 group-open:inline">−</span>
              </summary>
              <p className="mt-3 text-sm text-white/70">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}




