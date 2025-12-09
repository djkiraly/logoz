import { getCurrentUser } from '@/lib/auth';
import AdminSidebar from '@/components/admin/admin-sidebar';
import AdminHeader from '@/components/admin/admin-header';

export const metadata = {
  title: 'Admin - Logoz',
  robots: 'noindex, nofollow',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // If not authenticated, render children without admin chrome
  // The individual pages/middleware will handle redirects
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <AdminSidebar user={user} />
      <div className="lg:pl-64">
        <AdminHeader user={user} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
