import { NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  if (!isDatabaseEnabled) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json();
    const { path, referrer, sessionId } = body;

    if (!path) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    await prisma.pageView.create({
      data: {
        path,
        referrer: referrer || undefined,
        userAgent,
        ipAddress: clientIp,
        sessionId: sessionId || undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Silently fail - analytics shouldn't break the site
    return NextResponse.json({ ok: true });
  }
}
