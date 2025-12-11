'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Users,
  Clock,
  TrendingUp,
  FileText,
  ShoppingCart,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Calendar,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Package,
} from 'lucide-react';
import {
  DailyViewsChart,
  DeviceBreakdownChart,
  BrowserChart,
  QuoteFunnelChart,
  QuoteStatusChart,
  TopProductsChart,
} from '@/components/admin/analytics-charts';

type DateRange = '7d' | '30d' | '90d' | '1y';

interface AnalyticsData {
  summary: {
    pageViews: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
    conversionRate: number;
    quotesSubmitted: number;
    productViews: number;
  };
  trends: {
    pageViews: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
    conversionRate: number;
    productViews: number;
  };
  funnel: {
    viewedProducts: number;
    startedQuote: number;
    addedItems: number;
    submittedInfo: number;
    quoteSent: number;
    quoteApproved: number;
    quoteRejected: number;
  };
  topPages: Array<{ path: string; views: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    imageUrl?: string;
    views: number;
  }>;
  devices: { desktop: number; mobile: number; tablet: number };
  browsers: Array<{ browser: string; count: number }>;
  dailyViews: Array<{ date: string; views: number; visitors: number }>;
  quotePerformance: {
    totalQuotes: number;
    avgTimeToApproval: number;
    avgQuoteValue: number;
    approvalRate: number;
    statusBreakdown: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    entityType: string;
    activityType: string;
    entityId: string;
    createdAt: string;
  }>;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('7d');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?range=${range}`);
      const result = await response.json();
      if (result.ok) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Helper to format trend percentage
  const formatTrend = (value: number): string => {
    const rounded = Math.round(value * 10) / 10;
    return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
  };

  // Helper to determine if trend is positive (depends on metric type)
  const isTrendPositive = (value: number, isLowerBetter: boolean = false): boolean => {
    return isLowerBetter ? value < 0 : value > 0;
  };

  const stats = data
    ? [
        {
          name: 'Total Page Views',
          value: data.summary.pageViews.toLocaleString(),
          icon: Eye,
          change: formatTrend(data.trends.pageViews),
          positive: isTrendPositive(data.trends.pageViews),
          color: 'cyan',
        },
        {
          name: 'Unique Visitors',
          value: data.summary.uniqueVisitors.toLocaleString(),
          icon: Users,
          change: formatTrend(data.trends.uniqueVisitors),
          positive: isTrendPositive(data.trends.uniqueVisitors),
          color: 'purple',
        },
        {
          name: 'Avg. Session',
          value: formatDuration(data.summary.avgSessionDuration),
          icon: Clock,
          change: formatTrend(data.trends.avgSessionDuration),
          positive: isTrendPositive(data.trends.avgSessionDuration),
          color: 'green',
        },
        {
          name: 'Bounce Rate',
          value: `${data.summary.bounceRate.toFixed(1)}%`,
          icon: TrendingUp,
          change: formatTrend(data.trends.bounceRate),
          positive: isTrendPositive(data.trends.bounceRate, true), // Lower bounce rate is better
          color: 'orange',
        },
        {
          name: 'Conversion Rate',
          value: `${data.summary.conversionRate.toFixed(2)}%`,
          icon: FileText,
          change: formatTrend(data.trends.conversionRate),
          positive: isTrendPositive(data.trends.conversionRate),
          color: 'cyan',
        },
        {
          name: 'Product Views',
          value: data.summary.productViews.toLocaleString(),
          icon: Package,
          change: formatTrend(data.trends.productViews),
          positive: isTrendPositive(data.trends.productViews),
          color: 'purple',
        },
      ]
    : [];

  const deviceTotal =
    (data?.devices.desktop || 0) +
    (data?.devices.mobile || 0) +
    (data?.devices.tablet || 0);

  const getDevicePercent = (count: number) =>
    deviceTotal > 0 ? ((count / deviceTotal) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Track website performance, visitor behavior, and conversion metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center bg-white/5 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  range === r
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === '7d'
                  ? '7 Days'
                  : r === '30d'
                    ? '30 Days'
                    : r === '90d'
                      ? '90 Days'
                      : '1 Year'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.name}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
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
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      stat.positive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {stat.positive ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {stat.change}
                  </span>
                </div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.name}</p>
              </div>
            ))}
          </div>

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Views Chart */}
            <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Traffic Overview
                    </h2>
                    <p className="text-sm text-slate-400">
                      Page views and unique visitors
                    </p>
                  </div>
                  <Calendar className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="p-5">
                {data?.dailyViews && data.dailyViews.length > 0 ? (
                  <DailyViewsChart data={data.dailyViews} />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-slate-500">
                    No traffic data available
                  </div>
                )}
              </div>
            </div>

            {/* Device Breakdown */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">
                  Device Breakdown
                </h2>
                <p className="text-sm text-slate-400">Visitor devices</p>
              </div>
              <div className="p-5">
                {data?.devices && deviceTotal > 0 ? (
                  <>
                    <DeviceBreakdownChart data={data.devices} />
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="text-center">
                        <Monitor className="w-5 h-5 mx-auto text-cyan-400 mb-1" />
                        <p className="text-xs text-slate-400">Desktop</p>
                        <p className="text-sm font-medium text-white">
                          {getDevicePercent(data.devices.desktop)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <Smartphone className="w-5 h-5 mx-auto text-purple-400 mb-1" />
                        <p className="text-xs text-slate-400">Mobile</p>
                        <p className="text-sm font-medium text-white">
                          {getDevicePercent(data.devices.mobile)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <Tablet className="w-5 h-5 mx-auto text-green-400 mb-1" />
                        <p className="text-xs text-slate-400">Tablet</p>
                        <p className="text-sm font-medium text-white">
                          {getDevicePercent(data.devices.tablet)}%
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-500">
                    No device data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quote Funnel & Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quote Funnel */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Quote Funnel
                    </h2>
                    <p className="text-sm text-slate-400">
                      Conversion through quote stages
                    </p>
                  </div>
                  <ShoppingCart className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="p-5">
                {data?.funnel ? (
                  <QuoteFunnelChart data={data.funnel} />
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-slate-500">
                    No funnel data available
                  </div>
                )}
              </div>
            </div>

            {/* Quote Performance */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">
                  Quote Performance
                </h2>
                <p className="text-sm text-slate-400">
                  Quote metrics and status
                </p>
              </div>
              <div className="p-5">
                {data?.quotePerformance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-slate-400">Total Quotes</p>
                        <p className="text-xl font-bold text-white">
                          {data.quotePerformance.totalQuotes}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-slate-400">Avg. Value</p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(data.quotePerformance.avgQuoteValue)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-slate-400">Approval Rate</p>
                        <p className="text-xl font-bold text-green-400">
                          {data.quotePerformance.approvalRate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-slate-400">
                          Avg. Time to Approval
                        </p>
                        <p className="text-xl font-bold text-white">
                          {data.quotePerformance.avgTimeToApproval}h
                        </p>
                      </div>
                    </div>
                    <QuoteStatusChart
                      data={data.quotePerformance.statusBreakdown}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-slate-500">
                    No quote data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Pages */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Top Pages
                    </h2>
                    <p className="text-sm text-slate-400">Most visited</p>
                  </div>
                  <Globe className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="divide-y divide-white/10 max-h-[300px] overflow-y-auto">
                {data?.topPages && data.topPages.length > 0 ? (
                  data.topPages.map((page, i) => (
                    <div
                      key={page.path}
                      className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-slate-500 w-5">
                          {i + 1}.
                        </span>
                        <span className="text-sm text-white font-mono truncate">
                          {page.path}
                        </span>
                      </div>
                      <span className="text-sm text-slate-400 ml-2">
                        {page.views.toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    No page data available
                  </div>
                )}
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Top Products
                    </h2>
                    <p className="text-sm text-slate-400">Most viewed</p>
                  </div>
                  <Package className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="p-5">
                {data?.topProducts && data.topProducts.length > 0 ? (
                  <TopProductsChart data={data.topProducts} />
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-slate-500">
                    No product data available
                  </div>
                )}
              </div>
            </div>

            {/* Browser Distribution */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <div className="p-5 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Browsers</h2>
                <p className="text-sm text-slate-400">Browser distribution</p>
              </div>
              <div className="p-5">
                {data?.browsers && data.browsers.length > 0 ? (
                  <BrowserChart data={data.browsers} />
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-500">
                    No browser data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
