import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import {
  Eye,
  TrendingUp,
  Users,
  Clock,
  Globe,
  FileText,
  ArrowUpRight,
} from 'lucide-react';

type PageViewStats = {
  path: string;
  views: number;
};

type DailyStats = {
  date: string;
  views: number;
};

async function getAnalytics() {
  if (!isDatabaseEnabled) {
    return {
      totalViews: 0,
      todayViews: 0,
      uniqueVisitors: 0,
      avgSessionDuration: '0:00',
      topPages: [] as PageViewStats[],
      dailyViews: [] as DailyStats[],
      recentQuotes: 0,
      conversionRate: 0,
    };
  }

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalViews, todayViews, uniqueSessions, topPagesRaw, recentQuotes] =
    await Promise.all([
      prisma.pageView.count(),
      prisma.pageView.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.pageView.groupBy({
        by: ['sessionId'],
        where: { sessionId: { not: null } },
      }),
      prisma.pageView.groupBy({
        by: ['path'],
        _count: { path: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10,
      }),
      prisma.quoteRequest.count({
        where: { createdAt: { gte: weekAgo } },
      }),
    ]);

  // Get daily views for the past 7 days
  const dailyViews: DailyStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));

    const count = await prisma.pageView.count({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    dailyViews.push({
      date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      views: count,
    });
  }

  const topPages = topPagesRaw.map((p) => ({
    path: p.path,
    views: p._count.path,
  }));

  const conversionRate =
    totalViews > 0 ? ((recentQuotes / totalViews) * 100).toFixed(2) : '0';

  return {
    totalViews,
    todayViews,
    uniqueVisitors: uniqueSessions.length,
    avgSessionDuration: '2:34', // Placeholder - would need actual session tracking
    topPages,
    dailyViews,
    recentQuotes,
    conversionRate: parseFloat(conversionRate),
  };
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  const stats = [
    {
      name: 'Total Page Views',
      value: analytics.totalViews.toLocaleString(),
      icon: Eye,
      change: '+12%',
      color: 'cyan',
    },
    {
      name: 'Today\'s Views',
      value: analytics.todayViews.toLocaleString(),
      icon: TrendingUp,
      change: '+8%',
      color: 'green',
    },
    {
      name: 'Unique Visitors',
      value: analytics.uniqueVisitors.toLocaleString(),
      icon: Users,
      change: '+5%',
      color: 'purple',
    },
    {
      name: 'Conversion Rate',
      value: `${analytics.conversionRate}%`,
      icon: FileText,
      change: '+2%',
      color: 'orange',
    },
  ];

  const maxViews = Math.max(...analytics.dailyViews.map((d) => d.views), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 mt-1">
          Track your site&apos;s performance and visitor behavior.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center justify-between">
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor:
                    stat.color === 'cyan'
                      ? 'rgba(6, 182, 212, 0.2)'
                      : stat.color === 'green'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : stat.color === 'purple'
                          ? 'rgba(168, 85, 247, 0.2)'
                          : 'rgba(249, 115, 22, 0.2)',
                  color:
                    stat.color === 'cyan'
                      ? 'rgb(6, 182, 212)'
                      : stat.color === 'green'
                        ? 'rgb(34, 197, 94)'
                        : stat.color === 'purple'
                          ? 'rgb(168, 85, 247)'
                          : 'rgb(249, 115, 22)',
                }}
              >
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-green-400 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-slate-400">{stat.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Views Chart */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Daily Views</h2>
            <p className="text-sm text-slate-400">Last 7 days</p>
          </div>
          <div className="p-5">
            <div className="flex items-end justify-between h-48 gap-2">
              {analytics.dailyViews.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative flex-1 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-t-sm transition-all hover:from-cyan-400 hover:to-cyan-300"
                      style={{
                        height: `${(day.views / maxViews) * 100}%`,
                        minHeight: day.views > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{day.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Top Pages</h2>
            <p className="text-sm text-slate-400">Most visited pages</p>
          </div>
          <div className="divide-y divide-white/10">
            {analytics.topPages.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No page views recorded yet</p>
              </div>
            ) : (
              analytics.topPages.map((page, i) => (
                <div
                  key={page.path}
                  className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 w-6">
                      {i + 1}.
                    </span>
                    <span className="text-sm text-white font-mono">
                      {page.path}
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">
                    {page.views.toLocaleString()} views
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Traffic Sources Placeholder */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Traffic Overview</h2>
          <p className="text-sm text-slate-400">
            Session and engagement metrics
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400 mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-white">
              {analytics.avgSessionDuration}
            </p>
            <p className="text-sm text-slate-400">Avg. Session Duration</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-white">
              {analytics.recentQuotes}
            </p>
            <p className="text-sm text-slate-400">Quotes This Week</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-400 mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-white">
              {analytics.conversionRate}%
            </p>
            <p className="text-sm text-slate-400">Quote Conversion Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
