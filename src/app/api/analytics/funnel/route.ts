import { NextResponse } from 'next/server';
import { isDatabaseEnabled } from '@/lib/prisma';
import { trackQuoteFunnelEvent, markSessionConverted } from '@/lib/analytics';
import type { QuoteFunnelStage } from '@prisma/client';

const VALID_STAGES: QuoteFunnelStage[] = [
  'VIEWED_PRODUCTS',
  'STARTED_QUOTE',
  'ADDED_ITEMS',
  'SUBMITTED_INFO',
  'QUOTE_SENT',
  'QUOTE_APPROVED',
  'QUOTE_REJECTED',
];

export async function POST(request: Request) {
  if (!isDatabaseEnabled) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json();
    const { stage, sessionId, quoteId, customerId, productIds, metadata } = body;

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }

    await trackQuoteFunnelEvent({
      stage: stage as QuoteFunnelStage,
      sessionId,
      quoteId,
      customerId,
      productIds,
      metadata,
    });

    // Mark session as converted if quote submitted
    if (stage === 'SUBMITTED_INFO' && sessionId && quoteId) {
      await markSessionConverted(sessionId, quoteId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
