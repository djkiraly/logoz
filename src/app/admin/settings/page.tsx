'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Cloud, Eye, EyeOff, TestTube, Upload, Shield } from 'lucide-react';

type SiteSettings = {
  siteName: string;
  heroHeading: string;
  heroCopy: string;
  ctaLabel: string;
  ctaLink: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  announcement: string;
};

type GcsConfig = {
  projectId: string;
  bucketName: string;
  clientEmail: string;
  privateKey: string;
  enabled: boolean;
};

type RecaptchaConfig = {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
};

const emptyGcsConfig: GcsConfig = {
  projectId: '',
  bucketName: '',
  clientEmail: '',
  privateKey: '',
  enabled: false,
};

const emptyRecaptchaConfig: RecaptchaConfig = {
  enabled: false,
  siteKey: '',
  secretKey: '',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: '',
    heroHeading: '',
    heroCopy: '',
    ctaLabel: '',
    ctaLink: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    announcement: '',
  });
  const [gcsConfig, setGcsConfig] = useState<GcsConfig>(emptyGcsConfig);
  const [recaptchaConfig, setRecaptchaConfig] = useState<RecaptchaConfig>(emptyRecaptchaConfig);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showRecaptchaSecretKey, setShowRecaptchaSecretKey] = useState(false);
  const [isTestingGcs, setIsTestingGcs] = useState(false);
  const [gcsTestResult, setGcsTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      if (data.data) {
        setSettings({
          siteName: data.data.siteName || '',
          heroHeading: data.data.heroHeading || '',
          heroCopy: data.data.heroCopy || '',
          ctaLabel: data.data.ctaLabel || '',
          ctaLink: data.data.ctaLink || '',
          contactEmail: data.data.contactEmail || '',
          contactPhone: data.data.contactPhone || '',
          address: data.data.address || '',
          announcement: data.data.announcement || '',
        });
        if (data.data.gcsConfig) {
          setGcsConfig({
            projectId: data.data.gcsConfig.projectId || '',
            bucketName: data.data.gcsConfig.bucketName || '',
            clientEmail: data.data.gcsConfig.clientEmail || '',
            privateKey: data.data.gcsConfig.privateKey || '',
            enabled: data.data.gcsConfig.enabled || false,
          });
        }
        // Load reCAPTCHA config
        setRecaptchaConfig({
          enabled: data.data.recaptchaEnabled || false,
          siteKey: data.data.recaptchaSiteKey || '',
          secretKey: data.data.recaptchaSecretKey || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          gcsConfig: gcsConfig.projectId ? gcsConfig : null,
          recaptchaEnabled: recaptchaConfig.enabled,
          recaptchaSiteKey: recaptchaConfig.siteKey || null,
          recaptchaSecretKey: recaptchaConfig.secretKey || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      setMessage({ type: 'error', text: `${errorMessage}. Please try again.` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestGcsConnection = async () => {
    if (!gcsConfig.projectId || !gcsConfig.bucketName || !gcsConfig.clientEmail || !gcsConfig.privateKey) {
      setGcsTestResult({ success: false, message: 'Please fill in all GCS configuration fields' });
      return;
    }

    setIsTestingGcs(true);
    setGcsTestResult(null);

    try {
      const response = await fetch('/api/admin/gcs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: gcsConfig.projectId,
          bucketName: gcsConfig.bucketName,
          clientEmail: gcsConfig.clientEmail,
          privateKey: gcsConfig.privateKey,
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setGcsTestResult({ success: true, message: data.message || 'Connection successful!' });
      } else {
        setGcsTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch {
      setGcsTestResult({ success: false, message: 'Failed to test connection. Please try again.' });
    } finally {
      setIsTestingGcs(false);
    }
  };

  const handleGcsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGcsConfig((prev) => ({ ...prev, [name]: value }));
    setGcsTestResult(null);
  };

  const handleGcsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGcsConfig((prev) => ({ ...prev, enabled: e.target.checked }));
  };

  const handleRecaptchaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRecaptchaConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleRecaptchaToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecaptchaConfig((prev) => ({ ...prev, enabled: e.target.checked }));
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        if (json.type !== 'service_account') {
          setGcsTestResult({ success: false, message: 'Invalid file: Not a service account JSON file' });
          return;
        }

        setGcsConfig((prev) => ({
          ...prev,
          projectId: json.project_id || '',
          clientEmail: json.client_email || '',
          privateKey: json.private_key || '',
        }));

        setGcsTestResult({ success: true, message: 'Service account loaded! Enter bucket name and test connection.' });
      } catch {
        setGcsTestResult({ success: false, message: 'Invalid JSON file' });
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Site Settings</h1>
          <p className="text-slate-400 mt-1">
            Manage your store&apos;s general settings and content.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
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
        </div>
      )}

      {/* General Settings */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">General</h2>
          <p className="text-sm text-slate-400">Basic site information</p>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Site Name
            </label>
            <input
              type="text"
              name="siteName"
              value={settings.siteName}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="My Store"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Announcement Banner
            </label>
            <input
              type="text"
              name="announcement"
              value={settings.announcement}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Free shipping on orders over $100!"
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave empty to hide the announcement bar
            </p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Hero Section</h2>
          <p className="text-sm text-slate-400">Homepage hero content</p>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Heading
            </label>
            <input
              type="text"
              name="heroHeading"
              value={settings.heroHeading}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Welcome to Our Store"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Subheading / Copy
            </label>
            <textarea
              name="heroCopy"
              value={settings.heroCopy}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              placeholder="Describe your store in a few sentences..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                CTA Button Text
              </label>
              <input
                type="text"
                name="ctaLabel"
                value={settings.ctaLabel}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="Get Started"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                CTA Button Link
              </label>
              <input
                type="text"
                name="ctaLink"
                value={settings.ctaLink}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="/products"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Contact Information</h2>
          <p className="text-sm text-slate-400">How customers can reach you</p>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                name="contactEmail"
                value={settings.contactEmail}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="hello@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={settings.contactPhone}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Address
            </label>
            <textarea
              name="address"
              value={settings.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              placeholder="123 Main St, City, State 12345"
            />
          </div>
        </div>
      </div>

      {/* Google Cloud Storage */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Google Cloud Storage</h2>
              <p className="text-sm text-slate-400">Configure cloud storage for images and files</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-300">Enable Cloud Storage</p>
              <p className="text-xs text-slate-500">
                When enabled, all uploads will be stored in Google Cloud Storage
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={gcsConfig.enabled}
                onChange={handleGcsToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* Upload JSON File */}
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-400">Quick Setup</p>
                <p className="text-xs text-slate-400">
                  Upload your service account JSON key file to auto-fill credentials
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                  className="hidden"
                  id="gcs-json-upload"
                />
                <label
                  htmlFor="gcs-json-upload"
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload JSON Key
                </label>
              </div>
            </div>
          </div>

          {/* GCS Configuration Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Project ID
              </label>
              <input
                type="text"
                name="projectId"
                value={gcsConfig.projectId}
                onChange={handleGcsChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="my-gcp-project"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Bucket Name
              </label>
              <input
                type="text"
                name="bucketName"
                value={gcsConfig.bucketName}
                onChange={handleGcsChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="my-storage-bucket"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Service Account Email
            </label>
            <input
              type="email"
              name="clientEmail"
              value={gcsConfig.clientEmail}
              onChange={handleGcsChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="service-account@project.iam.gserviceaccount.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Private Key
            </label>
            <div className="relative">
              <textarea
                name="privateKey"
                value={gcsConfig.privateKey}
                onChange={handleGcsChange}
                rows={4}
                className={`w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none font-mono text-xs ${
                  !showPrivateKey && gcsConfig.privateKey ? 'text-security-disc' : ''
                }`}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                style={{
                  fontFamily: 'monospace',
                  WebkitTextSecurity: !showPrivateKey && gcsConfig.privateKey ? 'disc' : 'none'
                } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute top-2 right-2 p-2 text-slate-400 hover:text-white transition-colors"
                title={showPrivateKey ? 'Hide private key' : 'Show private key'}
              >
                {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Paste the <code className="text-cyan-400">private_key</code> value from your GCP service account JSON file.
              Include the entire key from <code className="text-cyan-400">-----BEGIN PRIVATE KEY-----</code> to <code className="text-cyan-400">-----END PRIVATE KEY-----</code>.
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleTestGcsConnection}
              disabled={isTestingGcs}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isTestingGcs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
              Test Connection
            </button>

            {gcsTestResult && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  gcsTestResult.success ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {gcsTestResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {gcsTestResult.message}
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Setup Instructions</h4>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Create a Google Cloud project and enable the Cloud Storage API</li>
              <li>Create a Cloud Storage bucket for your files</li>
              <li>Create a service account with Storage Admin role</li>
              <li>Generate a JSON key for the service account</li>
              <li>Copy the project ID, bucket name, client email, and private key here</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Google reCAPTCHA */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Google reCAPTCHA</h2>
              <p className="text-sm text-slate-400">Protect forms from bots and spam</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-300">Enable reCAPTCHA</p>
              <p className="text-xs text-slate-500">
                When enabled, reCAPTCHA will be required on the admin login page
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={recaptchaConfig.enabled}
                onChange={handleRecaptchaToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {/* Warning when enabled without keys */}
          {recaptchaConfig.enabled && (!recaptchaConfig.siteKey || !recaptchaConfig.secretKey) && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">Configuration Required</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Please enter both Site Key and Secret Key for reCAPTCHA to work properly.
                </p>
              </div>
            </div>
          )}

          {/* reCAPTCHA Keys */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Site Key
            </label>
            <input
              type="text"
              name="siteKey"
              value={recaptchaConfig.siteKey}
              onChange={handleRecaptchaChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="6Lc..."
            />
            <p className="text-xs text-slate-500 mt-1">
              The public key used in your frontend
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Secret Key
            </label>
            <div className="relative">
              <input
                type={showRecaptchaSecretKey ? 'text' : 'password'}
                name="secretKey"
                value={recaptchaConfig.secretKey}
                onChange={handleRecaptchaChange}
                className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="6Lc..."
              />
              <button
                type="button"
                onClick={() => setShowRecaptchaSecretKey(!showRecaptchaSecretKey)}
                className="absolute top-1/2 -translate-y-1/2 right-3 p-1 text-slate-400 hover:text-white transition-colors"
                title={showRecaptchaSecretKey ? 'Hide secret key' : 'Show secret key'}
              >
                {showRecaptchaSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The private key used for server-side verification (never exposed to clients)
            </p>
          </div>

          {/* Help Text */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Setup Instructions</h4>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Go to the <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google reCAPTCHA Admin Console</a></li>
              <li>Register a new site with reCAPTCHA v2 (&quot;I&apos;m not a robot&quot; checkbox)</li>
              <li>Add your domain(s) to the allowed domains list</li>
              <li>Copy the Site Key and Secret Key provided</li>
              <li>Paste the keys above and enable reCAPTCHA</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
