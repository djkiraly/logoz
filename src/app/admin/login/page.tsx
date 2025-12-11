'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Lock, Mail, AlertCircle, Loader2, CheckCircle, Send } from 'lucide-react';

// Extend window to include reCAPTCHA
declare global {
  interface Window {
    grecaptcha?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact';
      }) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
    onRecaptchaLoad?: () => void;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  // reCAPTCHA state
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const recaptchaWidgetId = useRef<number | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Fetch reCAPTCHA config
  useEffect(() => {
    async function fetchRecaptchaConfig() {
      try {
        const response = await fetch('/api/recaptcha/config');
        const data = await response.json();
        setRecaptchaEnabled(data.enabled);
        setRecaptchaSiteKey(data.siteKey);
      } catch (error) {
        console.error('Failed to fetch reCAPTCHA config:', error);
      }
    }
    fetchRecaptchaConfig();
  }, []);

  // Initialize reCAPTCHA widget
  const initRecaptcha = useCallback(() => {
    if (
      window.grecaptcha &&
      recaptchaSiteKey &&
      recaptchaContainerRef.current &&
      recaptchaWidgetId.current === null
    ) {
      try {
        recaptchaWidgetId.current = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: recaptchaSiteKey,
          callback: (token: string) => setRecaptchaToken(token),
          'expired-callback': () => setRecaptchaToken(null),
          'error-callback': () => setRecaptchaToken(null),
          theme: 'dark',
        });
        setRecaptchaLoaded(true);
      } catch (error) {
        console.error('Failed to render reCAPTCHA:', error);
      }
    }
  }, [recaptchaSiteKey]);

  // Set up global callback for reCAPTCHA script load
  useEffect(() => {
    if (recaptchaEnabled && recaptchaSiteKey) {
      window.onRecaptchaLoad = initRecaptcha;
      // If script already loaded, init immediately
      if (window.grecaptcha) {
        initRecaptcha();
      }
    }
    return () => {
      window.onRecaptchaLoad = undefined;
    };
  }, [recaptchaEnabled, recaptchaSiteKey, initRecaptcha]);

  // Check for success messages from URL params
  useEffect(() => {
    const reset = searchParams.get('reset');
    const verified = searchParams.get('verified');

    if (reset === 'success') {
      setSuccessMessage('Your password has been reset successfully. Please sign in with your new password.');
    } else if (verified === 'true') {
      setSuccessMessage('Your email has been verified. You can now sign in.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setShowVerificationPrompt(false);

    // Validate reCAPTCHA if enabled
    if (recaptchaEnabled && !recaptchaToken) {
      setError('Please complete the reCAPTCHA verification');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          recaptchaToken: recaptchaEnabled ? recaptchaToken : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Reset reCAPTCHA on error
        if (recaptchaEnabled && window.grecaptcha && recaptchaWidgetId.current !== null) {
          window.grecaptcha.reset(recaptchaWidgetId.current);
          setRecaptchaToken(null);
        }

        // Check if email verification is required
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setShowVerificationPrompt(true);
          setUnverifiedEmail(data.email || email);
          setError('');
        } else {
          setError(data.error || 'Login failed');
        }
        return;
      }

      // Redirect to admin dashboard
      router.push('/admin');
      router.refresh();
    } catch {
      // Reset reCAPTCHA on error
      if (recaptchaEnabled && window.grecaptcha && recaptchaWidgetId.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetId.current);
        setRecaptchaToken(null);
      }
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/admin/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });

      const data = await response.json();

      if (data.ok) {
        if (data.alreadyVerified) {
          setShowVerificationPrompt(false);
          setSuccessMessage('Your email is already verified. Please try logging in again.');
        } else {
          setSuccessMessage(data.message || 'Verification email sent! Please check your inbox.');
        }
      } else {
        setError(data.error || 'Failed to send verification email');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      {/* Load reCAPTCHA script */}
      {recaptchaEnabled && recaptchaSiteKey && (
        <Script
          src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit"
          strategy="lazyOnload"
        />
      )}

      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Login</h1>
          <p className="text-slate-400 mt-2">Sign in to access the admin panel</p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
        >
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3 text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Email Verification Required */}
          {showVerificationPrompt && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-400 font-medium text-sm mb-1">Email Verification Required</p>
                  <p className="text-amber-400/80 text-sm mb-3">
                    Please verify your email address before logging in. Check your inbox for a verification link.
                  </p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Resend Verification Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-300"
                >
                  Password
                </label>
                <Link
                  href="/admin/forgot-password"
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* reCAPTCHA Widget */}
          {recaptchaEnabled && recaptchaSiteKey && (
            <div className="mt-5 flex justify-center">
              <div ref={recaptchaContainerRef} />
              {!recaptchaLoaded && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading reCAPTCHA...
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (recaptchaEnabled && !recaptchaToken)}
            className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Return to{' '}
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">
            main site
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
