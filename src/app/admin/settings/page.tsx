'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

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
      const response = await fetch('/api/settings');
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
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
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
    </div>
  );
}
