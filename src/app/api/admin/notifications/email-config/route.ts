import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { testEmailConfig, getGmailAuthUrl, exchangeCodeForTokens } from '@/lib/gmail';

// GET /api/admin/notifications/email-config - Get email configuration
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    let config = await prisma.emailConfig.findUnique({
      where: { id: 1 },
    });

    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.emailConfig.create({
        data: {
          id: 1,
          provider: 'gmail',
          fromName: 'Logoz Custom',
        },
      });
    }

    // Return config with full Client ID and Secret (admin-only endpoint)
    // Only mask tokens that shouldn't be displayed
    const responseConfig = {
      ...config,
      gmailRefreshToken: config.gmailRefreshToken ? '••••••••' : null,
      gmailAccessToken: config.gmailAccessToken ? '••••••••' : null,
    };

    return NextResponse.json({ ok: true, data: responseConfig });
  } catch (error) {
    adminLogger.error('Failed to fetch email config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch email config' }, { status: 500 });
  }
}

// PUT /api/admin/notifications/email-config - Update email configuration
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const {
      gmailClientId,
      gmailClientSecret,
      fromName,
      fromEmail,
      replyToEmail,
    } = body;

    // Build update data (don't overwrite existing secrets if not provided)
    const updateData: Record<string, unknown> = {};

    if (gmailClientId !== undefined) {
      updateData.gmailClientId = gmailClientId || null;
    }
    if (gmailClientSecret !== undefined && gmailClientSecret !== '••••••••') {
      updateData.gmailClientSecret = gmailClientSecret || null;
    }
    if (fromName !== undefined) {
      updateData.fromName = fromName || 'Logoz Custom';
    }
    if (fromEmail !== undefined) {
      updateData.fromEmail = fromEmail || null;
    }
    if (replyToEmail !== undefined) {
      updateData.replyToEmail = replyToEmail || null;
    }

    const config = await prisma.emailConfig.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        provider: 'gmail',
        ...updateData,
      },
    });

    adminLogger.info('Email config updated', {
      userId: user.id,
    });

    // Return config with full credentials (admin-only endpoint)
    const responseConfig = {
      ...config,
      gmailRefreshToken: config.gmailRefreshToken ? '••••••••' : null,
      gmailAccessToken: config.gmailAccessToken ? '••••••••' : null,
    };

    return NextResponse.json({ ok: true, data: responseConfig });
  } catch (error) {
    adminLogger.error('Failed to update email config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update email config' }, { status: 500 });
  }
}

// POST /api/admin/notifications/email-config - Actions (test, authorize, exchange token)
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
    const { action, testEmail, code, redirectUri } = body;

    const config = await prisma.emailConfig.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      return NextResponse.json({ error: 'Email config not found' }, { status: 404 });
    }

    switch (action) {
      case 'getAuthUrl': {
        if (!config.gmailClientId) {
          return NextResponse.json({ error: 'Gmail Client ID not configured' }, { status: 400 });
        }
        const authUrl = getGmailAuthUrl(config.gmailClientId, redirectUri);
        return NextResponse.json({ ok: true, data: { authUrl } });
      }

      case 'exchangeToken': {
        if (!config.gmailClientId || !config.gmailClientSecret) {
          return NextResponse.json({ error: 'Gmail credentials not configured' }, { status: 400 });
        }

        const result = await exchangeCodeForTokens(
          code,
          config.gmailClientId,
          config.gmailClientSecret,
          redirectUri
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // Save tokens to database
        await prisma.emailConfig.update({
          where: { id: 1 },
          data: {
            gmailAccessToken: result.accessToken,
            gmailRefreshToken: result.refreshToken,
            gmailTokenExpiry: new Date(Date.now() + 3600 * 1000), // Assume 1 hour expiry
            isConfigured: true,
          },
        });

        adminLogger.info('Gmail OAuth tokens saved', { userId: user.id });

        return NextResponse.json({ ok: true, message: 'Gmail connected successfully' });
      }

      case 'test': {
        if (!testEmail) {
          return NextResponse.json({ error: 'Test email address required' }, { status: 400 });
        }

        const testResult = await testEmailConfig(testEmail);

        if (testResult.success) {
          adminLogger.info('Email test successful', { userId: user.id, testEmail });
          return NextResponse.json({ ok: true, message: 'Test email sent successfully' });
        } else {
          return NextResponse.json({ error: testResult.error }, { status: 400 });
        }
      }

      case 'disconnect': {
        await prisma.emailConfig.update({
          where: { id: 1 },
          data: {
            gmailRefreshToken: null,
            gmailAccessToken: null,
            gmailTokenExpiry: null,
            isConfigured: false,
          },
        });

        adminLogger.info('Gmail disconnected', { userId: user.id });

        return NextResponse.json({ ok: true, message: 'Gmail disconnected' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    adminLogger.error('Email config action failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}
