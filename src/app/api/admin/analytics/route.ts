import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';
import { isDatabaseEnabled } from '@/lib/prisma';
import {
  getAnalyticsSummaryWithTrends,
  getQuoteFunnelMetrics,
  getTopPages,
  getTopProducts,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getDailyViewsChart,
  getQuotePerformanceMetrics,
  getRecentActivity,
  type DateRange,
} from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({
        ok: true,
        data: {
          summary: {
            pageViews: 0,
            uniqueVisitors: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            conversionRate: 0,
            quotesSubmitted: 0,
            productViews: 0,
          },
          trends: {
            pageViews: 0,
            uniqueVisitors: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            conversionRate: 0,
            productViews: 0,
          },
          funnel: {},
          topPages: [],
          topProducts: [],
          devices: { desktop: 0, mobile: 0, tablet: 0 },
          browsers: [],
          dailyViews: [],
          quotePerformance: {},
          recentActivity: [],
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '7d') as DateRange;

    // Fetch all analytics data in parallel
    const [
      summaryWithTrends,
      funnel,
      topPages,
      topProducts,
      devices,
      browsers,
      dailyViews,
      quotePerformance,
      recentActivity,
    ] = await Promise.all([
      getAnalyticsSummaryWithTrends(range),
      getQuoteFunnelMetrics(range),
      getTopPages(range, 10),
      getTopProducts(range, 10),
      getDeviceBreakdown(range),
      getBrowserBreakdown(range),
      getDailyViewsChart(range),
      getQuotePerformanceMetrics(range),
      getRecentActivity(20),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        summary: summaryWithTrends.current,
        trends: summaryWithTrends.trends,
        funnel,
        topPages,
        topProducts,
        devices,
        browsers,
        dailyViews,
        quotePerformance,
        recentActivity,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
