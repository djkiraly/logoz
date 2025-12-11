import { prisma, isDatabaseEnabled } from './prisma';
import { adminLogger } from './logger';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

type RecaptchaVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
};

/**
 * Check if reCAPTCHA is enabled and properly configured
 */
export async function isRecaptchaEnabled(): Promise<boolean> {
  if (!isDatabaseEnabled) return false;

  try {
    const settings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
      select: {
        recaptchaEnabled: true,
        recaptchaSiteKey: true,
        recaptchaSecretKey: true,
      },
    });

    return !!(
      settings?.recaptchaEnabled &&
      settings?.recaptchaSiteKey &&
      settings?.recaptchaSecretKey
    );
  } catch (error) {
    adminLogger.error('Failed to check reCAPTCHA status', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get reCAPTCHA configuration (public site key only)
 */
export async function getRecaptchaConfig(): Promise<{
  enabled: boolean;
  siteKey: string | null;
}> {
  if (!isDatabaseEnabled) {
    return { enabled: false, siteKey: null };
  }

  try {
    const settings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
      select: {
        recaptchaEnabled: true,
        recaptchaSiteKey: true,
        recaptchaSecretKey: true,
      },
    });

    const enabled = !!(
      settings?.recaptchaEnabled &&
      settings?.recaptchaSiteKey &&
      settings?.recaptchaSecretKey
    );

    return {
      enabled,
      siteKey: enabled ? settings?.recaptchaSiteKey ?? null : null,
    };
  } catch (error) {
    adminLogger.error('Failed to get reCAPTCHA config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { enabled: false, siteKey: null };
  }
}

/**
 * Verify a reCAPTCHA token
 */
export async function verifyRecaptcha(
  token: string,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Get secret key from settings
    const settings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
      select: {
        recaptchaEnabled: true,
        recaptchaSecretKey: true,
      },
    });

    if (!settings?.recaptchaEnabled || !settings?.recaptchaSecretKey) {
      // If reCAPTCHA is not enabled, consider verification successful
      return { success: true };
    }

    if (!token) {
      return { success: false, error: 'reCAPTCHA token is required' };
    }

    // Build verification request
    const params = new URLSearchParams({
      secret: settings.recaptchaSecretKey,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    // Call Google's verification API
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      adminLogger.error('reCAPTCHA verification request failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return { success: false, error: 'reCAPTCHA verification request failed' };
    }

    const data: RecaptchaVerifyResponse = await response.json();

    if (data.success) {
      adminLogger.info('reCAPTCHA verification successful', {
        hostname: data.hostname,
        challenge_ts: data.challenge_ts,
      });
      return { success: true };
    } else {
      const errorCodes = data['error-codes'] || [];
      adminLogger.warn('reCAPTCHA verification failed', {
        errorCodes,
      });

      // Map error codes to user-friendly messages
      let errorMessage = 'reCAPTCHA verification failed';
      if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'reCAPTCHA expired. Please try again.';
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'Invalid reCAPTCHA. Please try again.';
      }

      return { success: false, error: errorMessage };
    }
  } catch (error) {
    adminLogger.error('reCAPTCHA verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'reCAPTCHA verification error' };
  }
}
