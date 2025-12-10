import { prisma, isDatabaseEnabled } from './prisma';
import { adminLogger } from './logger';

// Gmail OAuth2 configuration
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

type EmailConfig = {
  gmailClientId: string | null;
  gmailClientSecret: string | null;
  gmailRefreshToken: string | null;
  gmailAccessToken: string | null;
  gmailTokenExpiry: Date | null;
  fromName: string;
  fromEmail: string | null;
  replyToEmail: string | null;
  isConfigured: boolean;
};

type SendEmailParams = {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  replyTo?: string;
};

// Get Gmail configuration from database
export async function getEmailConfig(): Promise<EmailConfig | null> {
  if (!isDatabaseEnabled) return null;

  try {
    const config = await prisma.emailConfig.findUnique({
      where: { id: 1 },
    });

    return config;
  } catch (error) {
    adminLogger.error('Failed to get email config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Refresh the access token using the refresh token
async function refreshAccessToken(config: EmailConfig): Promise<string | null> {
  if (!config.gmailClientId || !config.gmailClientSecret || !config.gmailRefreshToken) {
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.gmailClientId,
        client_secret: config.gmailClientSecret,
        refresh_token: config.gmailRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      adminLogger.error('Failed to refresh Gmail token', { error: errorData });
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Update the access token in database
    await prisma.emailConfig.update({
      where: { id: 1 },
      data: {
        gmailAccessToken: data.access_token,
        gmailTokenExpiry: expiresAt,
      },
    });

    return data.access_token;
  } catch (error) {
    adminLogger.error('Error refreshing Gmail token', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Get a valid access token (refresh if needed)
async function getValidAccessToken(config: EmailConfig): Promise<string | null> {
  // Check if current token is still valid (with 5 minute buffer)
  if (
    config.gmailAccessToken &&
    config.gmailTokenExpiry &&
    new Date(config.gmailTokenExpiry).getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return config.gmailAccessToken;
  }

  // Token expired or missing, refresh it
  return refreshAccessToken(config);
}

// Create RFC 2822 formatted email
function createRawEmail(params: SendEmailParams, config: EmailConfig): string {
  const { to, subject, body, isHtml = true, replyTo } = params;

  const fromHeader = config.fromName && config.fromEmail
    ? `${config.fromName} <${config.fromEmail}>`
    : config.fromEmail || '';

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (replyTo || config.replyToEmail) {
    headers.push(`Reply-To: ${replyTo || config.replyToEmail}`);
  }

  if (isHtml) {
    headers.push('Content-Type: text/html; charset=utf-8');
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8');
  }

  const email = headers.join('\r\n') + '\r\n\r\n' + body;

  // Convert to base64url encoding
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send email using Gmail API
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  const config = await getEmailConfig();

  if (!config || !config.isConfigured) {
    return { success: false, error: 'Email not configured' };
  }

  const accessToken = await getValidAccessToken(config);

  if (!accessToken) {
    return { success: false, error: 'Failed to get access token' };
  }

  try {
    const rawMessage = createRawEmail(params, config);

    const response = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: rawMessage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      adminLogger.error('Failed to send email via Gmail', { error: errorData });
      return { success: false, error: errorData.error?.message || 'Failed to send email' };
    }

    const data = await response.json();

    adminLogger.info('Email sent successfully', {
      to: params.to,
      subject: params.subject,
      messageId: data.id,
    });

    return { success: true, messageId: data.id };
  } catch (error) {
    adminLogger.error('Error sending email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Test email configuration
export async function testEmailConfig(testEmail: string): Promise<{ success: boolean; error?: string }> {
  // Get config to display in test email
  const config = await getEmailConfig();

  if (!config) {
    return { success: false, error: 'Email configuration not found' };
  }

  const fromDisplay = config.fromName && config.fromEmail
    ? `${config.fromName} <${config.fromEmail}>`
    : config.fromEmail || 'Not configured';

  const result = await sendEmail({
    to: testEmail,
    subject: 'Logoz Custom - Email Test',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">Email Configuration Test</h2>
        <p>This is a test email from Logoz Custom to verify your email configuration is working correctly.</p>

        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #334155; font-size: 14px;">Configured Sender Settings:</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">From:</td>
              <td style="padding: 4px 0; color: #1e293b;">${fromDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Reply-To:</td>
              <td style="padding: 4px 0; color: #1e293b;">${config.replyToEmail || 'Not configured'}</td>
            </tr>
          </table>
        </div>

        <p style="color: #64748b; font-size: 14px;">Sent at: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
        <p style="color: #94a3b8; font-size: 12px;">Check the email headers to verify the From and Reply-To addresses match your configuration.</p>
      </div>
    `,
    isHtml: true,
  });

  if (result.success) {
    // Update test status in database
    await prisma.emailConfig.update({
      where: { id: 1 },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: 'success',
      },
    });
  } else {
    await prisma.emailConfig.update({
      where: { id: 1 },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: `failed: ${result.error}`,
      },
    });
  }

  return result;
}

// Generate OAuth2 authorization URL
export function getGmailAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; error?: string }> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error_description || 'Token exchange failed' };
    }

    const data = await response.json();

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
