import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
  FileText,
  Package,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Clock,
} from 'lucide-react';

async function getStats() {
  if (!isDatabaseEnabled) {
    return {
      quotes: { total: 0, pending: 0, change: 0 },
      products: { total: 0, change: 0 },
      pageViews: { total: 0, today: 0, change: 0 },
      suppliers: { total: 0, active: 0 },
    };
  }

  const [quotesTotal, quotesPending, productsTotal, suppliersTotal, pageViewsToday] =
    await Promise.all([
      prisma.quoteRequest.count(),
      prisma.quoteRequest.count({ where: { status: 'PENDING' } }),
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.pageView.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

  return {
    quotes: { total: quotesTotal, pending: quotesPending, change: 12 },
    products: { total: productsTotal, change: 3 },
    pageViews: { total: pageViewsToday * 30, today: pageViewsToday, change: 8 },
    suppliers: { total: suppliersTotal, active: suppliersTotal },
  };
}

async function getRecentQuotes() {
  if (!isDatabaseEnabled) {
    return [];
  }

  return prisma.quoteRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}

export default async function AdminDashboard() {
  const stats = await getStats();
  const recentQuotes = await getRecentQuotes();

  const statCards = [
    {
      name: 'Total Quotes',
      value: stats.quotes.total,
      change: stats.quotes.change,
      icon: FileText,
      color: 'cyan',
      subtext: `${stats.quotes.pending} pending`,
    },
    {
      name: 'Products',
      value: stats.products.total,
      change: stats.products.change,
      icon: Package,
      color: 'purple',
    },
    {
      name: 'Page Views',
      value: stats.pageViews.today,
      change: stats.pageViews.change,
      icon: Eye,
      color: 'green',
      subtext: 'Today',
    },
    {
      name: 'Suppliers',
      value: stats.suppliers.total,
      change: 0,
      icon: Users,
      color: 'orange',
      subtext: `${stats.suppliers.active} active`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back! Here&apos;s what&apos;s happening with your store.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center justify-between">
              <div
                className={`p-2 rounded-lg bg-${stat.color}-500/20 text-${stat.color}-400`}
                style={{
                  backgroundColor:
                    stat.color === 'cyan'
                      ? 'rgba(6, 182, 212, 0.2)'
                      : stat.color === 'purple'
                        ? 'rgba(168, 85, 247, 0.2)'
                        : stat.color === 'green'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(249, 115, 22, 0.2)',
                  color:
                    stat.color === 'cyan'
                      ? 'rgb(6, 182, 212)'
                      : stat.color === 'purple'
                        ? 'rgb(168, 85, 247)'
                        : stat.color === 'green'
                          ? 'rgb(34, 197, 94)'
                          : 'rgb(249, 115, 22)',
                }}
              >
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.change !== 0 && (
                <div
                  className={`flex items-center gap-1 text-xs font-medium ${
                    stat.change > 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stat.change > 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(stat.change)}%
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-slate-400">{stat.name}</p>
              {stat.subtext && (
                <p className="text-xs text-slate-500 mt-1">{stat.subtext}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Quotes */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Quotes</h2>
            <a
              href="/admin/quotes"
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View all
            </a>
          </div>
        </div>
        <div className="divide-y divide-white/10">
          {recentQuotes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No quotes yet</p>
            </div>
          ) : (
            recentQuotes.map((quote) => (
              <div
                key={quote.id}
                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {quote.contactName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {quote.contactName}
                    </p>
                    <p className="text-xs text-slate-500">{quote.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      quote.status === 'PENDING'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : quote.status === 'APPROVED'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {quote.status}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          href="/admin/settings"
          className="flex items-center gap-4 p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
        >
          <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/30 transition-colors">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="font-medium text-white">Site Settings</p>
            <p className="text-sm text-slate-500">Configure your store</p>
          </div>
        </a>

        <a
          href="/admin/appearance"
          className="flex items-center gap-4 p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
        >
          <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="font-medium text-white">Appearance</p>
            <p className="text-sm text-slate-500">Customize your theme</p>
          </div>
        </a>

        <a
          href="/admin/analytics"
          className="flex items-center gap-4 p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
        >
          <div className="p-3 rounded-lg bg-green-500/20 text-green-400 group-hover:bg-green-500/30 transition-colors">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="font-medium text-white">Analytics</p>
            <p className="text-sm text-slate-500">View traffic data</p>
          </div>
        </a>
      </div>
    </div>
  );
}
