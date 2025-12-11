import { prisma, isDatabaseEnabled } from './prisma';
import type { EntityType, ActivityType, QuoteFunnelStage } from '@prisma/client';

// ===========================================
// User Agent Parser
// ===========================================

interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return { deviceType: 'desktop', browser: 'Unknown', os: 'Unknown' };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
  else if (ua.includes('msie') || ua.includes('trident')) browser = 'IE';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { deviceType, browser, os };
}

// ===========================================
// Session Management
// ===========================================

export async function getOrCreateSession(
  sessionId: string,
  data: {
    path: string;
    referrer?: string;
    ipAddress?: string;
    userAgent?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }
) {
  if (!isDatabaseEnabled) return null;

  const deviceInfo = parseUserAgent(data.userAgent || null);

  try {
    // Try to find existing session
    const existing = await prisma.analyticsSession.findUnique({
      where: { sessionId },
    });

    if (existing) {
      // Update last active time and page count
      return await prisma.analyticsSession.update({
        where: { sessionId },
        data: {
          lastActiveAt: new Date(),
          pageCount: { increment: 1 },
        },
      });
    }

    // Create new session
    return await prisma.analyticsSession.create({
      data: {
        sessionId,
        firstPage: data.path,
        landingPage: data.path,
        referrer: data.referrer,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: data.ipAddress,
      },
    });
  } catch {
    return null;
  }
}

export async function updateSessionDuration(
  sessionId: string,
  additionalSeconds: number
) {
  if (!isDatabaseEnabled) return;

  try {
    await prisma.analyticsSession.update({
      where: { sessionId },
      data: {
        totalDuration: { increment: additionalSeconds },
        lastActiveAt: new Date(),
      },
    });
  } catch {
    // Silent fail
  }
}

export async function markSessionConverted(
  sessionId: string,
  quoteId: string
) {
  if (!isDatabaseEnabled) return;

  try {
    await prisma.analyticsSession.update({
      where: { sessionId },
      data: {
        convertedToQuote: true,
        quoteId,
      },
    });
  } catch {
    // Silent fail
  }
}

// ===========================================
// Page View Tracking
// ===========================================

export async function trackPageView(data: {
  path: string;
  sessionId?: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  duration?: number;
  scrollDepth?: number;
  isAdmin?: boolean;
}) {
  if (!isDatabaseEnabled) return null;

  const deviceInfo = parseUserAgent(data.userAgent || null);

  try {
    return await prisma.pageView.create({
      data: {
        path: data.path,
        sessionId: data.sessionId,
        referrer: data.referrer,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        duration: data.duration,
        scrollDepth: data.scrollDepth,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        isAdmin: data.isAdmin || false,
      },
    });
  } catch {
    return null;
  }
}

export async function updatePageViewDuration(
  pageViewId: string,
  duration: number,
  scrollDepth?: number
) {
  if (!isDatabaseEnabled) return;

  try {
    await prisma.pageView.update({
      where: { id: pageViewId },
      data: {
        duration,
        scrollDepth,
      },
    });
  } catch {
    // Silent fail
  }
}

// ===========================================
// Product View Tracking
// ===========================================

export async function trackProductView(data: {
  productId: string;
  sessionId?: string;
  ipAddress?: string;
  referrer?: string;
}) {
  if (!isDatabaseEnabled) return null;

  try {
    return await prisma.productView.create({
      data: {
        productId: data.productId,
        sessionId: data.sessionId,
        ipAddress: data.ipAddress,
        referrer: data.referrer,
      },
    });
  } catch {
    return null;
  }
}

export async function markProductViewAddedToQuote(productViewId: string) {
  if (!isDatabaseEnabled) return;

  try {
    await prisma.productView.update({
      where: { id: productViewId },
      data: { addedToQuote: true },
    });
  } catch {
    // Silent fail
  }
}

// ===========================================
// Quote Funnel Tracking
// ===========================================

export async function trackQuoteFunnelEvent(data: {
  stage: QuoteFunnelStage;
  sessionId?: string;
  quoteId?: string;
  customerId?: string;
  productIds?: string[];
  metadata?: Record<string, unknown>;
}) {
  if (!isDatabaseEnabled) return null;

  try {
    return await prisma.quoteFunnelEvent.create({
      data: {
        stage: data.stage,
        sessionId: data.sessionId,
        quoteId: data.quoteId,
        customerId: data.customerId,
        productIds: data.productIds || [],
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });
  } catch {
    return null;
  }
}

// ===========================================
// Entity Activity Tracking
// ===========================================

export async function trackEntityActivity(data: {
  entityType: EntityType;
  entityId: string;
  activityType: ActivityType;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}) {
  if (!isDatabaseEnabled) return null;

  try {
    return await prisma.entityActivity.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        activityType: data.activityType,
        userId: data.userId,
        sessionId: data.sessionId,
        ipAddress: data.ipAddress,
        oldValue: data.oldValue ? JSON.parse(JSON.stringify(data.oldValue)) : undefined,
        newValue: data.newValue ? JSON.parse(JSON.stringify(data.newValue)) : undefined,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });
  } catch {
    return null;
  }
}

// ===========================================
// Daily Analytics Aggregation
// ===========================================

export async function aggregateDailyAnalytics(date: Date = new Date()) {
  if (!isDatabaseEnabled) return null;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Get page view stats (excluding admin views for public metrics)
    const [
      pageViews,
      uniqueVisitors,
      sessions,
      productViews,
      quotesStarted,
      quotesSubmitted,
      quotesApproved,
      approvedQuotesTotals,
      deviceBreakdown,
      topPagesRaw,
    ] = await Promise.all([
      // Total page views (public site only, exclude admin paths)
      prisma.pageView.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          isAdmin: false,
          NOT: { path: { startsWith: '/admin' } },
        },
      }),
      // Unique visitors (by session, public site only, exclude admin paths)
      prisma.pageView.groupBy({
        by: ['sessionId'],
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          sessionId: { not: null },
          isAdmin: false,
          NOT: { path: { startsWith: '/admin' } },
        },
      }),
      // Sessions for duration calc
      prisma.analyticsSession.findMany({
        where: { startedAt: { gte: startOfDay, lte: endOfDay } },
        select: { totalDuration: true, pageCount: true },
      }),
      // Product views
      prisma.productView.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
      // Quote funnel stages
      prisma.quoteFunnelEvent.count({
        where: {
          stage: 'STARTED_QUOTE',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.quoteFunnelEvent.count({
        where: {
          stage: 'SUBMITTED_INFO',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.quoteFunnelEvent.count({
        where: {
          stage: 'QUOTE_APPROVED',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      // Approved quotes value
      prisma.quote.aggregate({
        where: {
          status: 'APPROVED',
          approvedAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
      }),
      // Device breakdown (public site only, exclude admin paths)
      prisma.pageView.groupBy({
        by: ['deviceType'],
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          isAdmin: false,
          NOT: { path: { startsWith: '/admin' } },
        },
        _count: true,
      }),
      // Top products
      prisma.productView.groupBy({
        by: ['productId'],
        where: { createdAt: { gte: startOfDay, lte: endOfDay } },
        _count: true,
        orderBy: { _count: { productId: 'desc' } },
        take: 10,
      }),
    ]);

    // Calculate metrics
    const avgSessionDuration = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.totalDuration, 0) / sessions.length)
      : 0;

    const avgPageViews = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.pageCount, 0) / sessions.length
      : 0;

    const conversionRate = uniqueVisitors.length > 0
      ? (quotesSubmitted / uniqueVisitors.length) * 100
      : 0;

    // Calculate bounce rate (sessions with only 1 page)
    const singlePageSessions = sessions.filter(s => s.pageCount === 1).length;
    const bounceRate = sessions.length > 0
      ? (singlePageSessions / sessions.length) * 100
      : 0;

    // Device breakdown
    const desktopVisits = deviceBreakdown.find(d => d.deviceType === 'desktop')?._count || 0;
    const mobileVisits = deviceBreakdown.find(d => d.deviceType === 'mobile')?._count || 0;
    const tabletVisits = deviceBreakdown.find(d => d.deviceType === 'tablet')?._count || 0;

    // Top products
    const topProducts = topPagesRaw.map(p => ({
      productId: p.productId,
      views: p._count,
    }));

    // Upsert daily analytics
    return await prisma.dailyAnalytics.upsert({
      where: { date: startOfDay },
      create: {
        date: startOfDay,
        pageViews,
        uniqueVisitors: uniqueVisitors.length,
        avgSessionDuration,
        avgPageViews,
        bounceRate,
        quotesStarted,
        quotesSubmitted,
        quotesApproved,
        conversionRate,
        productViews,
        topProducts,
        desktopVisits,
        mobileVisits,
        tabletVisits,
        quotesValue: approvedQuotesTotals._sum.total || 0,
      },
      update: {
        pageViews,
        uniqueVisitors: uniqueVisitors.length,
        avgSessionDuration,
        avgPageViews,
        bounceRate,
        quotesStarted,
        quotesSubmitted,
        quotesApproved,
        conversionRate,
        productViews,
        topProducts,
        desktopVisits,
        mobileVisits,
        tabletVisits,
        quotesValue: approvedQuotesTotals._sum.total || 0,
      },
    });
  } catch {
    return null;
  }
}

// ===========================================
// Analytics Query Helpers
// ===========================================

export type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';

export function getDateRangeStart(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date(0);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export async function getAnalyticsSummary(range: DateRange = '7d') {
  if (!isDatabaseEnabled) {
    return {
      pageViews: 0,
      uniqueVisitors: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      conversionRate: 0,
      quotesSubmitted: 0,
      productViews: 0,
    };
  }

  const startDate = getDateRangeStart(range);

  const [pageViews, uniqueVisitors, sessions, productViews, quotesSubmitted] = await Promise.all([
    // Public site page views only (exclude admin paths)
    prisma.pageView.count({
      where: {
        createdAt: { gte: startDate },
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      },
    }),
    // Public site visitors only (exclude admin paths)
    prisma.pageView.groupBy({
      by: ['sessionId'],
      where: {
        createdAt: { gte: startDate },
        sessionId: { not: null },
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      },
    }),
    prisma.analyticsSession.findMany({
      where: { startedAt: { gte: startDate } },
      select: { totalDuration: true, pageCount: true },
    }),
    prisma.productView.count({
      where: { createdAt: { gte: startDate } },
    }),
    prisma.quoteFunnelEvent.count({
      where: {
        stage: 'SUBMITTED_INFO',
        createdAt: { gte: startDate },
      },
    }),
  ]);

  const avgSessionDuration = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.totalDuration, 0) / sessions.length)
    : 0;

  const singlePageSessions = sessions.filter(s => s.pageCount === 1).length;
  const bounceRate = sessions.length > 0
    ? (singlePageSessions / sessions.length) * 100
    : 0;

  const conversionRate = uniqueVisitors.length > 0
    ? (quotesSubmitted / uniqueVisitors.length) * 100
    : 0;

  return {
    pageViews,
    uniqueVisitors: uniqueVisitors.length,
    avgSessionDuration,
    bounceRate,
    conversionRate,
    quotesSubmitted,
    productViews,
  };
}

/**
 * Get analytics summary for a specific date range (for trend calculations)
 */
async function getAnalyticsSummaryForPeriod(startDate: Date, endDate: Date) {
  if (!isDatabaseEnabled) {
    return {
      pageViews: 0,
      uniqueVisitors: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      conversionRate: 0,
      quotesSubmitted: 0,
      productViews: 0,
    };
  }

  const [pageViews, uniqueVisitors, sessions, productViews, quotesSubmitted] = await Promise.all([
    prisma.pageView.count({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      },
    }),
    prisma.pageView.groupBy({
      by: ['sessionId'],
      where: {
        createdAt: { gte: startDate, lt: endDate },
        sessionId: { not: null },
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      },
    }),
    prisma.analyticsSession.findMany({
      where: { startedAt: { gte: startDate, lt: endDate } },
      select: { totalDuration: true, pageCount: true },
    }),
    prisma.productView.count({
      where: { createdAt: { gte: startDate, lt: endDate } },
    }),
    prisma.quoteFunnelEvent.count({
      where: {
        stage: 'SUBMITTED_INFO',
        createdAt: { gte: startDate, lt: endDate },
      },
    }),
  ]);

  const avgSessionDuration = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.totalDuration, 0) / sessions.length)
    : 0;

  const singlePageSessions = sessions.filter(s => s.pageCount === 1).length;
  const bounceRate = sessions.length > 0
    ? (singlePageSessions / sessions.length) * 100
    : 0;

  const conversionRate = uniqueVisitors.length > 0
    ? (quotesSubmitted / uniqueVisitors.length) * 100
    : 0;

  return {
    pageViews,
    uniqueVisitors: uniqueVisitors.length,
    avgSessionDuration,
    bounceRate,
    conversionRate,
    quotesSubmitted,
    productViews,
  };
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Get analytics summary with trend data compared to previous period
 */
export async function getAnalyticsSummaryWithTrends(range: DateRange = '7d') {
  if (!isDatabaseEnabled) {
    return {
      current: {
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
    };
  }

  const now = new Date();
  let currentStart: Date;
  let previousStart: Date;
  let previousEnd: Date;

  // Calculate the current period and previous period based on range
  switch (range) {
    case '7d':
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      previousStart = new Date(currentStart.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      currentStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      previousStart = new Date(currentStart.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  // Fetch current and previous period data in parallel
  const [current, previous] = await Promise.all([
    getAnalyticsSummaryForPeriod(currentStart, now),
    getAnalyticsSummaryForPeriod(previousStart, previousEnd),
  ]);

  // Calculate trends (percentage change from previous period)
  const trends = {
    pageViews: calculatePercentageChange(current.pageViews, previous.pageViews),
    uniqueVisitors: calculatePercentageChange(current.uniqueVisitors, previous.uniqueVisitors),
    avgSessionDuration: calculatePercentageChange(current.avgSessionDuration, previous.avgSessionDuration),
    bounceRate: calculatePercentageChange(current.bounceRate, previous.bounceRate),
    conversionRate: calculatePercentageChange(current.conversionRate, previous.conversionRate),
    productViews: calculatePercentageChange(current.productViews, previous.productViews),
  };

  return {
    current,
    trends,
  };
}

export async function getQuoteFunnelMetrics(range: DateRange = '7d') {
  if (!isDatabaseEnabled) {
    return {
      viewedProducts: 0,
      startedQuote: 0,
      addedItems: 0,
      submittedInfo: 0,
      quoteSent: 0,
      quoteApproved: 0,
      quoteRejected: 0,
    };
  }

  const startDate = getDateRangeStart(range);

  const stages = await prisma.quoteFunnelEvent.groupBy({
    by: ['stage'],
    where: { createdAt: { gte: startDate } },
    _count: true,
  });

  const getCount = (stage: QuoteFunnelStage) =>
    stages.find(s => s.stage === stage)?._count || 0;

  return {
    viewedProducts: getCount('VIEWED_PRODUCTS'),
    startedQuote: getCount('STARTED_QUOTE'),
    addedItems: getCount('ADDED_ITEMS'),
    submittedInfo: getCount('SUBMITTED_INFO'),
    quoteSent: getCount('QUOTE_SENT'),
    quoteApproved: getCount('QUOTE_APPROVED'),
    quoteRejected: getCount('QUOTE_REJECTED'),
  };
}

export async function getTopPages(range: DateRange = '7d', limit: number = 10, includeAdmin: boolean = false) {
  if (!isDatabaseEnabled) return [];

  const startDate = getDateRangeStart(range);

  const pages = await prisma.pageView.groupBy({
    by: ['path'],
    where: {
      createdAt: { gte: startDate },
      ...(includeAdmin ? {} : {
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      }),
    },
    _count: { path: true },
    orderBy: { _count: { path: 'desc' } },
    take: limit,
  });

  return pages.map(p => ({
    path: p.path,
    views: p._count.path,
  }));
}

export async function getTopProducts(range: DateRange = '7d', limit: number = 10) {
  if (!isDatabaseEnabled) return [];

  const startDate = getDateRangeStart(range);

  const productViews = await prisma.productView.groupBy({
    by: ['productId'],
    where: { createdAt: { gte: startDate } },
    _count: true,
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });

  // Get product details
  const productIds = productViews.map(p => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, heroImageUrl: true },
  });

  return productViews.map(pv => {
    const product = products.find(p => p.id === pv.productId);
    return {
      productId: pv.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || '',
      imageUrl: product?.heroImageUrl,
      views: pv._count,
    };
  });
}

export async function getDeviceBreakdown(range: DateRange = '7d', includeAdmin: boolean = false) {
  if (!isDatabaseEnabled) {
    return { desktop: 0, mobile: 0, tablet: 0 };
  }

  const startDate = getDateRangeStart(range);

  const breakdown = await prisma.pageView.groupBy({
    by: ['deviceType'],
    where: {
      createdAt: { gte: startDate },
      ...(includeAdmin ? {} : {
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      }),
    },
    _count: true,
  });

  return {
    desktop: breakdown.find(d => d.deviceType === 'desktop')?._count || 0,
    mobile: breakdown.find(d => d.deviceType === 'mobile')?._count || 0,
    tablet: breakdown.find(d => d.deviceType === 'tablet')?._count || 0,
  };
}

export async function getBrowserBreakdown(range: DateRange = '7d', includeAdmin: boolean = false) {
  if (!isDatabaseEnabled) return [];

  const startDate = getDateRangeStart(range);

  const breakdown = await prisma.pageView.groupBy({
    by: ['browser'],
    where: {
      createdAt: { gte: startDate },
      browser: { not: null },
      ...(includeAdmin ? {} : {
        isAdmin: false,
        NOT: { path: { startsWith: '/admin' } },
      }),
    },
    _count: true,
    orderBy: { _count: { browser: 'desc' } },
  });

  return breakdown.map(b => ({
    browser: b.browser || 'Unknown',
    count: b._count,
  }));
}

export async function getDailyViewsChart(range: DateRange = '7d', includeAdmin: boolean = false) {
  if (!isDatabaseEnabled) return [];

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;

  const result: Array<{ date: string; views: number; visitors: number; adminViews?: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));

    const queries: Promise<unknown>[] = [
      // Public site views (exclude admin paths)
      prisma.pageView.count({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          isAdmin: false,
          NOT: { path: { startsWith: '/admin' } },
        },
      }),
      // Public site visitors (exclude admin paths)
      prisma.pageView.groupBy({
        by: ['sessionId'],
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          sessionId: { not: null },
          isAdmin: false,
          NOT: { path: { startsWith: '/admin' } },
        },
      }),
    ];

    // Optionally include admin views
    if (includeAdmin) {
      queries.push(
        prisma.pageView.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd }, isAdmin: true },
        })
      );
    }

    const results = await Promise.all(queries);
    const views = results[0] as number;
    const visitors = results[1] as { sessionId: string | null }[];
    const adminViews = includeAdmin ? (results[2] as number) : undefined;

    result.push({
      date: dayStart.toISOString().split('T')[0],
      views,
      visitors: visitors.length,
      ...(includeAdmin && adminViews !== undefined ? { adminViews } : {}),
    });
  }

  return result;
}

export async function getRecentActivity(limit: number = 20) {
  if (!isDatabaseEnabled) return [];

  const activities = await prisma.entityActivity.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

// ===========================================
// Quote Performance Analytics
// ===========================================

export async function getQuotePerformanceMetrics(range: DateRange = '30d') {
  if (!isDatabaseEnabled) {
    return {
      totalQuotes: 0,
      avgTimeToApproval: 0,
      avgQuoteValue: 0,
      approvalRate: 0,
      statusBreakdown: {} as Record<string, number>,
      avgTimeInStatus: {} as Record<string, number>,
    };
  }

  const startDate = getDateRangeStart(range);

  const [quotes, statusCounts] = await Promise.all([
    prisma.quote.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        sentAt: true,
        approvedAt: true,
      },
    }),
    prisma.quote.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate } },
      _count: true,
    }),
  ]);

  const statusBreakdown: Record<string, number> = {};
  statusCounts.forEach(s => {
    statusBreakdown[s.status] = s._count;
  });

  const approvedQuotes = quotes.filter(q => q.status === 'APPROVED' && q.approvedAt && q.createdAt);
  const avgTimeToApproval = approvedQuotes.length > 0
    ? approvedQuotes.reduce((sum, q) => {
        const diff = (q.approvedAt!.getTime() - q.createdAt.getTime()) / (1000 * 60 * 60); // hours
        return sum + diff;
      }, 0) / approvedQuotes.length
    : 0;

  const avgQuoteValue = quotes.length > 0
    ? quotes.reduce((sum, q) => sum + Number(q.total), 0) / quotes.length
    : 0;

  const approvalRate = quotes.length > 0
    ? (approvedQuotes.length / quotes.length) * 100
    : 0;

  return {
    totalQuotes: quotes.length,
    avgTimeToApproval: Math.round(avgTimeToApproval),
    avgQuoteValue: Math.round(avgQuoteValue * 100) / 100,
    approvalRate: Math.round(approvalRate * 100) / 100,
    statusBreakdown,
    avgTimeInStatus: {}, // Would require more complex event tracking
  };
}
