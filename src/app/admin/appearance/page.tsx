'use client';

import { useState } from 'react';
import { Save, Loader2, Palette, Type, Layout, Image } from 'lucide-react';

type ThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: string;
  headerStyle: 'transparent' | 'solid' | 'gradient';
  heroStyle: 'centered' | 'left-aligned' | 'split';
};

const defaultTheme: ThemeSettings = {
  primaryColor: '#06b6d4',
  secondaryColor: '#8b5cf6',
  accentColor: '#f97316',
  fontFamily: 'Inter',
  borderRadius: 'rounded',
  headerStyle: 'transparent',
  heroStyle: 'centered',
};

const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const radiusOptions = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'full', label: 'Pill' },
];

export default function AppearancePage() {
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);
  const [isSaving, setIsSaving] = useState(false);

  const handleColorChange = (key: keyof ThemeSettings, value: string) => {
    setTheme((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save - in production this would save to database
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Appearance</h1>
          <p className="text-slate-400 mt-1">
            Customize your store&apos;s look and feel.
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

      {/* Colors */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Palette className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Colors</h2>
            <p className="text-sm text-slate-400">Brand color palette</p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={theme.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <input
                type="text"
                value={theme.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={theme.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <input
                type="text"
                value={theme.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={theme.accentColor}
                onChange={(e) => handleColorChange('accentColor', e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <input
                type="text"
                value={theme.accentColor}
                onChange={(e) => handleColorChange('accentColor', e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Type className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Typography</h2>
            <p className="text-sm text-slate-400">Font settings</p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Font Family
            </label>
            <select
              value={theme.fontFamily}
              onChange={(e) =>
                setTheme((prev) => ({ ...prev, fontFamily: e.target.value }))
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {fontOptions.map((font) => (
                <option key={font.value} value={font.value} className="bg-slate-800">
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Border Radius
            </label>
            <select
              value={theme.borderRadius}
              onChange={(e) =>
                setTheme((prev) => ({ ...prev, borderRadius: e.target.value }))
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {radiusOptions.map((radius) => (
                <option key={radius.value} value={radius.value} className="bg-slate-800">
                  {radius.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Layout className="w-5 h-5 text-green-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Layout</h2>
            <p className="text-sm text-slate-400">Page structure settings</p>
          </div>
        </div>
        <div className="p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Header Style
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['transparent', 'solid', 'gradient'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    setTheme((prev) => ({ ...prev, headerStyle: style }))
                  }
                  className={`p-4 rounded-lg border text-center transition-all ${
                    theme.headerStyle === style
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-white/10 hover:border-white/20 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-medium capitalize">{style}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Hero Style
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['centered', 'left-aligned', 'split'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    setTheme((prev) => ({ ...prev, heroStyle: style }))
                  }
                  className={`p-4 rounded-lg border text-center transition-all ${
                    theme.heroStyle === style
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-white/10 hover:border-white/20 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-medium capitalize">
                    {style.replace('-', ' ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Image className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Preview</h2>
            <p className="text-sm text-slate-400">See your changes in action</p>
          </div>
        </div>
        <div className="p-5">
          <div
            className="rounded-lg overflow-hidden border border-white/10"
            style={{ fontFamily: theme.fontFamily }}
          >
            {/* Mini Preview Header */}
            <div
              className={`p-3 ${
                theme.headerStyle === 'transparent'
                  ? 'bg-transparent'
                  : theme.headerStyle === 'gradient'
                    ? 'bg-gradient-to-r from-slate-800 to-slate-900'
                    : 'bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-bold text-sm">Logo</div>
                <div className="flex gap-3">
                  <span className="text-xs text-slate-400">Products</span>
                  <span className="text-xs text-slate-400">Services</span>
                  <span className="text-xs text-slate-400">Contact</span>
                </div>
              </div>
            </div>

            {/* Mini Preview Hero */}
            <div
              className={`p-8 bg-gradient-to-br from-slate-800 to-slate-900 ${
                theme.heroStyle === 'centered'
                  ? 'text-center'
                  : theme.heroStyle === 'split'
                    ? 'flex items-center justify-between'
                    : 'text-left'
              }`}
            >
              <div className={theme.heroStyle === 'split' ? 'flex-1' : ''}>
                <h3 className="text-lg font-bold text-white mb-2">
                  Welcome to Our Store
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Discover amazing products
                </p>
                <button
                  className="px-4 py-2 text-sm text-white font-medium"
                  style={{
                    backgroundColor: theme.primaryColor,
                    borderRadius:
                      theme.borderRadius === 'none'
                        ? '0'
                        : theme.borderRadius === 'small'
                          ? '4px'
                          : theme.borderRadius === 'full'
                            ? '9999px'
                            : '8px',
                  }}
                >
                  Get Started
                </button>
              </div>
              {theme.heroStyle === 'split' && (
                <div className="w-24 h-24 rounded-lg bg-white/10" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
