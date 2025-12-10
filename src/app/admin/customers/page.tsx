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
  X,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Filter,
} from 'lucide-react';

type CustomerStatus = 'LEAD' | 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'CHURNED';
type CustomerType = 'INDIVIDUAL' | 'BUSINESS' | 'NONPROFIT' | 'GOVERNMENT' | 'EDUCATION';

type Customer = {
  id: string;
  companyName: string | null;
  customerType: CustomerType;
  website: string | null;
  industry: string | null;
  employeeCount: string | null;
  annualRevenue: string | null;
  contactName: string;
  contactTitle: string | null;
  email: string;
  phone: string | null;
  mobilePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  status: CustomerStatus;
  source: string | null;
  assignedTo: string | null;
  tags: string[];
  taxExempt: boolean;
  taxId: string | null;
  paymentTerms: string | null;
  creditLimit: string | null;
  preferredContact: string | null;
  marketingOptIn: boolean;
  notes: string | null;
  lastContactAt: string | null;
  createdAt: string;
};

const CUSTOMER_STATUSES: { value: CustomerStatus; label: string; color: string }[] = [
  { value: 'LEAD', label: 'Lead', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'PROSPECT', label: 'Prospect', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-500/20 text-green-400' },
  { value: 'INACTIVE', label: 'Inactive', color: 'bg-slate-500/20 text-slate-400' },
  { value: 'CHURNED', label: 'Churned', color: 'bg-red-500/20 text-red-400' },
];

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'NONPROFIT', label: 'Non-Profit' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'EDUCATION', label: 'Education' },
];

const INDUSTRIES = [
  'Advertising & Marketing',
  'Agriculture',
  'Automotive',
  'Construction',
  'Education',
  'Entertainment',
  'Finance & Banking',
  'Food & Beverage',
  'Healthcare',
  'Hospitality',
  'Manufacturing',
  'Non-Profit',
  'Real Estate',
  'Retail',
  'Sports & Recreation',
  'Technology',
  'Transportation',
  'Other',
];

const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Trade Show',
  'Social Media',
  'Cold Call',
  'Email Campaign',
  'Google Search',
  'Partner',
  'Other',
];

type CustomerFormData = {
  companyName: string;
  customerType: CustomerType;
  website: string;
  industry: string;
  employeeCount: string;
  annualRevenue: string;
  contactName: string;
  contactTitle: string;
  email: string;
  phone: string;
  mobilePhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  status: CustomerStatus;
  source: string;
  assignedTo: string;
  tags: string[];
  taxExempt: boolean;
  taxId: string;
  paymentTerms: string;
  creditLimit: string;
  preferredContact: string;
  marketingOptIn: boolean;
  notes: string;
};

const emptyCustomer: CustomerFormData = {
  companyName: '',
  customerType: 'BUSINESS',
  website: '',
  industry: '',
  employeeCount: '',
  annualRevenue: '',
  contactName: '',
  contactTitle: '',
  email: '',
  phone: '',
  mobilePhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'USA',
  shippingAddressLine1: '',
  shippingAddressLine2: '',
  shippingCity: '',
  shippingState: '',
  shippingPostalCode: '',
  shippingCountry: '',
  status: 'LEAD',
  source: '',
  assignedTo: '',
  tags: [],
  taxExempt: false,
  taxId: '',
  paymentTerms: '',
  creditLimit: '',
  preferredContact: '',
  marketingOptIn: true,
  notes: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyCustomer);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'basic' | 'address' | 'crm' | 'notes'>('basic');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [filterStatus, filterType]);

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('type', filterType);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/customers?${params.toString()}`);
      const data = await response.json();
      if (data.ok) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setMessage({ type: 'error', text: 'Failed to load customers' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setIsLoading(true);
    fetchCustomers();
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData(emptyCustomer);
    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      companyName: customer.companyName || '',
      customerType: customer.customerType,
      website: customer.website || '',
      industry: customer.industry || '',
      employeeCount: customer.employeeCount || '',
      annualRevenue: customer.annualRevenue || '',
      contactName: customer.contactName,
      contactTitle: customer.contactTitle || '',
      email: customer.email,
      phone: customer.phone || '',
      mobilePhone: customer.mobilePhone || '',
      addressLine1: customer.addressLine1 || '',
      addressLine2: customer.addressLine2 || '',
      city: customer.city || '',
      state: customer.state || '',
      postalCode: customer.postalCode || '',
      country: customer.country || 'USA',
      shippingAddressLine1: customer.shippingAddressLine1 || '',
      shippingAddressLine2: customer.shippingAddressLine2 || '',
      shippingCity: customer.shippingCity || '',
      shippingState: customer.shippingState || '',
      shippingPostalCode: customer.shippingPostalCode || '',
      shippingCountry: customer.shippingCountry || '',
      status: customer.status,
      source: customer.source || '',
      assignedTo: customer.assignedTo || '',
      tags: customer.tags || [],
      taxExempt: customer.taxExempt,
      taxId: customer.taxId || '',
      paymentTerms: customer.paymentTerms || '',
      creditLimit: customer.creditLimit || '',
      preferredContact: customer.preferredContact || '',
      marketingOptIn: customer.marketingOptIn,
      notes: customer.notes || '',
    });
    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData(emptyCustomer);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!formData.contactName.trim() || !formData.email.trim()) {
      setMessage({ type: 'error', text: 'Contact name and email are required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const url = editingCustomer
        ? `/api/admin/customers/${editingCustomer.id}`
        : '/api/admin/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save customer');
      }

      setMessage({
        type: 'success',
        text: editingCustomer ? 'Customer updated successfully!' : 'Customer created successfully!',
      });
      closeModal();
      fetchCustomers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save customer',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/customers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete customer');
      }

      setMessage({ type: 'success', text: 'Customer deleted successfully!' });
      setDeleteConfirm(null);
      fetchCustomers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete customer',
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const copyBillingToShipping = () => {
    setFormData((prev) => ({
      ...prev,
      shippingAddressLine1: prev.addressLine1,
      shippingAddressLine2: prev.addressLine2,
      shippingCity: prev.city,
      shippingState: prev.state,
      shippingPostalCode: prev.postalCode,
      shippingCountry: prev.country,
    }));
  };

  const getStatusBadge = (status: CustomerStatus) => {
    const statusConfig = CUSTOMER_STATUSES.find((s) => s.value === status);
    return statusConfig ? statusConfig.color : 'bg-slate-500/20 text-slate-400';
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.companyName?.toLowerCase().includes(query) ||
      customer.contactName.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query)
    );
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
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-slate-400 mt-1">
            Manage your customer relationships and contact information.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Customer
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

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search customers..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">All Statuses</option>
            {CUSTOMER_STATUSES.map((status) => (
              <option key={status.value} value={status.value} className="bg-slate-800">
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">All Types</option>
            {CUSTOMER_TYPES.map((type) => (
              <option key={type.value} value={type.value} className="bg-slate-800">
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
          <p className="text-slate-400 mb-4">
            {customers.length === 0
              ? 'No customers yet. Add your first customer to get started.'
              : 'No customers match your search criteria.'}
          </p>
          {customers.length === 0 && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Contact</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Location</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        {customer.companyName ? (
                          <Building2 className="w-5 h-5 text-white" />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {customer.companyName || customer.contactName}
                        </p>
                        {customer.companyName && (
                          <p className="text-xs text-slate-500">{customer.contactName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {customer.email}
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {customer.city || customer.state ? (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {[customer.city, customer.state].filter(Boolean).join(', ')}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(customer.status)}`}
                    >
                      {CUSTOMER_STATUSES.find((s) => s.value === customer.status)?.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(customer)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit customer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === customer.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(customer.id)}
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
                          onClick={() => setDeleteConfirm(customer.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete customer"
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
          <div className="relative bg-slate-900 border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { key: 'basic', label: 'Basic Info' },
                { key: 'address', label: 'Address' },
                { key: 'crm', label: 'CRM Details' },
                { key: 'notes', label: 'Notes' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="Acme Corp"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Customer Type
                      </label>
                      <select
                        name="customerType"
                        value={formData.customerType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        {CUSTOMER_TYPES.map((type) => (
                          <option key={type.value} value={type.value} className="bg-slate-800">
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        name="contactTitle"
                        value={formData.contactTitle}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="Marketing Director"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="john@acme.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="https://acme.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Mobile Phone
                      </label>
                      <input
                        type="tel"
                        name="mobilePhone"
                        value={formData.mobilePhone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="(555) 987-6543"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Industry
                      </label>
                      <select
                        name="industry"
                        value={formData.industry}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="" className="bg-slate-800">Select industry</option>
                        {INDUSTRIES.map((industry) => (
                          <option key={industry} value={industry} className="bg-slate-800">
                            {industry}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Employee Count
                      </label>
                      <select
                        name="employeeCount"
                        value={formData.employeeCount}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="" className="bg-slate-800">Select size</option>
                        <option value="1-10" className="bg-slate-800">1-10</option>
                        <option value="11-50" className="bg-slate-800">11-50</option>
                        <option value="51-200" className="bg-slate-800">51-200</option>
                        <option value="201-500" className="bg-slate-800">201-500</option>
                        <option value="501-1000" className="bg-slate-800">501-1000</option>
                        <option value="1000+" className="bg-slate-800">1000+</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Tab */}
              {activeTab === 'address' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-4">Billing Address</h3>
                    <div className="space-y-4">
                      <input
                        type="text"
                        name="addressLine1"
                        value={formData.addressLine1}
                        onChange={handleChange}
                        placeholder="Address Line 1"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <input
                        type="text"
                        name="addressLine2"
                        value={formData.addressLine2}
                        onChange={handleChange}
                        placeholder="Address Line 2"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <div className="grid grid-cols-3 gap-4">
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          placeholder="City"
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleChange}
                          placeholder="State"
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                        <input
                          type="text"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleChange}
                          placeholder="ZIP Code"
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                      </div>
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        placeholder="Country"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <h3 className="text-sm font-semibold text-white">Shipping Address</h3>
                    <button
                      type="button"
                      onClick={copyBillingToShipping}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Copy from billing
                    </button>
                  </div>
                  <div className="space-y-4">
                    <input
                      type="text"
                      name="shippingAddressLine1"
                      value={formData.shippingAddressLine1}
                      onChange={handleChange}
                      placeholder="Address Line 1"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    <input
                      type="text"
                      name="shippingAddressLine2"
                      value={formData.shippingAddressLine2}
                      onChange={handleChange}
                      placeholder="Address Line 2"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <input
                        type="text"
                        name="shippingCity"
                        value={formData.shippingCity}
                        onChange={handleChange}
                        placeholder="City"
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <input
                        type="text"
                        name="shippingState"
                        value={formData.shippingState}
                        onChange={handleChange}
                        placeholder="State"
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <input
                        type="text"
                        name="shippingPostalCode"
                        value={formData.shippingPostalCode}
                        onChange={handleChange}
                        placeholder="ZIP Code"
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                    <input
                      type="text"
                      name="shippingCountry"
                      value={formData.shippingCountry}
                      onChange={handleChange}
                      placeholder="Country"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                </div>
              )}

              {/* CRM Details Tab */}
              {activeTab === 'crm' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Status
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        {CUSTOMER_STATUSES.map((status) => (
                          <option key={status.value} value={status.value} className="bg-slate-800">
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Lead Source
                      </label>
                      <select
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="" className="bg-slate-800">Select source</option>
                        {LEAD_SOURCES.map((source) => (
                          <option key={source} value={source} className="bg-slate-800">
                            {source}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Assigned To
                      </label>
                      <input
                        type="text"
                        name="assignedTo"
                        value={formData.assignedTo}
                        onChange={handleChange}
                        placeholder="Sales rep name"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Preferred Contact
                      </label>
                      <select
                        name="preferredContact"
                        value={formData.preferredContact}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="" className="bg-slate-800">Select preference</option>
                        <option value="email" className="bg-slate-800">Email</option>
                        <option value="phone" className="bg-slate-800">Phone</option>
                        <option value="text" className="bg-slate-800">Text Message</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add a tag"
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Financial Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Payment Terms
                        </label>
                        <select
                          name="paymentTerms"
                          value={formData.paymentTerms}
                          onChange={handleChange}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        >
                          <option value="" className="bg-slate-800">Select terms</option>
                          <option value="Due on Receipt" className="bg-slate-800">Due on Receipt</option>
                          <option value="Net 15" className="bg-slate-800">Net 15</option>
                          <option value="Net 30" className="bg-slate-800">Net 30</option>
                          <option value="Net 45" className="bg-slate-800">Net 45</option>
                          <option value="Net 60" className="bg-slate-800">Net 60</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Credit Limit ($)
                        </label>
                        <input
                          type="number"
                          name="creditLimit"
                          value={formData.creditLimit}
                          onChange={handleChange}
                          placeholder="0.00"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Tax ID / EIN
                        </label>
                        <input
                          type="text"
                          name="taxId"
                          value={formData.taxId}
                          onChange={handleChange}
                          placeholder="XX-XXXXXXX"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            name="taxExempt"
                            checked={formData.taxExempt}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                          />
                          <span className="text-sm text-slate-300">Tax Exempt</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="marketingOptIn"
                        checked={formData.marketingOptIn}
                        onChange={handleCheckboxChange}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-300">Marketing Opt-In</span>
                        <p className="text-xs text-slate-500">
                          Customer has agreed to receive marketing communications
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={10}
                      placeholder="Add any additional notes about this customer..."
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                    />
                  </div>
                </div>
              )}
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
                {editingCustomer ? 'Save Changes' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
