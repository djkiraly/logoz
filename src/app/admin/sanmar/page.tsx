'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings,
  Database,
  History,
  FolderTree,
  Play,
  TestTube,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  FileText,
} from 'lucide-react';

type SanMarConfig = {
  configured: boolean;
  config: {
    id: number;
    hasCredentials: boolean;
    customerNumber: string;
    username: string;
    syncEnabled: boolean;
    autoSyncEnabled: boolean;
    autoSyncSchedule: string | null;
    defaultVisibility: boolean;
    defaultCategoryId: string | null;
    importDiscontinued: boolean;
    categoryFilter: string[];
    brandFilter: string[];
    lastBulkSyncAt: string | null;
    lastDeltaSyncAt: string | null;
    lastInventorySyncAt: string | null;
    lastPricingSyncAt: string | null;
    totalProductsSynced: number;
    totalVariantsSynced: number;
  } | null;
};

type CategoryMapping = {
  id: string;
  sanmarCategory: string;
  localCategoryId: string | null;
  localCategoryName: string | null;
  autoCreate: boolean;
};

type LocalCategory = {
  id: string;
  title: string;
  slug: string;
};

type CatalogFile = {
  name: string;
  size: number;
  modifiedAt: string;
};

type SyncHistoryItem = {
  id: string;
  syncType: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  productsAdded: number;
  productsUpdated: number;
  productsSkipped: number;
  errorCount: number;
};

export default function SanMarSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'credentials' | 'sync' | 'categories' | 'catalog' | 'history'>('credentials');

  // Config state
  const [config, setConfig] = useState<SanMarConfig | null>(null);
  const [credentials, setCredentials] = useState({
    customerNumber: '',
    username: '',
    password: '',
  });
  const [syncSettings, setSyncSettings] = useState({
    syncEnabled: false,
    autoSyncEnabled: false,
    autoSyncSchedule: '0 6 * * *',
    defaultVisibility: false,
    importDiscontinued: false,
    categoryFilter: [] as string[],
    brandFilter: [] as string[],
  });

  // Category mappings
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [localCategories, setLocalCategories] = useState<LocalCategory[]>([]);

  // Sync history
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);

  // Catalog upload
  const [catalogFiles, setCatalogFiles] = useState<CatalogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Manual sync options
  const [syncType, setSyncType] = useState<'category' | 'brand' | 'product'>('category');
  const [syncTarget, setSyncTarget] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'categories') {
      fetchCategoryMappings();
    } else if (activeTab === 'catalog') {
      fetchCatalogFiles();
    } else if (activeTab === 'history') {
      fetchSyncHistory();
    }
  }, [activeTab]);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/sanmar/config');
      const data = await response.json();
      if (data.ok) {
        setConfig(data.data);
        if (data.data.config) {
          // Load credentials (customer number and username only - password is never returned)
          setCredentials({
            customerNumber: data.data.config.customerNumber || '',
            username: data.data.config.username || '',
            password: '', // Password is never returned from API for security
          });
          setSyncSettings({
            syncEnabled: data.data.config.syncEnabled,
            autoSyncEnabled: data.data.config.autoSyncEnabled,
            autoSyncSchedule: data.data.config.autoSyncSchedule || '0 6 * * *',
            defaultVisibility: data.data.config.defaultVisibility,
            importDiscontinued: data.data.config.importDiscontinued,
            categoryFilter: data.data.config.categoryFilter || [],
            brandFilter: data.data.config.brandFilter || [],
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategoryMappings = async () => {
    try {
      const response = await fetch('/api/admin/sanmar/categories');
      const data = await response.json();
      if (data.ok) {
        setCategoryMappings(data.data.mappings || []);
        setLocalCategories(data.data.localCategories || []);
      }
    } catch (error) {
      console.error('Failed to fetch category mappings:', error);
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const response = await fetch('/api/admin/sanmar/history?limit=20&stats=true');
      const data = await response.json();
      if (data.ok) {
        setSyncHistory(data.data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
    }
  };

  const fetchCatalogFiles = async () => {
    try {
      const response = await fetch('/api/admin/sanmar/catalog');
      const data = await response.json();
      if (data.ok) {
        setCatalogFiles(data.data.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch catalog files:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(1)} ${units[unit]}`;
  };

  const handleUploadCatalog = () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Choose a catalog file first' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setMessage(null);

    // Use XHR (not fetch) so we can show upload progress for very large files.
    // The File is sent as the raw request body and streamed to disk server-side.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/sanmar/catalog');
    xhr.setRequestHeader('x-filename', selectedFile.name);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      setUploadProgress(0);
      let body: { ok?: boolean; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to status check
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.ok) {
        setMessage({ type: 'success', text: `Uploaded "${selectedFile.name}". Run the importer on the server to begin the import.` });
        setSelectedFile(null);
        fetchCatalogFiles();
      } else {
        setMessage({ type: 'error', text: body.error || `Upload failed (HTTP ${xhr.status})` });
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(0);
      setMessage({ type: 'error', text: 'Upload failed (network error)' });
    };

    xhr.send(selectedFile);
  };

  const handleDeleteCatalog = async (name: string) => {
    if (!window.confirm(`Delete "${name}"? This frees disk space and cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/sanmar/catalog?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `Deleted "${name}"` });
        fetchCatalogFiles();
      } else {
        throw new Error(data.error || 'Failed to delete file');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete' });
    }
  };

  const handleSaveCredentials = async () => {
    // Require all fields for first-time setup, but allow updating without password if already configured
    const isFirstSetup = !config?.configured;
    if (!credentials.customerNumber || !credentials.username) {
      setMessage({ type: 'error', text: 'Please fill in customer number and username' });
      return;
    }
    if (isFirstSetup && !credentials.password) {
      setMessage({ type: 'error', text: 'Please enter a password' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/sanmar/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      if (data.ok) {
        setMessage({ type: 'success', text: 'Credentials saved successfully!' });
        // Only clear the password field, keep customer number and username visible
        setCredentials((prev) => ({ ...prev, password: '' }));
        fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to save credentials');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSyncSettings = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/sanmar/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncSettings),
      });

      const data = await response.json();
      if (data.ok) {
        setMessage({ type: 'success', text: 'Sync settings saved!' });
        fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (useFormCredentials: boolean = false) => {
    setIsTesting(true);
    setMessage(null);

    try {
      const requestBody: Record<string, string> = {};

      // If testing form credentials (before save), include them in the request
      if (useFormCredentials && credentials.customerNumber && credentials.username && credentials.password) {
        requestBody.customerNumber = credentials.customerNumber;
        requestBody.username = credentials.username;
        requestBody.password = credentials.password;
      }

      const response = await fetch('/api/admin/sanmar/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (data.ok && data.data.success) {
        setMessage({ type: 'success', text: 'Connection successful! Credentials are valid.' });
      } else {
        setMessage({ type: 'error', text: data.data?.error || 'Connection failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualSync = async () => {
    if (!syncTarget) {
      setMessage({ type: 'error', text: 'Please enter a sync target' });
      return;
    }

    setIsSyncing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/sanmar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncType,
          [syncType]: syncTarget,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        setMessage({
          type: 'success',
          text: `Sync complete: ${data.data.productsAdded || 0} added, ${data.data.productsUpdated || 0} updated`,
        });
        fetchSyncHistory();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateCategoryMapping = async (sanmarCategory: string, localCategoryId: string | null, autoCreate: boolean) => {
    try {
      const response = await fetch('/api/admin/sanmar/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sanmarCategory, localCategoryId, autoCreate }),
      });

      if (response.ok) {
        fetchCategoryMappings();
      }
    } catch (error) {
      console.error('Failed to update mapping:', error);
    }
  };

  const handleInitializeMappings = async () => {
    try {
      const response = await fetch('/api/admin/sanmar/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      });

      if (response.ok) {
        fetchCategoryMappings();
        setMessage({ type: 'success', text: 'Category mappings initialized' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to initialize mappings' });
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
    <div className="max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SanMar Integration</h1>
            <p className="text-slate-400 mt-1">
              Sync products from SanMar wholesale catalog
            </p>
          </div>
        </div>
        {config?.configured && (
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${config.config?.syncEnabled ? 'bg-green-400' : 'bg-slate-500'}`} />
            <span className="text-slate-400">
              {config.config?.syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}
            </span>
          </div>
        )}
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

      {/* Stats Summary */}
      {config?.config && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Products Synced</p>
            <p className="text-2xl font-bold text-white">{config.config.totalProductsSynced}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Variants Synced</p>
            <p className="text-2xl font-bold text-white">{config.config.totalVariantsSynced}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Last Bulk Sync</p>
            <p className="text-sm font-medium text-white">
              {config.config.lastBulkSyncAt
                ? new Date(config.config.lastBulkSyncAt).toLocaleDateString()
                : 'Never'}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Last Delta Sync</p>
            <p className="text-sm font-medium text-white">
              {config.config.lastDeltaSyncAt
                ? new Date(config.config.lastDeltaSyncAt).toLocaleDateString()
                : 'Never'}
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { id: 'credentials', label: 'Credentials', icon: Settings },
          { id: 'sync', label: 'Sync Settings', icon: RefreshCw },
          { id: 'categories', label: 'Category Mapping', icon: FolderTree },
          { id: 'catalog', label: 'Catalog Upload', icon: Upload },
          { id: 'history', label: 'Sync History', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Credentials Tab */}
      {activeTab === 'credentials' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">SanMar API Credentials</h2>
            <p className="text-sm text-slate-400">
              Enter your SanMar Web Services credentials
            </p>
          </div>
          <div className="p-5 space-y-5">
            {config?.configured && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Credentials are configured</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Customer Number
              </label>
              <input
                type="text"
                value={credentials.customerNumber}
                onChange={(e) => setCredentials({ ...credentials, customerNumber: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="Your SanMar customer number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="API username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder={config?.configured ? '••••••••••••••••' : 'API password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {config?.configured && !credentials.password && (
                <p className="text-xs text-slate-500 mt-1">
                  Password is saved. Enter a new password only if you want to change it.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveCredentials}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Credentials
              </button>

              {/* Test with form credentials (before saving) */}
              {credentials.customerNumber && credentials.username && credentials.password && (
                <button
                  onClick={() => handleTestConnection(true)}
                  disabled={isTesting}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                  Test Credentials
                </button>
              )}

              {/* Test with saved credentials */}
              {config?.configured && !credentials.password && (
                <button
                  onClick={() => handleTestConnection(false)}
                  disabled={isTesting}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                  Test Saved Credentials
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync Settings Tab */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          {/* Sync Controls */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
            <div className="p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Sync Configuration</h2>
              <p className="text-sm text-slate-400">Configure automatic product synchronization</p>
            </div>
            <div className="p-5 space-y-5">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-300">Enable Sync</p>
                  <p className="text-xs text-slate-500">Allow product synchronization from SanMar</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncSettings.syncEnabled}
                    onChange={(e) => setSyncSettings({ ...syncSettings, syncEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-300">Auto Sync (Daily)</p>
                  <p className="text-xs text-slate-500">Automatically sync products every day at 6 AM</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncSettings.autoSyncEnabled}
                    onChange={(e) => setSyncSettings({ ...syncSettings, autoSyncEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Default Visibility Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-300">Auto-Publish Products</p>
                  <p className="text-xs text-slate-500">Make imported products visible immediately</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncSettings.defaultVisibility}
                    onChange={(e) => setSyncSettings({ ...syncSettings, defaultVisibility: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Import Discontinued Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-300">Import Discontinued</p>
                  <p className="text-xs text-slate-500">Include discontinued products in sync</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncSettings.importDiscontinued}
                    onChange={(e) => setSyncSettings({ ...syncSettings, importDiscontinued: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              <button
                onClick={handleSaveSyncSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </div>

          {/* Manual Sync */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
            <div className="p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Manual Sync</h2>
              <p className="text-sm text-slate-400">Trigger a manual product sync</p>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Sync Type
                  </label>
                  <select
                    value={syncType}
                    onChange={(e) => setSyncType(e.target.value as typeof syncType)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="category">By Category</option>
                    <option value="brand">By Brand</option>
                    <option value="product">Single Product</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {syncType === 'category' ? 'Category Name' : syncType === 'brand' ? 'Brand Name' : 'Style ID'}
                  </label>
                  <input
                    type="text"
                    value={syncTarget}
                    onChange={(e) => setSyncTarget(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder={syncType === 'category' ? 'T-Shirts' : syncType === 'brand' ? 'Port & Company' : 'PC61'}
                  />
                </div>
              </div>

              <button
                onClick={handleManualSync}
                disabled={isSyncing || !config?.configured}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Category Mapping</h2>
              <p className="text-sm text-slate-400">Map SanMar categories to your local categories</p>
            </div>
            <button
              onClick={handleInitializeMappings}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Initialize Mappings
            </button>
          </div>
          <div className="p-5">
            {categoryMappings.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No category mappings found. Click &quot;Initialize Mappings&quot; to create them.
              </p>
            ) : (
              <div className="space-y-3">
                {categoryMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{mapping.sanmarCategory}</p>
                    </div>
                    <div className="flex-1">
                      <select
                        value={mapping.localCategoryId || ''}
                        onChange={(e) =>
                          handleUpdateCategoryMapping(
                            mapping.sanmarCategory,
                            e.target.value || null,
                            mapping.autoCreate
                          )
                        }
                        className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="">-- Not Mapped --</option>
                        {localCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Auto-create</label>
                      <input
                        type="checkbox"
                        checked={mapping.autoCreate}
                        onChange={(e) =>
                          handleUpdateCategoryMapping(
                            mapping.sanmarCategory,
                            mapping.localCategoryId,
                            e.target.checked
                          )
                        }
                        className="rounded border-slate-500 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Catalog Upload Tab */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Upload card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
            <div className="p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Upload Catalog File</h2>
              <p className="text-sm text-slate-400">
                Upload the SanMar catalog data file (.txt / .csv / .tsv). Large files are streamed,
                so size is not a concern. After uploading, run the importer on the server.
              </p>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 cursor-pointer hover:bg-white/10 transition-colors">
                  <FileText className="w-4 h-4" />
                  {selectedFile ? selectedFile.name : 'Choose file...'}
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {selectedFile && (
                  <span className="text-sm text-slate-400">{formatBytes(selectedFile.size)}</span>
                )}
                <button
                  onClick={handleUploadCatalog}
                  disabled={isUploading || !selectedFile}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </button>
              </div>

              {isUploading && (
                <div className="space-y-1">
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">{uploadProgress}% uploaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Stored files card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Stored Catalog Files</h2>
                <p className="text-sm text-slate-400">
                  Files available to the importer. Delete a file to free disk space once imported.
                </p>
              </div>
              <button
                onClick={fetchCatalogFiles}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="p-5">
              {catalogFiles.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No catalog files uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {catalogFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{file.name}</p>
                          <p className="text-xs text-slate-400">
                            {formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 font-mono">
                            npm run import:sanmar -- {file.name}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCatalog(file.name)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Sync History</h2>
            <p className="text-sm text-slate-400">Recent synchronization activity</p>
          </div>
          <div className="p-5">
            {syncHistory.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No sync history found</p>
            ) : (
              <div className="space-y-3">
                {syncHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          item.status === 'COMPLETED'
                            ? 'bg-green-400'
                            : item.status === 'FAILED'
                            ? 'bg-red-400'
                            : 'bg-yellow-400'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {item.syncType} sync
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(item.startedAt).toLocaleString()} by {item.triggeredBy}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">
                        +{item.productsAdded} / ~{item.productsUpdated} / -{item.productsSkipped}
                      </p>
                      {item.errorCount > 0 && (
                        <p className="text-xs text-red-400">{item.errorCount} errors</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
