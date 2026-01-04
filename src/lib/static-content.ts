import { type FulfillmentMethodValue } from '@/lib/constants';

export const siteSettings = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? 'Logoz Custom',
  heroHeading: 'Custom merch built for bold launches.',
  heroCopy:
    'Design, source and fulfill on a single cloud platform trusted by agencies, enterprise teams and ambitious founders.',
  ctaLabel: 'Launch a project',
  ctaLink: '/contact',
  contactEmail: 'hello@logoz.com',
  contactPhone: '+1 (402) 555-0199',
  address: '1420 Innovation Way, Omaha, NE 68102',
  announcement: 'Now booking Q1 experiential installs and NIL drops.',
  faviconUrl: null,
  logoUrl: null,
};

export const categories = [
  {
    slug: 'custom-apparel',
    title: 'Custom Apparel',
    description: 'Premium tees, performance wear and outerwear ready for every event.',
    featured: true,
    services: ['embroidery', 'dtg-printing'],
  },
  {
    slug: 'corporate-gifting',
    title: 'Corporate Gifting',
    description: 'Curated bundles, welcome kits and executive gifts that impress stakeholders.',
    featured: true,
    services: ['embroidery'],
  },
  {
    slug: 'signs-graphics',
    title: 'Signs & Large Format',
    description: 'Weatherproof banners, trade show displays, wall graphics and floor decals.',
    featured: false,
    services: ['signage'],
  },
];

export const services = [
  {
    slug: 'embroidery',
    title: 'Embroidery Studio',
    summary: '3D puff, tonal, and specialty threadwork with 24 head production.',
    body: 'Bring depth and polish to polos, headwear, corporate apparel and uniforms with our award-winning embroidery team. We digitize in-house for precise control and faster sampling.',
    heroImage: '/services/embroidery.jpg',
    methods: ['EMBROIDERY'] as FulfillmentMethodValue[],
    ctaLabel: 'Book embroidery run',
    ctaLink: '/contact',
  },
  {
    slug: 'dtg-printing',
    title: 'Direct-To-Fabric Printing',
    summary: 'Unlimited colors with photoreal clarity across apparel and soft goods.',
    body: 'Our Kornit Atlas Max systems output rich gradients, neon inks and specialty textures without minimums. Perfect for on-demand drops, sports teams and multi-location artwork.',
    heroImage: '/services/dtf.jpg',
    methods: ['DTG'] as FulfillmentMethodValue[],
    ctaLabel: 'Launch a drop',
    ctaLink: '/design-studio',
  },
  {
    slug: 'signage',
    title: 'Signs & Environmental Graphics',
    summary: 'Oversized UV printing, routed dimensional lettering and ADA signage.',
    body: 'From temporary promos to architectural statement pieces, we fabricate signage that withstands weather and wows customers. Nationwide install partners available.',
    heroImage: '/services/signage.jpg',
    methods: ['LASER', 'VINYL'] as FulfillmentMethodValue[],
    ctaLabel: 'Plan an installation',
    ctaLink: '/contact',
  },
];

export const suppliers = [
  {
    name: 'Bella + Canvas',
    logoUrl: '/brands/bella.svg',
    website: 'https://www.bellacanvas.com',
    description: 'Lifestyle-focused blanks with superior softness and retail fits.',
    leadTimeDays: 7,
    capabilities: ['DTG', 'SCREEN_PRINT'] as FulfillmentMethodValue[],
    featured: true,
  },
  {
    name: 'SanMar',
    logoUrl: '/brands/sanmar.svg',
    website: 'https://www.sanmar.com',
    description: 'Deep inventory of corporate apparel and accessories with fast coastal shipping.',
    leadTimeDays: 5,
    capabilities: ['EMBROIDERY', 'SCREEN_PRINT'] as FulfillmentMethodValue[],
    featured: true,
  },
  {
    name: 'Ultralite Sign Supply',
    website: 'https://www.ultralitesign.com',
    description: 'Industrial grade panels, reflective vinyl and architectural signage systems.',
    leadTimeDays: 10,
    capabilities: ['LASER', 'VINYL'] as FulfillmentMethodValue[],
    featured: false,
  },
];

export const products = [
  {
    sku: 'APP-ELITE-TEE',
    name: 'Elite Performance Tee',
    description: 'Lightweight tri-blend tee that keeps teams cool on and off the field.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    ],
    basePrice: 11.5,
    minQuantity: 24,
    fulfillment: ['SCREEN_PRINT', 'DTG'] as FulfillmentMethodValue[],
    categorySlug: 'custom-apparel',
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
    basePrice: 42,
    minQuantity: 12,
    fulfillment: ['EMBROIDERY'] as FulfillmentMethodValue[],
    categorySlug: 'corporate-gifting',
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
    basePrice: 260,
    minQuantity: 1,
    fulfillment: ['LASER', 'VINYL'] as FulfillmentMethodValue[],
    categorySlug: 'signs-graphics',
  },
];

export const collections = [
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

export const designs = [
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
  {
    id: 'heritage-crest',
    title: 'Heritage Crest',
    description: 'Perfect for alumni drives and donor gifting suites.',
    previewUrl: '/designs/heritage-crest.png',
    tags: ['heritage', 'monogram'],
  },
];

export const testimonials = [
  {
    author: 'Maya Summers',
    role: 'Director of Brand',
    company: 'Ridge Athletics',
    quote:
      'They turned our 18 location roll-out in four weeks with flawless embroidery and accurate inventory tracking.',
  },
  {
    author: 'Carlos Velasquez',
    role: 'Founder',
    company: 'Volt Mobility',
    quote:
      'The design lab plus supplier network meant we sourced sustainable blanks and UV signage from one partner.',
  },
  {
    author: 'Elise Porter',
    role: 'People Ops',
    company: 'Indigo Labs',
    quote:
      'Kitting, warehousing, and portal ordering helped us onboard over 600 hybrid employees without touching inventory.',
  },
];

export const faqs = [
  {
    question: 'What is the standard turnaround for apparel orders?',
    answer:
      'Most apparel ships in 7-10 days once artwork is approved. Rush service is available for an additional fee.',
    category: 'Production',
  },
  {
    question: 'Can you dropship orders to multiple locations?',
    answer:
      'Yes. We can kit, pack and blind ship to any number of locations worldwide with live tracking dashboards.',
    category: 'Logistics',
  },
  {
    question: 'Do you support customer-supplied goods?',
    answer:
      'We accept customer-supplied garments after a quality check and signed liability waiver.',
    category: 'Production',
  },
  {
    question: 'What design files should I upload?',
    answer:
      'Vector PDF, AI, EPS or high resolution PNG (300dpi) with transparent background deliver the best results. We can help clean up artwork if needed.',
    category: 'Design',
  },
];

export const stats = [
  { label: 'Average turnaround', value: '7.2 days' },
  { label: 'SKUs on platform', value: '82k+' },
  { label: 'Customer NPS', value: '74' },
  { label: 'Locations fulfilled', value: '3.2k' },
];

