import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import './globals.css';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Providers } from '@/components/providers';
import { getSiteSettings } from '@/lib/site-data';
import { PageTracker } from '@/components/analytics/page-tracker';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    metadataBase: new URL('https://logoz-cloud.vercel.app'),
    title: {
      default: settings.siteName || 'Logoz Cloud Print Studio',
      template: `%s | ${settings.siteName || 'Logoz Cloud Print Studio'}`,
    },
    description:
      'A modern rushordertees-inspired storefront for on-demand apparel, embroidery, signage and premium merch programs.',
    openGraph: {
      title: settings.siteName || 'Logoz Cloud Print Studio',
      description:
        'Design, source and fulfill custom merch, signage, embroidery and experiential installs from one dashboard.',
      type: 'website',
      url: 'https://logoz-cloud.vercel.app',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
          width: 1200,
          height: 630,
        },
      ],
    },
    icons: {
      icon: settings.faviconUrl || '/favicon.ico',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  // Check if this is an admin route to hide public site chrome
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '';
  const isAdminRoute = pathname.startsWith('/admin');

  // For admin routes, render without public header/footer
  if (isAdminRoute) {
    return (
      <html lang="en">
        <body className={`${display.variable} antialiased`}>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${display.variable} antialiased`}>
        <Providers>
          <Suspense fallback={null}>
            <PageTracker />
          </Suspense>
          <div className="flex min-h-screen flex-col bg-[#05060a]">
            <SiteHeader settings={settings} />
            <main className="flex-1">{children}</main>
            <SiteFooter settings={settings} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
