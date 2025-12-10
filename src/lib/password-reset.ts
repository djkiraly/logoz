import { prisma, isDatabaseEnabled } from './prisma';
import { sendEmail, getEmailConfig } from './gmail';
import { adminLogger } from './logger';
import { hashPassword } from './auth';
import crypto from 'crypto';

// Generate a secure password reset token
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Request password reset - sends email with reset link
export async function requestPasswordReset(
  email: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Find user by email
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      adminLogger.info('Password reset requested for non-existent email', { email });
      return { success: true };
    }

    // Check if user is active
    if (!user.isActive) {
      adminLogger.info('Password reset requested for inactive user', { email });
      return { success: true };
    }

    // Check if email is configured
    const emailConfig = await getEmailConfig();
    if (!emailConfig?.isConfigured) {
      adminLogger.warn('Password reset requested but email not configured', { email });
      return { success: false, error: 'Email service not configured. Please contact an administrator.' };
    }

    // Generate reset token
    const token = generatePasswordResetToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to user record
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiry: expiry,
      },
    });

    // Build reset URL
    const resetUrl = `${baseUrl}/admin/reset-password?token=${token}`;

    // Send the email
    const result = await sendEmail({
      to: user.email,
      subject: 'Reset Your Password - Logoz Custom Admin',
      body: getPasswordResetTemplate(user.name, resetUrl),
      isHtml: true,
    });

    if (result.success) {
      // Log the notification
      await prisma.notificationLog.create({
        data: {
          type: 'INTERNAL_USER_VERIFICATION', // Reusing this type for password reset logs
          channel: 'EMAIL',
          recipientEmail: user.email,
          recipientName: user.name,
          subject: 'Reset Your Password - Logoz Custom Admin',
          status: 'sent',
          sentAt: new Date(),
          userId: user.id,
        },
      });

      adminLogger.info('Password reset email sent', { userId: user.id, email: user.email });
    } else {
      await prisma.notificationLog.create({
        data: {
          type: 'INTERNAL_USER_VERIFICATION',
          channel: 'EMAIL',
          recipientEmail: user.email,
          recipientName: user.name,
          subject: 'Reset Your Password - Logoz Custom Admin',
          status: 'failed',
          errorMessage: result.error,
          userId: user.id,
        },
      });

      adminLogger.error('Failed to send password reset email', { userId: user.id, email: user.email, error: result.error });
      return { success: false, error: 'Failed to send password reset email. Please try again.' };
    }

    return { success: true };
  } catch (error) {
    adminLogger.error('Error requesting password reset', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Verify password reset token
export async function verifyPasswordResetToken(
  token: string
): Promise<{ valid: boolean; userId?: string; email?: string; error?: string }> {
  if (!isDatabaseEnabled) {
    return { valid: false, error: 'Database not configured' };
  }

  try {
    // Find user with this token
    const user = await prisma.adminUser.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return { valid: false, error: 'Invalid or expired reset link' };
    }

    // Check if token is expired
    if (user.passwordResetTokenExpiry && new Date() > user.passwordResetTokenExpiry) {
      return { valid: false, error: 'Reset link has expired. Please request a new one.' };
    }

    // Check if user is active
    if (!user.isActive) {
      return { valid: false, error: 'This account has been deactivated' };
    }

    return { valid: true, userId: user.id, email: user.email };
  } catch (error) {
    adminLogger.error('Error verifying password reset token', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Reset password with token
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Verify the token first
    const verification = await verifyPasswordResetToken(token);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update the user's password and clear the reset token
    await prisma.adminUser.update({
      where: { passwordResetToken: token },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    // Invalidate all existing sessions for security
    await prisma.adminSession.deleteMany({
      where: { userId: verification.userId },
    });

    adminLogger.info('Password reset successfully', { userId: verification.userId });

    return { success: true };
  } catch (error) {
    adminLogger.error('Error resetting password', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Default password reset email template
function getPasswordResetTemplate(userName: string, resetUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Logoz Custom</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e293b;">Reset Your Password</h2>
        <p>Hello ${userName},</p>
        <p>We received a request to reset your password for your Logoz Custom Admin account. Click the button below to create a new password.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%);
                    color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;
                    font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
        </div>

        <p style="color: #64748b; font-size: 14px;">
          This link will expire in 1 hour for security reasons. If you didn't request a password reset, you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #0891b2; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
    </div>
  `;
}
