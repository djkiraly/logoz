import { prisma, isDatabaseEnabled } from './prisma';
import { sendEmail, getEmailConfig } from './gmail';
import { adminLogger } from './logger';
import crypto from 'crypto';

// Generate a secure verification token
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Check if email verification is enabled
export async function isEmailVerificationEnabled(): Promise<boolean> {
  if (!isDatabaseEnabled) return false;

  try {
    const setting = await prisma.notificationSetting.findUnique({
      where: { type: 'INTERNAL_USER_VERIFICATION' },
    });

    return setting?.enabled ?? false;
  } catch (error) {
    adminLogger.error('Failed to check email verification setting', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// Send verification email to a user
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  // Check if email verification is enabled
  const isEnabled = await isEmailVerificationEnabled();
  if (!isEnabled) {
    // If not enabled, mark user as verified immediately
    await prisma.adminUser.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    return { success: true };
  }

  // Check if email is configured
  const emailConfig = await getEmailConfig();
  if (!emailConfig?.isConfigured) {
    adminLogger.warn('Email verification enabled but email not configured', { userId });
    // Don't block user creation, just log the issue
    return { success: false, error: 'Email not configured' };
  }

  try {
    // Generate verification token
    const token = generateVerificationToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to user record
    await prisma.adminUser.update({
      where: { id: userId },
      data: {
        verificationToken: token,
        verificationTokenExpiry: expiry,
        emailVerified: false,
      },
    });

    // Build verification URL
    const verificationUrl = `${baseUrl}/api/admin/auth/verify-email?token=${token}`;

    // Get custom template if configured
    const setting = await prisma.notificationSetting.findUnique({
      where: { type: 'INTERNAL_USER_VERIFICATION' },
    });

    const subject = setting?.subject || 'Verify Your Email - Logoz Custom Admin';
    const bodyTemplate = setting?.bodyTemplate || getDefaultVerificationTemplate();

    // Process template
    const body = bodyTemplate
      .replace(/\{\{userName\}\}/g, name)
      .replace(/\{\{userEmail\}\}/g, email)
      .replace(/\{\{verificationUrl\}\}/g, verificationUrl)
      .replace(/\{\{expiryHours\}\}/g, '24');

    // Send the email
    const result = await sendEmail({
      to: email,
      subject: subject.replace(/\{\{userName\}\}/g, name),
      body,
      isHtml: true,
    });

    if (result.success) {
      // Log the notification
      await prisma.notificationLog.create({
        data: {
          type: 'INTERNAL_USER_VERIFICATION',
          channel: 'EMAIL',
          recipientEmail: email,
          recipientName: name,
          subject,
          status: 'sent',
          sentAt: new Date(),
          userId,
        },
      });

      adminLogger.info('Verification email sent', { userId, email });
    } else {
      await prisma.notificationLog.create({
        data: {
          type: 'INTERNAL_USER_VERIFICATION',
          channel: 'EMAIL',
          recipientEmail: email,
          recipientName: name,
          subject,
          status: 'failed',
          errorMessage: result.error,
          userId,
        },
      });

      adminLogger.error('Failed to send verification email', { userId, email, error: result.error });
    }

    return result;
  } catch (error) {
    adminLogger.error('Error sending verification email', {
      userId,
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Verify email with token
export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Find user with this token
    const user = await prisma.adminUser.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return { success: false, error: 'Invalid verification token' };
    }

    // Check if token is expired
    if (user.verificationTokenExpiry && new Date() > user.verificationTokenExpiry) {
      return { success: false, error: 'Verification token has expired' };
    }

    // Mark email as verified
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    adminLogger.info('Email verified successfully', { userId: user.id, email: user.email });

    return { success: true, userId: user.id };
  } catch (error) {
    adminLogger.error('Error verifying email token', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Resend verification email
export async function resendVerificationEmail(
  userId: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email already verified' };
    }

    return sendVerificationEmail(userId, user.email, user.name, baseUrl);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Default verification email template
function getDefaultVerificationTemplate(): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Logoz Custom</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e293b;">Verify Your Email Address</h2>
        <p>Hello {{userName}},</p>
        <p>Welcome to Logoz Custom Admin! Please verify your email address to activate your account.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="{{verificationUrl}}"
             style="display: inline-block; background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%);
                    color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;
                    font-weight: bold; font-size: 16px;">
            Verify Email Address
          </a>
        </div>

        <p style="color: #64748b; font-size: 14px;">
          This link will expire in {{expiryHours}} hours. If you didn't create an account, you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="{{verificationUrl}}" style="color: #0891b2; word-break: break-all;">{{verificationUrl}}</a>
        </p>
      </div>
    </div>
  `;
}
