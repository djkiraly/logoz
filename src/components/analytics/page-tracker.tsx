'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageViewId = useRef<string | null>(null);
  const startTime = useRef<number>(Date.now());
  const maxScrollDepth = useRef<number>(0);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Track scroll depth
  const updateScrollDepth = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);
      maxScrollDepth.current = Math.max(maxScrollDepth.current, scrollPercent);
    }
  }, []);

  // Send heartbeat to update duration
  const sendHeartbeat = useCallback(async () => {
    if (!pageViewId.current) return;

    const sessionId = getCookie('logoz_session');
    const duration = Math.round((Date.now() - startTime.current) / 1000);

    try {
      await fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageViewId: pageViewId.current,
          sessionId,
          duration,
          scrollDepth: maxScrollDepth.current,
        }),
      });
    } catch {
      // Silent fail
    }
  }, []);

  // Track page view
  const trackPageView = useCallback(async () => {
    const sessionId = getCookie('logoz_session');

    // Get UTM parameters
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    try {
      const response = await fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname,
          referrer: document.referrer || undefined,
          sessionId,
          utmSource: utmSource || undefined,
          utmMedium: utmMedium || undefined,
          utmCampaign: utmCampaign || undefined,
        }),
      });

      const data = await response.json();
      if (data.pageViewId) {
        pageViewId.current = data.pageViewId;
      }
    } catch {
      // Silent fail
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    // Skip tracking for API routes only (admin routes are now tracked separately)
    if (pathname.startsWith('/api')) {
      return;
    }

    // Reset tracking state
    pageViewId.current = null;
    startTime.current = Date.now();
    maxScrollDepth.current = 0;

    // Track the page view
    trackPageView();

    // Set up scroll tracking
    window.addEventListener('scroll', updateScrollDepth, { passive: true });

    // Set up heartbeat (every 30 seconds)
    heartbeatInterval.current = setInterval(sendHeartbeat, 30000);

    // Send final heartbeat on page unload
    const handleUnload = () => {
      sendHeartbeat();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      // Cleanup
      window.removeEventListener('scroll', updateScrollDepth);
      window.removeEventListener('beforeunload', handleUnload);
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      // Send final heartbeat
      sendHeartbeat();
    };
  }, [pathname, trackPageView, updateScrollDepth, sendHeartbeat]);

  return null;
}

// Product view tracker hook
export function useProductTracker() {
  const trackProductView = useCallback(async (productId: string) => {
    const sessionId = getCookie('logoz_session');

    try {
      const response = await fetch('/api/analytics/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          sessionId,
          referrer: document.referrer || undefined,
        }),
      });

      const data = await response.json();
      return data.productViewId;
    } catch {
      return null;
    }
  }, []);

  const markAddedToQuote = useCallback(async (productViewId: string) => {
    try {
      await fetch('/api/analytics/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productViewId,
          markAddedToQuote: true,
        }),
      });
    } catch {
      // Silent fail
    }
  }, []);

  return { trackProductView, markAddedToQuote };
}

// Quote funnel tracker hook
export function useQuoteFunnelTracker() {
  const trackFunnelEvent = useCallback(
    async (
      stage:
        | 'VIEWED_PRODUCTS'
        | 'STARTED_QUOTE'
        | 'ADDED_ITEMS'
        | 'SUBMITTED_INFO'
        | 'QUOTE_SENT'
        | 'QUOTE_APPROVED'
        | 'QUOTE_REJECTED',
      options?: {
        quoteId?: string;
        customerId?: string;
        productIds?: string[];
        metadata?: Record<string, unknown>;
      }
    ) => {
      const sessionId = getCookie('logoz_session');

      try {
        await fetch('/api/analytics/funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage,
            sessionId,
            ...options,
          }),
        });
      } catch {
        // Silent fail
      }
    },
    []
  );

  return { trackFunnelEvent };
}
