import { NextResponse } from 'next/server';
import { isDatabaseEnabled } from '@/lib/prisma';
import { trackPageView, getOrCreateSession, updateSessionDuration, updatePageViewDuration } from '@/lib/analytics';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  if (!isDatabaseEnabled) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json();
    const {
      path,
      referrer,
      sessionId,
      // Optional engagement metrics
      duration,
      scrollDepth,
      pageViewId,
      // UTM parameters
      utmSource,
      utmMedium,
      utmCampaign,
    } = body;

    // If this is an update to an existing page view (heartbeat)
    if (pageViewId && duration !== undefined) {
      await updatePageViewDuration(pageViewId, duration, scrollDepth);
      if (sessionId && duration) {
        await updateSessionDuration(sessionId, duration);
      }
      return NextResponse.json({ ok: true });
    }

    if (!path) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Determine if this is an admin page view
    const isAdmin = path.startsWith('/admin');

    // Create or update session (only for non-admin views)
    if (sessionId && !isAdmin) {
      await getOrCreateSession(sessionId, {
        path,
        referrer,
        ipAddress: clientIp,
        userAgent,
        utmSource,
        utmMedium,
        utmCampaign,
      });
    }

    // Track page view
    const pageView = await trackPageView({
      path,
      sessionId: isAdmin ? undefined : sessionId, // Don't link admin views to customer sessions
      referrer,
      userAgent,
      ipAddress: clientIp,
      isAdmin,
    });

    return NextResponse.json({
      ok: true,
      pageViewId: pageView?.id,
    });
  } catch {
    // Silently fail - analytics shouldn't break the site
    return NextResponse.json({ ok: true });
  }
}
