import { cookies } from 'next/headers';
import { prisma, isDatabaseEnabled } from './prisma';
import { adminLogger } from './logger';

const SESSION_COOKIE_NAME = 'logoz_admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash a password using Web Crypto API (no external dependencies)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a new admin session
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  if (!isDatabaseEnabled) {
    throw new Error('Database not configured');
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = await prisma.adminSession.create({
    data: {
      token,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Update last login
  await prisma.adminUser.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  adminLogger.info('Session created', { userId, sessionId: session.id });

  return { token, expiresAt };
}

/**
 * Validate a session token and return the user
 */
export async function validateSession(token: string) {
  if (!isDatabaseEnabled || !token) {
    return null;
  }

  try {
    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await prisma.adminSession.delete({ where: { id: session.id } });
      return null;
    }

    // Check if user is active
    if (!session.user.isActive) {
      return null;
    }

    return session.user;
  } catch (error) {
    adminLogger.error('Session validation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get the current admin user from cookies
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return validateSession(token);
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string) {
  if (!isDatabaseEnabled) {
    return;
  }

  try {
    await prisma.adminSession.delete({ where: { token } });
  } catch {
    // Session might already be deleted
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  if (!isDatabaseEnabled) {
    return 0;
  }

  const result = await prisma.adminSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  if (result.count > 0) {
    adminLogger.info('Cleaned up expired sessions', { count: result.count });
  }

  return result.count;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string
) {
  if (!isDatabaseEnabled) {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    adminLogger.error('Failed to log audit event', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export { SESSION_COOKIE_NAME };
