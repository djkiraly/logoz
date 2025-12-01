import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="glass-panel max-w-md rounded-3xl p-8 text-center">
        <div className="mb-6">
          <span className="text-8xl font-bold text-white/20">404</span>
        </div>

        <h2 className="mb-3 text-2xl font-bold text-white">Page Not Found</h2>

        <p className="mb-8 text-white/70">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-gray-900 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>

          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <Search className="h-4 w-4" />
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
}
