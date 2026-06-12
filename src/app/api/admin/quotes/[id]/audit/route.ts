import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getQuoteAuditLogs } from '@/lib/quote-audit';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/quotes/[id]/audit - Get audit logs for a quote
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Confirm the quote exists before exposing its audit trail (and so a
    // missing/invalid id returns 404 rather than an empty success).
    if (isDatabaseEnabled) {
      const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true } });
      if (!quote) {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
      }
    }

    const logs = await getQuoteAuditLogs(id);

    return NextResponse.json({ ok: true, data: logs });
  } catch (error) {
    adminLogger.error('Failed to fetch quote audit logs', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
