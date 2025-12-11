'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

// Custom tooltip style
const customTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '12px',
};

// Color palette
const COLORS = {
  primary: '#06b6d4',
  secondary: '#a855f7',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  neutral: '#64748b',
};

const CHART_COLORS = ['#06b6d4', '#a855f7', '#22c55e', '#f97316', '#3b82f6'];

// Daily Views Area Chart
export function DailyViewsChart({
  data,
}: {
  data: Array<{ date: string; views: number; visitors: number }>;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={customTooltipStyle}
          labelStyle={{ color: '#fff', marginBottom: '8px' }}
          itemStyle={{ color: '#94a3b8' }}
          labelFormatter={formatDate}
        />
        <Area
          type="monotone"
          dataKey="views"
          name="Page Views"
          stroke={COLORS.primary}
          fillOpacity={1}
          fill="url(#colorViews)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="visitors"
          name="Visitors"
          stroke={COLORS.secondary}
          fillOpacity={1}
          fill="url(#colorVisitors)"
          strokeWidth={2}
        />
        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Device Breakdown Pie Chart
export function DeviceBreakdownChart({
  data,
}: {
  data: { desktop: number; mobile: number; tablet: number };
}) {
  const chartData = [
    { name: 'Desktop', value: data.desktop, color: COLORS.primary },
    { name: 'Mobile', value: data.mobile, color: COLORS.secondary },
    { name: 'Tablet', value: data.tablet, color: COLORS.success },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={customTooltipStyle}
          formatter={(value: number) => [
            `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
            'Visits',
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Browser Distribution Bar Chart
export function BrowserChart({
  data,
}: {
  data: Array<{ browser: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          type="number"
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="browser"
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
          width={80}
        />
        <Tooltip
          contentStyle={customTooltipStyle}
          formatter={(value: number) => [value.toLocaleString(), 'Views']}
        />
        <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Quote Funnel Chart
export function QuoteFunnelChart({
  data,
}: {
  data: {
    viewedProducts: number;
    startedQuote: number;
    addedItems: number;
    submittedInfo: number;
    quoteSent: number;
    quoteApproved: number;
  };
}) {
  const funnelData = [
    { name: 'Viewed Products', value: data.viewedProducts, fill: COLORS.primary },
    { name: 'Started Quote', value: data.startedQuote, fill: '#0891b2' },
    { name: 'Added Items', value: data.addedItems, fill: COLORS.secondary },
    { name: 'Submitted', value: data.submittedInfo, fill: '#7c3aed' },
    { name: 'Quote Sent', value: data.quoteSent, fill: COLORS.success },
    { name: 'Approved', value: data.quoteApproved, fill: '#15803d' },
  ];

  const maxValue = Math.max(...funnelData.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {funnelData.map((stage, i) => {
        const width = (stage.value / maxValue) * 100;
        const conversionFromPrev =
          i > 0 && funnelData[i - 1].value > 0
            ? ((stage.value / funnelData[i - 1].value) * 100).toFixed(1)
            : null;

        return (
          <div key={stage.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{stage.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">
                  {stage.value.toLocaleString()}
                </span>
                {conversionFromPrev && (
                  <span className="text-xs text-slate-500">
                    ({conversionFromPrev}%)
                  </span>
                )}
              </div>
            </div>
            <div className="h-6 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(width, 2)}%`,
                  backgroundColor: stage.fill,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Quote Status Breakdown
export function QuoteStatusChart({
  data,
}: {
  data: Record<string, number>;
}) {
  const statusColors: Record<string, string> = {
    PENDING: COLORS.warning,
    REVIEWING: COLORS.primary,
    SENT: COLORS.secondary,
    APPROVED: COLORS.success,
    ARCHIVED: COLORS.neutral,
  };

  const chartData = Object.entries(data).map(([status, count]) => ({
    name: status.charAt(0) + status.slice(1).toLowerCase(),
    value: count,
    color: statusColors[status] || COLORS.neutral,
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-500">
        No quote data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={customTooltipStyle}
          formatter={(value: number) => [
            `${value} (${((value / total) * 100).toFixed(1)}%)`,
            'Quotes',
          ]}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Top Products Bar Chart
export function TopProductsChart({
  data,
}: {
  data: Array<{ productId: string; name: string; views: number }>;
}) {
  const chartData = data.slice(0, 5).map((p) => ({
    name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
    views: p.views,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          type="number"
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
          width={120}
        />
        <Tooltip
          contentStyle={customTooltipStyle}
          formatter={(value: number) => [value.toLocaleString(), 'Views']}
        />
        <Bar dataKey="views" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Performance Metrics Line Chart
export function PerformanceChart({
  data,
}: {
  data: Array<{ date: string; value: number }>;
  label?: string;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={customTooltipStyle}
          labelFormatter={formatDate}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={COLORS.success}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
