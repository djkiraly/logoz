import { redirect } from 'next/navigation';
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

  // Check if we're on the login page
  // This is a simplified check - middleware handles proper routing
  const isLoginPage =
    typeof window === 'undefined'
      ? false
      : window.location.pathname === '/admin/login';

  // Don't require auth for login page
  if (!user && !isLoginPage) {
    // We'll handle this in middleware, but this is a fallback
    redirect('/admin/login');
  }

  // If on login page and already authenticated, redirect to dashboard
  if (user && isLoginPage) {
    redirect('/admin');
  }

  // Login page has its own layout
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
