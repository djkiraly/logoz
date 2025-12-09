import { HeroSection } from '@/components/sections/hero-section';
import { CategoryRail } from '@/components/sections/category-rail';
import { ProductShowcase } from '@/components/sections/product-showcase';
import { SupplierMarquee } from '@/components/sections/supplier-marquee';
import { ServiceDeck } from '@/components/sections/service-deck';
import { DesignGallery } from '@/components/sections/design-gallery';
import { Testimonials } from '@/components/sections/testimonials';
import { FaqAccordion } from '@/components/sections/faq-accordion';
import { QuoteSection } from '@/components/sections/quote-section';
import {
  getCategories,
  getDesigns,
  getFaqs,
  getMarketingSnapshot,
  getProducts,
  getServices,
  getSuppliers,
} from '@/lib/site-data';

export default async function Home() {
  const [snapshot, categories, services, products, designs, suppliers, faqs] = await Promise.all([
    getMarketingSnapshot(),
    getCategories(),
    getServices(),
    getProducts(),
    getDesigns(),
    getSuppliers(),
    getFaqs(),
  ]);

  return (
    <>
      <HeroSection settings={snapshot.settings} stats={snapshot.stats} />
      <CategoryRail categories={categories} />
      <ProductShowcase products={products} />
      <SupplierMarquee suppliers={suppliers} />
      <ServiceDeck services={services} />
      <DesignGallery designs={designs} />
      <Testimonials testimonials={snapshot.testimonials} />
      <FaqAccordion faqs={faqs} />
      <QuoteSection services={services} contactEmail={snapshot.settings.contactEmail} />
    </>
  );
}
