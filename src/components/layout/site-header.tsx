'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { SiteSettings } from '@/lib/site-data';

const navigation = [
  { label: 'Products', href: '/products' },
  { label: 'Design Studio', href: '/design-studio' },
  { label: 'Services', href: '/services' },
  { label: 'Suppliers', href: '/suppliers' },
  { label: 'Resources', href: '/resources' },
];

type SiteHeaderProps = {
  settings: SiteSettings;
};

export function SiteHeader({ settings }: SiteHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05060a]/80 backdrop-blur-xl">
      {settings.bannerEnabled && settings.announcement ? (
        <div className="bg-gradient-to-r from-indigo-500 to-orange-400 px-4 py-2 text-center text-sm text-white">
          {settings.announcement}
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center">
          {settings.logoUrl && settings.logoUrl.length > 0 ? (
            <Image
              src={settings.logoUrl}
              alt={settings.siteName || 'Logo'}
              width={200}
              height={125}
              className="max-h-[125px] w-auto object-contain"
              unoptimized
              priority
            />
          ) : (
            <span className="text-lg font-semibold tracking-tight">
              {settings.siteName || 'Logoz Custom'}
            </span>
          )}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-white/80 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white hover:border-white/60 lg:inline-flex"
          >
            Talk to sales
          </Link>
          {settings.headerCtaEnabled && (
            <Link
              href={settings.headerCtaLink || '/design-studio'}
              className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-[0_15px_35px_rgba(107,114,255,0.35)] lg:inline-flex"
            >
              {settings.headerCtaLabel || 'Build a design'}
            </Link>
          )}
          <button
            className="rounded-full border border-white/20 p-2 text-white lg:hidden"
            aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setIsOpen((state) => !state)}
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-white/10 px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-3 text-base">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl bg-white/5 px-4 py-3"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className="rounded-2xl bg-white px-4 py-3 text-center font-semibold text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              Launch a project
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

