import { NextResponse } from 'next/server';
import { isDatabaseEnabled } from '@/lib/prisma';
import { trackProductView, markProductViewAddedToQuote } from '@/lib/analytics';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  if (!isDatabaseEnabled) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json();
    const { productId, sessionId, referrer, markAddedToQuote, productViewId } = body;

    // Mark as added to quote
    if (markAddedToQuote && productViewId) {
      await markProductViewAddedToQuote(productViewId);
      return NextResponse.json({ ok: true });
    }

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const clientIp = getClientIp(request);

    const productView = await trackProductView({
      productId,
      sessionId,
      ipAddress: clientIp,
      referrer,
    });

    return NextResponse.json({
      ok: true,
      productViewId: productView?.id,
    });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
