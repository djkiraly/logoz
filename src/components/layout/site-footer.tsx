import Link from 'next/link';
import type { SiteSettings } from '@/lib/site-data';

const footerLinks = [
  {
    title: 'Platform',
    items: [
      { label: 'Product Catalog', href: '/products' },
      { label: 'Design Studio', href: '/design-studio' },
      { label: 'Supplier Hub', href: '/suppliers' },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Embroidery', href: '/services#embroidery' },
      { label: 'Direct to Fabric', href: '/services#dtf-printing' },
      { label: 'Signs & Graphics', href: '/services#signage' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'About', href: '/about' },
      { label: 'Resources', href: '/resources' },
      { label: 'Careers', href: '/about#careers' },
    ],
  },
];

type SiteFooterProps = {
  settings: SiteSettings;
};

export function SiteFooter({ settings }: SiteFooterProps) {
  return (
    <footer className="border-t border-white/10 bg-[#05060a]/80">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="space-y-3">
          <p className="text-lg font-semibold">{settings.siteName}</p>
          <p className="text-sm text-white/70">{settings.heroCopy}</p>
          <div className="text-sm text-white/70">
            <p>{settings.address}</p>
            <p>{settings.contactPhone}</p>
            <p>
              <a href={`mailto:${settings.contactEmail}`} className="underline">
                {settings.contactEmail}
              </a>
            </p>
          </div>
        </div>
        {footerLinks.map((column) => (
          <div key={column.title}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
              {column.title}
            </p>
            <ul className="space-y-2 text-sm text-white/70">
              {column.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {settings.siteName}. Crafted in the cloud.
      </div>
    </footer>
  );
}

