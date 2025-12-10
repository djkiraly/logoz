import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { exchangeCodeForTokens } from '@/lib/gmail';

// GET /api/admin/notifications/oauth-callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    if (!isDatabaseEnabled) {
      return NextResponse.redirect(new URL('/admin/notifications?error=database_not_configured', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      adminLogger.error('OAuth callback error', { error });
      return NextResponse.redirect(new URL(`/admin/notifications?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/admin/notifications?error=no_code', request.url));
    }

    const config = await prisma.emailConfig.findUnique({
      where: { id: 1 },
    });

    if (!config || !config.gmailClientId || !config.gmailClientSecret) {
      return NextResponse.redirect(new URL('/admin/notifications?error=not_configured', request.url));
    }

    // Build the redirect URI (same as the one used for authorization)
    const redirectUri = new URL('/api/admin/notifications/oauth-callback', request.url).toString();

    const result = await exchangeCodeForTokens(
      code,
      config.gmailClientId,
      config.gmailClientSecret,
      redirectUri
    );

    if (!result.success) {
      adminLogger.error('Failed to exchange OAuth code', { error: result.error });
      return NextResponse.redirect(new URL(`/admin/notifications?error=${encodeURIComponent(result.error || 'token_exchange_failed')}`, request.url));
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

    adminLogger.info('Gmail OAuth connected', { userId: user.id });

    return NextResponse.redirect(new URL('/admin/notifications?success=gmail_connected', request.url));
  } catch (error) {
    adminLogger.error('OAuth callback error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL('/admin/notifications?error=unknown_error', request.url));
  }
}
