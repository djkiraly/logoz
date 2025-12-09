import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  deleteSession,
  clearSessionCookie,
  getCurrentUser,
  logAuditEvent,
} from '@/lib/auth';
import { handleApiError } from '@/lib/api-utils';
import { createRequestLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const reqLogger = createRequestLogger(request);
  reqLogger.info('Admin logout request');

  try {
    const user = await getCurrentUser();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await deleteSession(token);
    }

    await clearSessionCookie();

    if (user) {
      const clientIp = getClientIp(request);
      await logAuditEvent(user.id, 'LOGOUT', 'AdminUser', user.id, {}, clientIp);
      reqLogger.info('Logout successful', { userId: user.id });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
