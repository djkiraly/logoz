'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  FileText,
  Package,
  Users,
  Palette,
  Bell,
  Shield,
  X,
  Store,
  Building2,
  Wrench,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Site Settings', href: '/admin/settings', icon: Settings },
  { name: 'Appearance', href: '/admin/appearance', icon: Palette },
  { name: 'Services', href: '/admin/services', icon: Wrench },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Vendors', href: '/admin/vendors', icon: Store },
  { name: 'Customers', href: '/admin/customers', icon: Building2 },
  { name: 'Quotes', href: '/admin/quotes', icon: FileText },
  { name: 'Users', href: '/admin/users', icon: Users },
];

const secondaryNavigation: NavItem[] = [
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'Security', href: '/admin/security', icon: Shield },
];

export default function AdminSidebar({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        className={clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
          active
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        )}
      >
        <item.icon className="w-5 h-5" />
        {item.name}
        {item.badge && (
          <span className="ml-auto bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <div>
          <h1 className="text-white font-semibold">Logoz Admin</h1>
          <p className="text-xs text-slate-500">Control Panel</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Main
        </p>
        {navigation.map((item) => (
          <NavLink key={item.name} item={item} />
        ))}

        <div className="pt-4 mt-4 border-t border-white/10">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            System
          </p>
          {secondaryNavigation.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-medium">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.role}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-slate-800 text-white"
        aria-label="Open menu"
      >
        <LayoutDashboard className="w-5 h-5" />
      </button>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-white/10 flex flex-col">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-slate-900 border-r border-white/10">
        <SidebarContent />
      </div>
    </>
  );
}
