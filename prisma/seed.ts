import { PrismaClient, FulfillmentMethod } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    slug: 'custom-apparel',
    title: 'Custom Apparel',
    description: 'Premium tees, performance wear and outerwear ready for every event.',
    featured: true,
  },
  {
    slug: 'corporate-gifting',
    title: 'Corporate Gifting',
    description: 'Curated bundles, welcome kits and executive gifts that impress.',
    featured: true,
  },
  {
    slug: 'signs-graphics',
    title: 'Signs & Large Format',
    description: 'Weatherproof banners, trade show displays, wall graphics and floor decals.',
    featured: false,
  },
];

const suppliers = [
  {
    name: 'Bella + Canvas',
    logoUrl: '/brands/bella.svg',
    website: 'https://www.bellacanvas.com',
    description: 'Lifestyle-focused blanks with superior softness and retail fits.',
    leadTimeDays: 7,
    capabilities: [FulfillmentMethod.DTG, FulfillmentMethod.SCREEN_PRINT],
    featured: true,
  },
  {
    name: 'SanMar',
    logoUrl: '/brands/sanmar.svg',
    website: 'https://www.sanmar.com',
    description: 'Deep inventory of corporate apparel and accessories with fast coastal shipping.',
    leadTimeDays: 5,
    capabilities: [FulfillmentMethod.EMBROIDERY, FulfillmentMethod.SCREEN_PRINT],
    featured: true,
  },
  {
    name: 'Ultralite Sign Supply',
    website: 'https://www.ultralitesign.com',
    description: 'Industrial grade panels, reflective vinyl and architectural signage systems.',
    leadTimeDays: 10,
    capabilities: [FulfillmentMethod.LASER, FulfillmentMethod.VINYL],
    featured: false,
  },
];

const services = [
  {
    slug: 'embroidery',
    title: 'Embroidery Studio',
    summary: '3D puff, tonal, and specialty threadwork with 24 head production.',
    body: 'Bring depth and polish to polos, headwear, corporate apparel and uniforms with our award-winning embroidery team. We digitize in-house for precise control and faster sampling.',
    heroImage: '/services/embroidery.jpg',
    methods: [FulfillmentMethod.EMBROIDERY],
    ctaLabel: 'Book embroidery run',
    ctaLink: '/contact',
  },
  {
    slug: 'dtf-printing',
    title: 'Direct-To-Fabric Printing',
    summary: 'Unlimited colors with photoreal clarity across apparel and soft goods.',
    body: 'Our Kornit Atlas Max systems output rich gradients, neon inks and specialty textures without minimums. Perfect for on-demand drops, sports teams and multi-location artwork.',
    heroImage: '/services/dtf.jpg',
    methods: [FulfillmentMethod.DTG],
    ctaLabel: 'Launch a drop',
    ctaLink: '/design-studio',
  },
  {
    slug: 'signage',
    title: 'Signs & Environmental Graphics',
    summary: 'Oversized UV printing, routed dimensional lettering and ADA signage.',
    body: 'From temporary promos to architectural statement pieces, we fabricate signage that withstands weather and wows customers. Nationwide install partners available.',
    heroImage: '/services/signage.jpg',
    methods: [FulfillmentMethod.LASER, FulfillmentMethod.VINYL],
    ctaLabel: 'Plan an installation',
    ctaLink: '/contact',
  },
];

const products = [
  {
    sku: 'APP-ELITE-TEE',
    name: 'Elite Performance Tee',
    description: 'Lightweight tri-blend tee that keeps teams cool on and off the field.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    ],
    basePrice: '11.50',
    minQuantity: 24,
    categorySlug: 'custom-apparel',
    fulfillment: [FulfillmentMethod.SCREEN_PRINT, FulfillmentMethod.DTG],
    supplierName: 'Bella + Canvas',
  },
  {
    sku: 'CORP-QUILT-VEST',
    name: 'Thermal Quilted Vest',
    description: 'Premium layering piece ideal for executive gifts and brand launches.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1456926631375-92c8ce872def?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1456926631375-92c8ce872def?auto=format&fit=crop&w=1200&q=80',
    ],
    basePrice: '42.00',
    minQuantity: 12,
    categorySlug: 'corporate-gifting',
    fulfillment: [FulfillmentMethod.EMBROIDERY],
    supplierName: 'SanMar',
  },
  {
    sku: 'SIGN-ALUM-PANEL',
    name: 'Double-Sided Aluminum Panel',
    description: 'Ready-to-install signage with UV print and matte laminate.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    ],
    basePrice: '260.00',
    minQuantity: 1,
    categorySlug: 'signs-graphics',
    fulfillment: [FulfillmentMethod.LASER, FulfillmentMethod.VINYL],
    supplierName: 'Ultralite Sign Supply',
  },
];

const designs = [
  {
    id: 'varsity-pack',
    title: 'Varsity Script Pack',
    description: 'Six bold typographic marks for teams, boosters and spirit wear.',
    previewUrl: '/designs/varsity-pack.png',
    tags: ['athletics', 'retro', 'bold'],
  },
  {
    id: 'gradient-drop',
    title: 'Gradient Rush Drop',
    description: 'Limited-run gradient artwork optimized for DTG and sublimation.',
    previewUrl: '/designs/gradient-drop.png',
    tags: ['streetwear', 'gradient', 'launch'],
  },
];

const collections = [
  {
    slug: 'event-launch-kit',
    name: 'Event Launch Kit',
    description: 'Ready-to-go apparel, signage and promo goods for product launches.',
    heroImage: '/collections/event-kit.jpg',
  },
  {
    slug: 'everyday-essentials',
    name: 'Everyday Essentials',
    description: 'Fast-moving basics perfect for teams, campuses and wellness brands.',
    heroImage: '/collections/essentials.jpg',
  },
];

const testimonials = [
  {
    author: 'Maya S.',
    title: 'Director of Brand',
    company: 'Ridge Athletics',
    quote: 'They turned our 18 location roll-out in four weeks with flawless embroidery and accurate inventory tracking.',
    rating: 5,
  },
  {
    author: 'Carlos V.',
    company: 'Volt Mobility',
    quote: 'The design lab plus supplier network meant we sourced sustainable blanks and UV signage from one partner.',
    rating: 5,
  },
];

const faqs = [
  {
    question: 'What is the standard turnaround for apparel orders?',
    answer: 'Most apparel ships in 7-10 days once artwork is approved. Rush service is available for an additional fee.',
    category: 'Production',
  },
  {
    question: 'Can you dropship orders to multiple locations?',
    answer: 'Yes. We can kit, pack and blind ship to any number of locations worldwide with live tracking dashboards.',
    category: 'Logistics',
  },
  {
    question: 'Do you support customer-supplied goods?',
    answer: 'We accept customer-supplied garments after a quality check and signed liability waiver.',
    category: 'Production',
  },
];

async function seed() {
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: {
      heroHeading: 'Custom merch built for bold launches.',
      heroCopy:
        'Design, source and fulfill on a single cloud platform trusted by agencies, enterprise teams and ambitious founders.',
      ctaLabel: 'Launch a project',
      ctaLink: '/contact',
      contactEmail: 'hello@logoz.com',
      contactPhone: '+1 (402) 555-0199',
      address: '1420 Innovation Way, Omaha, NE 68102',
      announcement: 'Now booking Q1 experiential installs and NIL drops.',
    },
    update: {
      heroHeading: 'Custom merch built for bold launches.',
      heroCopy:
        'Design, source and fulfill on a single cloud platform trusted by agencies, enterprise teams and ambitious founders.',
      ctaLabel: 'Launch a project',
      ctaLink: '/contact',
      contactEmail: 'hello@logoz.com',
      contactPhone: '+1 (402) 555-0199',
      address: '1420 Innovation Way, Omaha, NE 68102',
      announcement: 'Now booking Q1 experiential installs and NIL drops.',
    },
  });

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { ...category },
      create: { ...category },
    });
  }

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { name: supplier.name },
      update: supplier,
      create: supplier,
    });
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: service,
      create: service,
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUnique({
      where: { slug: product.categorySlug },
    });
    const supplier = await prisma.supplier.findFirst({
      where: { name: product.supplierName },
    });

    if (!category) continue;

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        heroImageUrl: product.heroImageUrl,
        gallery: product.gallery,
        basePrice: product.basePrice,
        minQuantity: product.minQuantity,
        fulfillment: product.fulfillment,
        categoryId: category.id,
        supplierId: supplier?.id,
      },
      create: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        heroImageUrl: product.heroImageUrl,
        gallery: product.gallery,
        basePrice: product.basePrice,
        minQuantity: product.minQuantity,
        fulfillment: product.fulfillment,
        categoryId: category.id,
        supplierId: supplier?.id,
      },
    });
  }

  for (const collection of collections) {
    await prisma.collection.upsert({
      where: { slug: collection.slug },
      update: collection,
      create: collection,
    });
  }

  for (const design of designs) {
    await prisma.design.upsert({
      where: { id: design.id },
      update: design,
      create: design,
    });
  }

  for (const testimonial of testimonials) {
    await prisma.testimonial.upsert({
      where: { author: testimonial.author },
      update: testimonial,
      create: testimonial,
    });
  }

  for (const faq of faqs) {
    await prisma.faq.upsert({
      where: { question: faq.question },
      update: faq,
      create: faq,
    });
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

