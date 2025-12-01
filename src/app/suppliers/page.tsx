import { SupplierMarquee } from '@/components/sections/supplier-marquee';
import { getSuppliers } from '@/lib/site-data';

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Supplier Hub</p>
        <h1 className="text-4xl font-semibold text-white">Preferred partner network</h1>
        <p className="text-base text-white/70">
          Connect to SanMar, alphabroder, S&S Activewear, LogoUp, specialty ateliers and regional
          fabrication labs through a single portal.
        </p>
      </div>
      <SupplierMarquee suppliers={suppliers} />
    </div>
  );
}




