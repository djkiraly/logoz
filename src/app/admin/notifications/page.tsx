'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  MessageSquare,
  Bell,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Link2,
  Unlink,
  ChevronDown,
  ChevronUp,
  Users,
  Building2,
  Plus,
  X,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';

type NotificationType =
  | 'INTERNAL_QUOTE_CREATED'
  | 'INTERNAL_QUOTE_STATUS_CHANGE'
  | 'INTERNAL_USER_VERIFICATION'
  | 'CUSTOMER_QUOTE_SENT'
  | 'CUSTOMER_QUOTE_STATUS_CHANGE';

type NotificationChannel = 'EMAIL' | 'SMS';

type NotificationSetting = {
  id: string;
  type: NotificationType;
  name: string;
  description: string | null;
  channel: NotificationChannel;
  enabled: boolean;
  subject: string | null;
  bodyTemplate: string | null;
  recipientEmails: string[];
};

type EmailConfig = {
  id: number;
  provider: string;
  gmailClientId: string | null;
  gmailClientSecret: string | null;
  gmailRefreshToken: string | null;
  fromName: string;
  fromEmail: string | null;
  replyToEmail: string | null;
  isConfigured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
};

type NotificationLog = {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientEmail: string | null;
  recipientName: string | null;
  subject: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

const NOTIFICATION_CATEGORIES = {
  internal: {
    label: 'Internal Notifications',
    description: 'Notifications sent to staff members',
    icon: Users,
    types: ['INTERNAL_QUOTE_CREATED', 'INTERNAL_QUOTE_STATUS_CHANGE', 'INTERNAL_USER_VERIFICATION'] as NotificationType[],
  },
  external: {
    label: 'Customer Notifications',
    description: 'Notifications sent to customers',
    icon: Building2,
    types: ['CUSTOMER_QUOTE_SENT', 'CUSTOMER_QUOTE_STATUS_CHANGE'] as NotificationType[],
  },
};

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Email config form state
  const [emailForm, setEmailForm] = useState({
    gmailClientId: '',
    gmailClientSecret: '',
    fromName: '',
    fromEmail: '',
    replyToEmail: '',
  });

  useEffect(() => {
    fetchData();

    // Check for success/error params from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'gmail_connected') {
      setMessage({ type: 'success', text: 'Gmail connected successfully!' });
      // Clean URL
      window.history.replaceState({}, '', '/admin/notifications');
    } else if (error) {
      setMessage({ type: 'error', text: `Connection failed: ${error}` });
      window.history.replaceState({}, '', '/admin/notifications');
    }
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/notifications');
      const data = await response.json();

      if (data.ok) {
        setSettings(data.data.settings || []);
        setEmailConfig(data.data.emailConfig);
        setLogs(data.data.recentLogs || []);

        if (data.data.emailConfig) {
          setEmailForm({
            gmailClientId: data.data.emailConfig.gmailClientId || '',
            gmailClientSecret: data.data.emailConfig.gmailClientSecret || '',
            fromName: data.data.emailConfig.fromName || '',
            fromEmail: data.data.emailConfig.fromEmail || '',
            replyToEmail: data.data.emailConfig.replyToEmail || '',
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMessage({ type: 'error', text: 'Failed to load notification settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotification = async (setting: NotificationSetting) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: setting.type,
          enabled: !setting.enabled,
        }),
      });

      if (response.ok) {
        setSettings((prev) =>
          prev.map((s) => (s.type === setting.type ? { ...s, enabled: !s.enabled } : s))
        );
        setMessage({
          type: 'success',
          text: `${setting.name} ${!setting.enabled ? 'enabled' : 'disabled'}`,
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update setting' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = async (setting: NotificationSetting, updates: Partial<NotificationSetting>) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: setting.type,
          ...updates,
        }),
      });

      if (response.ok) {
        setSettings((prev) =>
          prev.map((s) => (s.type === setting.type ? { ...s, ...updates } : s))
        );
        setMessage({ type: 'success', text: 'Setting updated' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update setting' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveEmailConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/notifications/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailForm),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailConfig(data.data);
        setMessage({ type: 'success', text: 'Email configuration saved' });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save email configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  const connectGmail = async () => {
    if (!emailForm.gmailClientId) {
      setMessage({ type: 'error', text: 'Please enter Gmail Client ID first' });
      return;
    }

    setIsConnecting(true);
    try {
      // First save the config
      await saveEmailConfig();

      // Get OAuth URL
      const redirectUri = `${window.location.origin}/api/admin/notifications/oauth-callback`;
      const response = await fetch('/api/admin/notifications/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getAuthUrl',
          redirectUri,
        }),
      });

      const data = await response.json();

      if (data.ok && data.data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to connect Gmail',
      });
      setIsConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail?')) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/notifications/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      if (response.ok) {
        setEmailConfig((prev) => prev ? { ...prev, isConfigured: false } : null);
        setMessage({ type: 'success', text: 'Gmail disconnected' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect Gmail' });
    } finally {
      setIsSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/admin/notifications/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          testEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test email sent successfully!' });
        fetchData(); // Refresh to get updated test status
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send test email',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const addRecipient = (setting: NotificationSetting, email: string) => {
    if (!email || setting.recipientEmails.includes(email)) return;
    updateSetting(setting, {
      recipientEmails: [...setting.recipientEmails, email],
    });
  };

  const removeRecipient = (setting: NotificationSetting, email: string) => {
    updateSetting(setting, {
      recipientEmails: setting.recipientEmails.filter((e) => e !== email),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'text-green-400 bg-green-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-yellow-400 bg-yellow-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <p className="text-slate-400 mt-1">
          Configure email and SMS notifications for internal users and customers.
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-current opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Email Configuration Section */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowEmailConfig(!showEmailConfig)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-white">Email Configuration</h2>
              <p className="text-sm text-slate-400">
                {emailConfig?.isConfigured ? (
                  <span className="text-green-400">Gmail connected</span>
                ) : (
                  'Configure Gmail API for sending emails'
                )}
              </p>
            </div>
          </div>
          {showEmailConfig ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showEmailConfig && (
          <div className="p-5 pt-0 space-y-6">
            <div className="border-t border-white/10 pt-5">
              {/* Gmail OAuth Status */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      emailConfig?.isConfigured ? 'bg-green-500' : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-white">
                    {emailConfig?.isConfigured ? 'Gmail Connected' : 'Gmail Not Connected'}
                  </span>
                  {emailConfig?.lastTestedAt && (
                    <span className="text-xs text-slate-500">
                      Last tested: {new Date(emailConfig.lastTestedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {emailConfig?.isConfigured ? (
                  <button
                    onClick={disconnectGmail}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Unlink className="w-4 h-4" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectGmail}
                    disabled={isConnecting || !emailForm.gmailClientId}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    Connect Gmail
                  </button>
                )}
              </div>

              {/* Gmail API Credentials */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white">Gmail API Credentials</h3>
                <p className="text-xs text-slate-500">
                  Create credentials at{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console <ExternalLink className="w-3 h-3" />
                  </a>
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Client ID</label>
                    <input
                      type="text"
                      value={emailForm.gmailClientId}
                      onChange={(e) => setEmailForm({ ...emailForm, gmailClientId: e.target.value })}
                      placeholder="xxx.apps.googleusercontent.com"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Client Secret</label>
                    <div className="relative">
                      <input
                        type={showClientSecret ? 'text' : 'password'}
                        value={emailForm.gmailClientSecret}
                        onChange={(e) => setEmailForm({ ...emailForm, gmailClientSecret: e.target.value })}
                        placeholder="Enter client secret"
                        className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        title={showClientSecret ? 'Hide secret' : 'Show secret'}
                      >
                        {showClientSecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sender Settings */}
              <div className="space-y-4 mt-6">
                <h3 className="text-sm font-semibold text-white">Sender Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">From Name</label>
                    <input
                      type="text"
                      value={emailForm.fromName}
                      onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })}
                      placeholder="Logoz Custom"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">From Email</label>
                    <input
                      type="email"
                      value={emailForm.fromEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                      placeholder="noreply@logoz.com"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Reply-To Email</label>
                    <input
                      type="email"
                      value={emailForm.replyToEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, replyToEmail: e.target.value })}
                      placeholder="support@logoz.com"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Save and Test */}
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={saveEmailConfig}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                  Save Configuration
                </button>

                {emailConfig?.isConfigured && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Enter email for test"
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                    />
                    <button
                      onClick={sendTestEmail}
                      disabled={isTesting || !testEmail}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                    >
                      {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Test
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SMS Configuration (Future) */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-4 opacity-50">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">SMS Configuration</h2>
            <p className="text-sm text-slate-400">Coming soon - Twilio integration for SMS notifications</p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      {Object.entries(NOTIFICATION_CATEGORIES).map(([key, category]) => (
        <div key={key} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${key === 'internal' ? 'bg-blue-500/20' : 'bg-purple-500/20'} flex items-center justify-center`}>
                <category.icon className={`w-5 h-5 ${key === 'internal' ? 'text-blue-400' : 'text-purple-400'}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{category.label}</h2>
                <p className="text-sm text-slate-400">{category.description}</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {settings
              .filter((s) => category.types.includes(s.type))
              .map((setting) => (
                <div key={setting.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        onClick={() => toggleNotification(setting)}
                        disabled={isSaving || !emailConfig?.isConfigured}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          setting.enabled && emailConfig?.isConfigured
                            ? 'bg-cyan-500'
                            : 'bg-slate-600'
                        } ${!emailConfig?.isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            setting.enabled && emailConfig?.isConfigured
                              ? 'translate-x-7'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div>
                        <h3 className="text-white font-medium">{setting.name}</h3>
                        <p className="text-sm text-slate-500">{setting.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedSetting(expandedSetting === setting.id ? null : setting.id)}
                      className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                      {expandedSetting === setting.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {expandedSetting === setting.id && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                      {/* Recipients (for internal notifications) */}
                      {setting.type.startsWith('INTERNAL_') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Recipient Emails
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {setting.recipientEmails.map((email) => (
                              <span
                                key={email}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-lg text-sm text-white"
                              >
                                {email}
                                <button
                                  onClick={() => removeRecipient(setting, email)}
                                  className="text-slate-400 hover:text-red-400"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              placeholder="Add recipient email"
                              className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  addRecipient(setting, input.value);
                                  input.value = '';
                                }
                              }}
                            />
                            <button
                              onClick={(e) => {
                                const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                                if (input.value) {
                                  addRecipient(setting, input.value);
                                  input.value = '';
                                }
                              }}
                              className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Subject */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Email Subject
                        </label>
                        <input
                          type="text"
                          value={setting.subject || ''}
                          onChange={(e) => updateSetting(setting, { subject: e.target.value })}
                          placeholder="Use {{quoteNumber}}, {{customerName}}, etc."
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                      </div>

                      {/* Body Template */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Email Body (HTML)
                        </label>
                        <textarea
                          value={setting.bodyTemplate || ''}
                          onChange={(e) => updateSetting(setting, { bodyTemplate: e.target.value })}
                          rows={6}
                          placeholder="HTML template with placeholders..."
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 font-mono"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Available placeholders: {'{{quoteNumber}}'}, {'{{customerName}}'}, {'{{customerEmail}}'}, {'{{quoteTotal}}'}, {'{{quoteStatus}}'}, {'{{previousStatus}}'}, {'{{newStatus}}'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* Notification Logs */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <p className="text-sm text-slate-400">{logs.length} notifications in log</p>
            </div>
          </div>
          {showLogs ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showLogs && logs.length > 0 && (
          <div className="border-t border-white/10">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Type</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Recipient</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Subject</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5">
                    <td className="p-4">
                      <span className="text-xs text-slate-400">{log.type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-white text-sm">{log.recipientEmail || '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-300 text-sm">{log.subject || '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-500 text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showLogs && logs.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No notification logs yet
          </div>
        )}
      </div>
    </div>
  );
}
