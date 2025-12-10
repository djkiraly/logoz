import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { initializeNotificationSettings } from '@/lib/notifications';

// GET /api/admin/notifications - Get all notification settings
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Initialize default settings if needed
    await initializeNotificationSettings();

    const [settings, emailConfig, smsConfig, recentLogs] = await Promise.all([
      prisma.notificationSetting.findMany({
        orderBy: { type: 'asc' },
      }),
      prisma.emailConfig.findUnique({
        where: { id: 1 },
        select: {
          id: true,
          provider: true,
          gmailClientId: true,
          gmailClientSecret: true,
          gmailRefreshToken: true,
          fromName: true,
          fromEmail: true,
          replyToEmail: true,
          isConfigured: true,
          lastTestedAt: true,
          lastTestStatus: true,
        },
      }),
      prisma.smsConfig.findUnique({
        where: { id: 1 },
        select: {
          id: true,
          provider: true,
          fromNumber: true,
          isConfigured: true,
          lastTestedAt: true,
          lastTestStatus: true,
        },
      }),
      prisma.notificationLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Only mask tokens, not credentials (admin-only endpoint)
    const processedEmailConfig = emailConfig ? {
      ...emailConfig,
      gmailRefreshToken: emailConfig.gmailRefreshToken ? '••••••••' : null,
    } : null;

    return NextResponse.json({
      ok: true,
      data: {
        settings,
        emailConfig: processedEmailConfig,
        smsConfig,
        recentLogs,
      },
    });
  } catch (error) {
    adminLogger.error('Failed to fetch notification settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch notification settings' }, { status: 500 });
  }
}

// POST /api/admin/notifications - Update notification setting
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { type, enabled, subject, bodyTemplate, recipientEmails } = body;

    if (!type) {
      return NextResponse.json({ error: 'Notification type is required' }, { status: 400 });
    }

    const setting = await prisma.notificationSetting.update({
      where: { type },
      data: {
        enabled: enabled !== undefined ? enabled : undefined,
        subject: subject !== undefined ? subject : undefined,
        bodyTemplate: bodyTemplate !== undefined ? bodyTemplate : undefined,
        recipientEmails: recipientEmails !== undefined ? recipientEmails : undefined,
      },
    });

    adminLogger.info('Notification setting updated', {
      userId: user.id,
      type,
      enabled: setting.enabled,
    });

    return NextResponse.json({ ok: true, data: setting });
  } catch (error) {
    adminLogger.error('Failed to update notification setting', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update notification setting' }, { status: 500 });
  }
}
