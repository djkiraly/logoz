'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Pencil,
  Trash2,
  ExternalLink,
  Star,
  X,
} from 'lucide-react';

type FulfillmentMethod =
  | 'EMBROIDERY'
  | 'SCREEN_PRINT'
  | 'DTG'
  | 'VINYL'
  | 'SUBLIMATION'
  | 'LASER'
  | 'PROMO';

type Vendor = {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  leadTimeDays: number | null;
  capabilities: FulfillmentMethod[];
  featured: boolean;
  _count?: {
    products: number;
  };
};

const FULFILLMENT_METHODS: { value: FulfillmentMethod; label: string }[] = [
  { value: 'EMBROIDERY', label: 'Embroidery' },
  { value: 'SCREEN_PRINT', label: 'Screen Print' },
  { value: 'DTG', label: 'DTG (Direct to Garment)' },
  { value: 'VINYL', label: 'Vinyl' },
  { value: 'SUBLIMATION', label: 'Sublimation' },
  { value: 'LASER', label: 'Laser' },
  { value: 'PROMO', label: 'Promotional' },
];

const emptyVendor: Omit<Vendor, 'id' | '_count'> = {
  name: '',
  logoUrl: null,
  website: null,
  description: null,
  leadTimeDays: null,
  capabilities: [],
  featured: false,
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<Omit<Vendor, 'id' | '_count'>>(emptyVendor);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/admin/vendors');
      const data = await response.json();
      if (data.ok && data.data) {
        setVendors(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setMessage({ type: 'error', text: 'Failed to load vendors' });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingVendor(null);
    setFormData(emptyVendor);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      logoUrl: vendor.logoUrl,
      website: vendor.website,
      description: vendor.description,
      leadTimeDays: vendor.leadTimeDays,
      capabilities: vendor.capabilities,
      featured: vendor.featured,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVendor(null);
    setFormData(emptyVendor);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Vendor name is required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const url = editingVendor
        ? `/api/admin/vendors/${editingVendor.id}`
        : '/api/admin/vendors';
      const method = editingVendor ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save vendor');
      }

      setMessage({
        type: 'success',
        text: editingVendor ? 'Vendor updated successfully!' : 'Vendor created successfully!',
      });
      closeModal();
      fetchVendors();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save vendor',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/vendors/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete vendor');
      }

      setMessage({ type: 'success', text: 'Vendor deleted successfully!' });
      setDeleteConfirm(null);
      fetchVendors();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete vendor',
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? value === ''
            ? null
            : parseInt(value, 10)
          : value === ''
          ? null
          : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleCapabilityToggle = (method: FulfillmentMethod) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(method)
        ? prev.capabilities.filter((m) => m !== method)
        : [...prev.capabilities, method],
    }));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendors</h1>
          <p className="text-slate-400 mt-1">
            Manage your product vendors and suppliers. These will be displayed on your storefront.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
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

      {/* Vendors List */}
      {vendors.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
          <p className="text-slate-400 mb-4">No vendors yet. Add your first vendor to get started.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Vendor</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Capabilities</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Lead Time</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Products</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {vendor.logoUrl ? (
                        <img
                          src={vendor.logoUrl}
                          alt={vendor.name}
                          className="w-10 h-10 rounded-lg object-contain bg-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                          <span className="text-white font-medium">
                            {vendor.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{vendor.name}</span>
                          {vendor.featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {vendor.website && (
                          <a
                            href={vendor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            Visit website <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {vendor.capabilities.length > 0 ? (
                        vendor.capabilities.slice(0, 3).map((cap) => (
                          <span
                            key={cap}
                            className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded"
                          >
                            {cap.replace('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-sm">None</span>
                      )}
                      {vendor.capabilities.length > 3 && (
                        <span className="px-2 py-0.5 text-xs bg-slate-500/10 text-slate-400 rounded">
                          +{vendor.capabilities.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300">
                      {vendor.leadTimeDays ? `${vendor.leadTimeDays} days` : '-'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300">{vendor._count?.products ?? 0}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(vendor)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit vendor"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === vendor.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(vendor.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-500 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(vendor.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete vendor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative bg-slate-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="e.g., SanMar"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  name="logoUrl"
                  value={formData.logoUrl || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="https://vendor.com"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  placeholder="Brief description of the vendor..."
                />
              </div>

              {/* Lead Time */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  name="leadTimeDays"
                  value={formData.leadTimeDays ?? ''}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="e.g., 5"
                />
              </div>

              {/* Capabilities */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Capabilities
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FULFILLMENT_METHODS.map((method) => (
                    <label
                      key={method.value}
                      className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.capabilities.includes(method.value)}
                        onChange={() => handleCapabilityToggle(method.value)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                      <span className="text-sm text-slate-300">{method.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Featured */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-300">Featured Vendor</span>
                    <p className="text-xs text-slate-500">
                      Featured vendors appear prominently on the storefront
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingVendor ? 'Save Changes' : 'Create Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
