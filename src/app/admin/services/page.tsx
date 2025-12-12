'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Pencil,
  Trash2,
  Search,
  Wrench,
  X,
  Link as LinkIcon,
  FileText,
  Image,
} from 'lucide-react';

type FulfillmentMethod =
  | 'EMBROIDERY'
  | 'SCREEN_PRINT'
  | 'DTG'
  | 'VINYL'
  | 'SUBLIMATION'
  | 'LASER'
  | 'PROMO';

type Service = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  heroImage: string | null;
  methods: FulfillmentMethod[];
  ctaLabel: string | null;
  ctaLink: string | null;
  _count?: {
    categories: number;
  };
};

const FULFILLMENT_METHODS: { value: FulfillmentMethod; label: string }[] = [
  { value: 'EMBROIDERY', label: 'Embroidery' },
  { value: 'SCREEN_PRINT', label: 'Screen Print' },
  { value: 'DTG', label: 'DTG' },
  { value: 'VINYL', label: 'Vinyl' },
  { value: 'SUBLIMATION', label: 'Sublimation' },
  { value: 'LASER', label: 'Laser' },
  { value: 'PROMO', label: 'Promo' },
];

type ServiceFormData = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  heroImage: string | null;
  methods: FulfillmentMethod[];
  ctaLabel: string | null;
  ctaLink: string | null;
};

const emptyService: ServiceFormData = {
  slug: '',
  title: '',
  summary: '',
  body: '',
  heroImage: null,
  methods: [],
  ctaLabel: null,
  ctaLink: null,
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(emptyService);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/admin/services');
      const data = await response.json();
      if (data.ok && data.data) {
        setServices(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setMessage({ type: 'error', text: 'Failed to load services' });
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const openCreateModal = () => {
    setEditingService(null);
    setFormData(emptyService);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      slug: service.slug,
      title: service.title,
      summary: service.summary,
      body: service.body,
      heroImage: service.heroImage,
      methods: service.methods || [],
      ctaLabel: service.ctaLabel,
      ctaLink: service.ctaLink,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData(emptyService);
  };

  const handleSave = async () => {
    if (!formData.slug.trim()) {
      setMessage({ type: 'error', text: 'Slug is required' });
      return;
    }
    if (!formData.title.trim()) {
      setMessage({ type: 'error', text: 'Title is required' });
      return;
    }
    if (!formData.summary.trim()) {
      setMessage({ type: 'error', text: 'Summary is required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const url = editingService
        ? `/api/admin/services/${editingService.id}`
        : '/api/admin/services';
      const method = editingService ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save service');
      }

      setMessage({
        type: 'success',
        text: editingService ? 'Service updated successfully!' : 'Service created successfully!',
      });
      closeModal();
      fetchServices();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save service',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/services/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete service');
      }

      setMessage({ type: 'success', text: 'Service deleted successfully!' });
      setDeleteConfirm(null);
      fetchServices();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete service',
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Auto-generate slug from title when creating a new service
    if (name === 'title' && !editingService) {
      setFormData((prev) => ({
        ...prev,
        title: value,
        slug: generateSlug(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value === '' ? null : value,
      }));
    }
  };

  const handleMethodToggle = (method: FulfillmentMethod) => {
    setFormData((prev) => ({
      ...prev,
      methods: prev.methods.includes(method)
        ? prev.methods.filter((m) => m !== method)
        : [...prev.methods, method],
    }));
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      !searchQuery ||
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
          <h1 className="text-2xl font-bold text-white">Services</h1>
          <p className="text-slate-400 mt-1">
            Manage services displayed on the public services page.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Service
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
      </div>

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">
            {services.length === 0
              ? 'No services yet. Add your first service to get started.'
              : 'No services match your search.'}
          </p>
          {services.length === 0 && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Service</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Slug</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Methods</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Categories</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {service.heroImage ? (
                        <img
                          src={service.heroImage}
                          alt={service.title}
                          className="w-12 h-12 rounded-lg object-cover bg-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                          <Wrench className="w-6 h-6 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <span className="text-white font-medium">{service.title}</span>
                        <p className="text-xs text-slate-500 line-clamp-1">{service.summary}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300 font-mono text-sm">{service.slug}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {service.methods?.slice(0, 3).map((method) => (
                        <span
                          key={method}
                          className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded"
                        >
                          {method.replace('_', ' ')}
                        </span>
                      ))}
                      {(service.methods?.length || 0) > 3 && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 text-slate-400 rounded">
                          +{service.methods.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300">{service._count?.categories || 0}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(service)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit service"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === service.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(service.id)}
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
                          onClick={() => setDeleteConfirm(service.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete service"
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
          <div className="relative bg-slate-900 border border-white/10 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingService ? 'Edit Service' : 'Add New Service'}
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
              {/* Title & Slug */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="e.g., Embroidery Services"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Slug *
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono"
                    placeholder="e.g., embroidery"
                  />
                  <p className="mt-1 text-xs text-slate-500">URL-friendly identifier (auto-generated from title)</p>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Summary *
                </label>
                <textarea
                  name="summary"
                  value={formData.summary}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  placeholder="Brief description shown on service cards..."
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Description
                </label>
                <textarea
                  name="body"
                  value={formData.body}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  placeholder="Detailed description of the service..."
                />
              </div>

              {/* Hero Image URL */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Image className="w-4 h-4 inline mr-1" />
                  Hero Image URL
                </label>
                <input
                  type="url"
                  name="heroImage"
                  value={formData.heroImage || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="https://example.com/image.jpg"
                />
                {formData.heroImage && (
                  <div className="mt-2">
                    <img
                      src={formData.heroImage}
                      alt="Preview"
                      className="w-24 h-24 rounded-lg object-cover bg-white/10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    CTA Button Label
                  </label>
                  <input
                    type="text"
                    name="ctaLabel"
                    value={formData.ctaLabel || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="e.g., Request Quote"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <LinkIcon className="w-4 h-4 inline mr-1" />
                    CTA Link
                  </label>
                  <input
                    type="text"
                    name="ctaLink"
                    value={formData.ctaLink || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="e.g., /contact"
                  />
                </div>
              </div>

              {/* Fulfillment Methods */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Fulfillment Methods
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FULFILLMENT_METHODS.map((method) => (
                    <label
                      key={method.value}
                      className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.methods.includes(method.value)}
                        onChange={() => handleMethodToggle(method.value)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                      <span className="text-xs text-slate-300">{method.label}</span>
                    </label>
                  ))}
                </div>
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
                {editingService ? 'Save Changes' : 'Create Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
