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
  FileText,
  Send,
  Eye,
  UserPlus,
  Package,
  Palette,
  Scissors,
  Printer,
  DollarSign,
  History,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Clock,
} from 'lucide-react';

type QuoteStatus = 'PENDING' | 'REVIEWING' | 'SENT' | 'APPROVED' | 'DECLINED' | 'ARCHIVED';
type LineItemType = 'PRODUCT' | 'SERVICE' | 'CUSTOM' | 'SETUP_FEE' | 'SHIPPING' | 'DISCOUNT';
type FulfillmentMethod = 'EMBROIDERY' | 'SCREEN_PRINT' | 'DTG' | 'VINYL' | 'SUBLIMATION' | 'LASER' | 'PROMO';
type DiscountType = 'FIXED' | 'PERCENTAGE';

type Customer = {
  id: string;
  companyName: string | null;
  contactName: string;
  email: string;
  phone: string | null;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  basePrice: string | number;
  heroImageUrl: string | null;
};

type Supplier = {
  id: string;
  name: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
};

type LineItem = {
  id?: string;
  itemType: LineItemType;
  productId: string | null;
  supplierId: string | null;
  sku: string;
  name: string;
  description: string;
  serviceType: FulfillmentMethod | null;
  serviceOptions: {
    colors?: number;
    locations?: number;
    size?: string;
    material?: string;
    notes?: string;
  } | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
};

type Quote = {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCompany: string | null;
  customer?: Customer | null;
  ownerId: string | null;
  owner?: AdminUser | null;
  title: string | null;
  notes: string | null;
  internalNotes: string | null;
  validUntil: string | null;
  requestedDelivery: string | null;
  subtotal: string | number;
  discountValue: string | number;  // User's original input value
  discount: string | number;       // Calculated discount amount
  discountType: DiscountType;
  tax: string | number;
  taxRate: string | number;
  shipping: string | number;
  total: string | number;
  status: QuoteStatus;
  sentAt: string | null;
  approvedAt: string | null;
  lineItems: LineItem[];
  createdAt: string;
  lastModifiedAt: string;
};

type QuoteAuditLog = {
  id: string;
  quoteId: string;
  action: string;
  description: string;
  actorType: 'ADMIN' | 'CUSTOMER' | 'SYSTEM';
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const QUOTE_STATUSES: { value: QuoteStatus; label: string; color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'REVIEWING', label: 'Reviewing', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'SENT', label: 'Sent', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-green-500/20 text-green-400' },
  { value: 'DECLINED', label: 'Declined', color: 'bg-red-500/20 text-red-400' },
  { value: 'ARCHIVED', label: 'Archived', color: 'bg-slate-500/20 text-slate-400' },
];

const LINE_ITEM_TYPES: { value: LineItemType; label: string }[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'CUSTOM', label: 'Custom Item' },
  { value: 'SETUP_FEE', label: 'Setup Fee' },
  { value: 'SHIPPING', label: 'Shipping' },
  { value: 'DISCOUNT', label: 'Discount' },
];

const SERVICE_TYPES: { value: FulfillmentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'SCREEN_PRINT', label: 'Screen Print', icon: Printer },
  { value: 'DTG', label: 'Direct to Fabric', icon: Palette },
  { value: 'EMBROIDERY', label: 'Embroidery', icon: Scissors },
  { value: 'VINYL', label: 'Vinyl Cutting', icon: Scissors },
  { value: 'SUBLIMATION', label: 'Sublimation', icon: Palette },
  { value: 'LASER', label: 'Laser', icon: Printer },
  { value: 'PROMO', label: 'Promotional', icon: Package },
];

const emptyLineItem: Omit<LineItem, 'total'> = {
  itemType: 'PRODUCT',
  productId: null,
  supplierId: null,
  sku: '',
  name: '',
  description: '',
  serviceType: null,
  serviceOptions: null,
  quantity: 1,
  unitPrice: 0,
  discount: 0,
};

type QuoteFormData = {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  ownerId: string;
  title: string;
  notes: string;
  internalNotes: string;
  validUntil: string;
  requestedDelivery: string;
  discount: number;
  discountType: DiscountType;
  taxRate: number;
  shipping: number;
  status: QuoteStatus;
  lineItems: LineItem[];
};

const emptyQuote: QuoteFormData = {
  customerId: null,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerCompany: '',
  ownerId: '',
  title: '',
  notes: '',
  internalNotes: '',
  validUntil: '',
  requestedDelivery: '',
  discount: 0,
  discountType: 'FIXED',
  taxRate: 0,
  shipping: 0,
  status: 'PENDING',
  lineItems: [],
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [formData, setFormData] = useState<QuoteFormData>(emptyQuote);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    contactName: '',
    email: '',
    phone: '',
    companyName: '',
  });
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [showFoundCustomerPrompt, setShowFoundCustomerPrompt] = useState(false);
  const [createCustomerOnSave, setCreateCustomerOnSave] = useState(true);
  const [auditLogs, setAuditLogs] = useState<QuoteAuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [isAuditExpanded, setIsAuditExpanded] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (searchQuery) params.append('search', searchQuery);

      const [quotesRes, customersRes, productsRes, suppliersRes, usersRes, meRes] = await Promise.all([
        fetch(`/api/admin/quotes?${params.toString()}`),
        fetch('/api/admin/customers'),
        fetch('/api/admin/products'),
        fetch('/api/admin/vendors'),
        fetch('/api/admin/users'),
        fetch('/api/admin/auth/me'),
      ]);

      const [quotesData, customersData, productsData, suppliersData, usersData, meData] = await Promise.all([
        quotesRes.json(),
        customersRes.json(),
        productsRes.json(),
        suppliersRes.json(),
        usersRes.json(),
        meRes.json(),
      ]);

      if (quotesData.ok) setQuotes(quotesData.data);
      if (customersData.ok) setCustomers(customersData.data);
      if (productsData.ok) setProducts(productsData.data);
      if (suppliersData.ok) setSuppliers(suppliersData.data);
      if (usersData.ok) setAdminUsers(usersData.data);
      if (meData.user) {
        setCurrentUserId(meData.user.id);
        setCurrentUserRole(meData.user.role);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingQuote(null);
    setFormData({ ...emptyQuote, ownerId: currentUserId });
    setCustomerMode('existing');
    setShowNewCustomerForm(false);
    setFoundCustomer(null);
    setShowFoundCustomerPrompt(false);
    setCreateCustomerOnSave(true);
    setIsModalOpen(true);
  };

  // Lookup customer by email when manual entry email is filled
  const lookupCustomerByEmail = async (email: string) => {
    if (!email || !email.includes('@')) return;

    setIsLookingUp(true);
    try {
      const response = await fetch(`/api/admin/customers/lookup?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.ok && data.found && data.data) {
        setFoundCustomer(data.data);
        setShowFoundCustomerPrompt(true);
      } else {
        setFoundCustomer(null);
        setShowFoundCustomerPrompt(false);
      }
    } catch (error) {
      console.error('Customer lookup failed:', error);
    } finally {
      setIsLookingUp(false);
    }
  };

  const useFoundCustomer = () => {
    if (foundCustomer) {
      // Add to customers list if not already there
      setCustomers((prev) => {
        const exists = prev.some((c) => c.id === foundCustomer.id);
        if (!exists) {
          return [foundCustomer, ...prev];
        }
        return prev;
      });
      setFormData((prev) => ({ ...prev, customerId: foundCustomer.id }));
      setCustomerMode('existing');
      setShowFoundCustomerPrompt(false);
      setFoundCustomer(null);
      setMessage({ type: 'success', text: 'Customer selected from database' });
    }
  };

  const continueManualEntry = () => {
    setShowFoundCustomerPrompt(false);
    // Keep the form data as is, customer will be created on save
  };

  const openEditModal = (quote: Quote) => {
    setEditingQuote(quote);
    setFormData({
      customerId: quote.customerId,
      customerName: quote.customerName || '',
      customerEmail: quote.customerEmail || '',
      customerPhone: quote.customerPhone || '',
      customerCompany: quote.customerCompany || '',
      ownerId: quote.ownerId || '',
      title: quote.title || '',
      notes: quote.notes || '',
      internalNotes: quote.internalNotes || '',
      validUntil: quote.validUntil ? quote.validUntil.split('T')[0] : '',
      requestedDelivery: quote.requestedDelivery ? quote.requestedDelivery.split('T')[0] : '',
      discount: Number(quote.discountValue) || Number(quote.discount) || 0,
      discountType: quote.discountType,
      taxRate: Number(quote.taxRate) || 0,
      shipping: Number(quote.shipping) || 0,
      status: quote.status,
      lineItems: quote.lineItems.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
    });
    setCustomerMode(quote.customerId ? 'existing' : 'new');
    setIsModalOpen(true);
    // Fetch audit logs for this quote
    fetchAuditLogs(quote.id);
  };

  const fetchAuditLogs = async (quoteId: string) => {
    setIsLoadingAuditLogs(true);
    setAuditLogs([]);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/audit`);
      const data = await response.json();
      if (data.ok) {
        setAuditLogs(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingQuote(null);
    setFormData(emptyQuote);
    setShowNewCustomerForm(false);
    setFoundCustomer(null);
    setShowFoundCustomerPrompt(false);
    setCreateCustomerOnSave(true);
    setAuditLogs([]);
  };

  const calculateLineItemTotal = (item: Omit<LineItem, 'total'>): number => {
    return item.quantity * item.unitPrice - item.discount;
  };

  const calculateTotals = () => {
    const subtotal = formData.lineItems.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = formData.discountType === 'PERCENTAGE'
      ? subtotal * formData.discount / 100
      : formData.discount;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * formData.taxRate / 100;
    const total = afterDiscount + taxAmount + formData.shipping;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      ...emptyLineItem,
      total: 0,
    };
    setFormData((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem],
    }));
  };

  const updateLineItem = (index: number, updates: Partial<LineItem>) => {
    setFormData((prev) => {
      const newItems = [...prev.lineItems];
      const item = { ...newItems[index], ...updates };
      item.total = calculateLineItemTotal(item);
      newItems[index] = item;
      return { ...prev, lineItems: newItems };
    });
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateLineItem(index, {
        productId,
        sku: product.sku,
        name: product.name,
        unitPrice: Number(product.basePrice),
      });
    }
  };

  const createNewCustomer = async () => {
    if (!newCustomerData.contactName || !newCustomerData.email) {
      setMessage({ type: 'error', text: 'Contact name and email are required for new customer' });
      return;
    }

    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomerData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }

      // Add to customers list and select
      setCustomers((prev) => [data.data, ...prev]);
      setFormData((prev) => ({ ...prev, customerId: data.data.id }));
      setCustomerMode('existing');
      setShowNewCustomerForm(false);
      setNewCustomerData({ contactName: '', email: '', phone: '', companyName: '' });
      setMessage({ type: 'success', text: 'Customer created successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create customer',
      });
    }
  };

  const handleSave = async () => {
    // Validate
    if (customerMode === 'existing' && !formData.customerId) {
      setMessage({ type: 'error', text: 'Please select a customer' });
      return;
    }
    if (customerMode === 'new' && !formData.customerName && !formData.customerEmail) {
      setMessage({ type: 'error', text: 'Please provide customer name or email' });
      return;
    }
    if (formData.lineItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one line item' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const url = editingQuote
        ? `/api/admin/quotes/${editingQuote.id}`
        : '/api/admin/quotes';
      const method = editingQuote ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        customerId: customerMode === 'existing' ? formData.customerId : null,
        customerName: customerMode === 'new' ? formData.customerName : null,
        customerEmail: customerMode === 'new' ? formData.customerEmail : null,
        customerPhone: customerMode === 'new' ? formData.customerPhone : null,
        customerCompany: customerMode === 'new' ? formData.customerCompany : null,
        ownerId: formData.ownerId || null,
        status: editingQuote ? formData.status : 'PENDING',
        createCustomer: customerMode === 'new' && createCustomerOnSave && formData.customerEmail,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save quote');
      }

      setMessage({
        type: 'success',
        text: editingQuote ? 'Quote updated successfully!' : 'Quote created successfully!',
      });
      closeModal();
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save quote',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/quotes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete quote');
      }

      setMessage({ type: 'success', text: 'Quote deleted successfully!' });
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete quote',
      });
    }
  };

  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);

  const updateStatus = async (quote: Quote, newStatus: QuoteStatus) => {
    try {
      const response = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      setMessage({ type: 'success', text: `Quote marked as ${newStatus.toLowerCase()}` });
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update status',
      });
    }
  };

  const sendQuoteToCustomer = async (quote: Quote) => {
    // Validate customer has email
    const customerEmail = quote.customer?.email || quote.customerEmail;
    if (!customerEmail) {
      setMessage({ type: 'error', text: 'Cannot send quote: No customer email address' });
      return;
    }

    setSendingQuoteId(quote.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send quote');
      }

      setMessage({ type: 'success', text: data.message || 'Quote sent successfully!' });
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send quote',
      });
    } finally {
      setSendingQuoteId(null);
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    const statusConfig = QUOTE_STATUSES.find((s) => s.value === status);
    return statusConfig ? statusConfig.color : 'bg-slate-500/20 text-slate-400';
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

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
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <p className="text-slate-400 mt-1">
            Create and manage customer quotes with itemized pricing.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Quote
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
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              placeholder="Search quotes..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="">All Statuses</option>
          {QUOTE_STATUSES.map((status) => (
            <option key={status.value} value={status.value} className="bg-slate-800">
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quotes List */}
      {quotes.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-400 mb-4">No quotes yet. Create your first quote to get started.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Quote #</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Owner</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Items</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Total</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Last Modified</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <span className="text-white font-mono">{quote.quoteNumber}</span>
                    {quote.title && (
                      <p className="text-xs text-slate-500 mt-1">{quote.title}</p>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="text-white">
                      {quote.customer?.companyName || quote.customer?.contactName || quote.customerCompany || quote.customerName || '-'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {quote.customer?.email || quote.customerEmail}
                    </p>
                  </td>
                  <td className="p-4">
                    {quote.owner ? (
                      <p className="text-slate-300">{quote.owner.name}</p>
                    ) : (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300">{quote.lineItems.length} items</span>
                  </td>
                  <td className="p-4">
                    <span className="text-white font-semibold">{formatCurrency(quote.total)}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300 text-sm">
                      {new Date(quote.lastModifiedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <p className="text-xs text-slate-500">
                      {new Date(quote.lastModifiedAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(quote.status)}`}>
                      {QUOTE_STATUSES.find((s) => s.value === quote.status)?.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {quote.status === 'PENDING' && (
                        <button
                          onClick={() => sendQuoteToCustomer(quote)}
                          disabled={sendingQuoteId === quote.id}
                          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Send quote to customer"
                        >
                          {sendingQuoteId === quote.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {quote.status === 'SENT' && (
                        <button
                          onClick={() => updateStatus(quote, 'APPROVED')}
                          className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                          title="Mark as approved"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => window.open(`/api/admin/quotes/${quote.id}/print`, '_blank')}
                        className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                        title="Print quote"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(quote)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit quote"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {currentUserRole === 'SUPER_ADMIN' && (
                        deleteConfirm === quote.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(quote.id)}
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
                            onClick={() => setDeleteConfirm(quote.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete quote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quote Builder Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

          <div className="relative bg-slate-900 border border-white/10 rounded-xl w-full max-w-5xl max-h-[95vh] overflow-hidden m-4 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingQuote ? `Edit Quote ${editingQuote.quoteNumber}` : 'Create New Quote'}
              </h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              {/* Customer Selection */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-4">Customer Information</h3>

                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => setCustomerMode('existing')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      customerMode === 'existing'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Select Existing Customer
                  </button>
                  <button
                    onClick={() => setCustomerMode('new')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      customerMode === 'new'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Enter Manually
                  </button>
                </div>

                {customerMode === 'existing' ? (
                  <div className="space-y-3">
                    <select
                      value={formData.customerId || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerId: e.target.value || null }))}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      <option value="">Select a customer...</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id} className="bg-slate-800">
                          {customer.companyName || customer.contactName} - {customer.email}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewCustomerForm(true)}
                      className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      <UserPlus className="w-4 h-4" />
                      Create new customer
                    </button>

                    {showNewCustomerForm && (
                      <div className="mt-4 p-4 bg-white/5 rounded-lg space-y-3">
                        <h4 className="text-sm font-medium text-white">Quick Add Customer</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={newCustomerData.contactName}
                            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, contactName: e.target.value }))}
                            placeholder="Contact Name *"
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm"
                          />
                          <input
                            type="email"
                            value={newCustomerData.email}
                            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="Email *"
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm"
                          />
                          <input
                            type="text"
                            value={newCustomerData.companyName}
                            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, companyName: e.target.value }))}
                            placeholder="Company Name"
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm"
                          />
                          <input
                            type="tel"
                            value={newCustomerData.phone}
                            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="Phone"
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={createNewCustomer}
                            className="px-3 py-1.5 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600"
                          >
                            Create & Select
                          </button>
                          <button
                            onClick={() => setShowNewCustomerForm(false)}
                            className="px-3 py-1.5 text-slate-400 text-sm hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={formData.customerName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Contact Name"
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                      />
                      <div className="relative">
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, customerEmail: e.target.value }));
                            setShowFoundCustomerPrompt(false);
                          }}
                          onBlur={(e) => lookupCustomerByEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                        />
                        {isLookingUp && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                        )}
                      </div>
                      <input
                        type="text"
                        value={formData.customerCompany}
                        onChange={(e) => setFormData((prev) => ({ ...prev, customerCompany: e.target.value }))}
                        placeholder="Company Name"
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                      />
                      <input
                        type="tel"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="Phone"
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                      />
                    </div>

                    {/* Found Customer Prompt */}
                    {showFoundCustomerPrompt && foundCustomer && (
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium mb-1">
                              Customer found in database
                            </p>
                            <p className="text-xs text-slate-400 mb-3">
                              {foundCustomer.companyName || foundCustomer.contactName} ({foundCustomer.email})
                              {foundCustomer.phone && ` • ${foundCustomer.phone}`}
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={useFoundCustomer}
                                className="px-3 py-1.5 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600"
                              >
                                Use This Customer
                              </button>
                              <button
                                type="button"
                                onClick={continueManualEntry}
                                className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20"
                              >
                                Continue Manual Entry
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Create Customer Option */}
                    {!showFoundCustomerPrompt && formData.customerEmail && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createCustomerOnSave}
                          onChange={(e) => setCreateCustomerOnSave(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-slate-400">
                          Add to customer database when saving quote
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Quote Details */}
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Quote Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Spring Event Apparel"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Quote Owner</label>
                  <select
                    value={formData.ownerId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ownerId: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="">Select owner...</option>
                    {adminUsers.map((user) => (
                      <option key={user.id} value={user.id} className="bg-slate-800">
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validUntil: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Requested Delivery</label>
                  <input
                    type="date"
                    value={formData.requestedDelivery}
                    onChange={(e) => setFormData((prev) => ({ ...prev, requestedDelivery: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
                {editingQuote && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as QuoteStatus }))}
                      className={`w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                        QUOTE_STATUSES.find((s) => s.value === formData.status)?.color.replace('bg-', 'border-').split(' ')[0]
                      }`}
                    >
                      {QUOTE_STATUSES.map((status) => (
                        <option key={status.value} value={status.value} className="bg-slate-800">
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Line Items</h3>
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                {formData.lineItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No items added yet. Click "Add Item" to start.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.lineItems.map((item, index) => (
                      <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 grid grid-cols-6 gap-3">
                            {/* Item Type */}
                            <select
                              value={item.itemType}
                              onChange={(e) => updateLineItem(index, { itemType: e.target.value as LineItemType })}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                            >
                              {LINE_ITEM_TYPES.map((type) => (
                                <option key={type.value} value={type.value} className="bg-slate-800">
                                  {type.label}
                                </option>
                              ))}
                            </select>

                            {/* Product/Supplier (for PRODUCT type) */}
                            {item.itemType === 'PRODUCT' && (
                              <>
                                <select
                                  value={item.productId || ''}
                                  onChange={(e) => selectProduct(index, e.target.value)}
                                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                >
                                  <option value="">Select product...</option>
                                  {products.map((product) => (
                                    <option key={product.id} value={product.id} className="bg-slate-800">
                                      {product.name} ({product.sku})
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={item.supplierId || ''}
                                  onChange={(e) => updateLineItem(index, { supplierId: e.target.value || null })}
                                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                >
                                  <option value="">Vendor...</option>
                                  {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id} className="bg-slate-800">
                                      {supplier.name}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}

                            {/* Service Type (for SERVICE type) */}
                            {item.itemType === 'SERVICE' && (
                              <>
                                <select
                                  value={item.serviceType || ''}
                                  onChange={(e) => updateLineItem(index, { serviceType: e.target.value as FulfillmentMethod || null })}
                                  className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                >
                                  <option value="">Select service...</option>
                                  {SERVICE_TYPES.map((service) => (
                                    <option key={service.value} value={service.value} className="bg-slate-800">
                                      {service.label}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}

                            {/* Custom Item Name */}
                            {(item.itemType === 'CUSTOM' || item.itemType === 'SETUP_FEE' || item.itemType === 'SHIPPING' || item.itemType === 'DISCOUNT') && (
                              <input
                                type="text"
                                value={item.name || ''}
                                onChange={(e) => updateLineItem(index, { name: e.target.value })}
                                placeholder="Item name"
                                className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                              />
                            )}

                            {/* Quantity */}
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, { quantity: parseInt(e.target.value) || 1 })}
                              min="1"
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                              placeholder="Qty"
                            />

                            {/* Unit Price */}
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                                step="0.01"
                                min="0"
                                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                placeholder="Price"
                              />
                            </div>

                            {/* Line Total */}
                            <div className="flex items-center justify-end">
                              <span className="text-white font-semibold">{formatCurrency(item.total)}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => removeLineItem(index)}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Service Options (for screen print, etc.) */}
                        {item.itemType === 'SERVICE' && item.serviceType === 'SCREEN_PRINT' && (
                          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Colors</label>
                              <input
                                type="number"
                                value={item.serviceOptions?.colors || ''}
                                onChange={(e) => updateLineItem(index, {
                                  serviceOptions: { ...item.serviceOptions, colors: parseInt(e.target.value) || undefined }
                                })}
                                min="1"
                                max="12"
                                placeholder="# of colors"
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Locations</label>
                              <input
                                type="number"
                                value={item.serviceOptions?.locations || ''}
                                onChange={(e) => updateLineItem(index, {
                                  serviceOptions: { ...item.serviceOptions, locations: parseInt(e.target.value) || undefined }
                                })}
                                min="1"
                                placeholder="# of locations"
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-slate-500 mb-1">Notes</label>
                              <input
                                type="text"
                                value={item.serviceOptions?.notes || ''}
                                onChange={(e) => updateLineItem(index, {
                                  serviceOptions: { ...item.serviceOptions, notes: e.target.value || undefined }
                                })}
                                placeholder="e.g., Front chest, Back full"
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-slate-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* Description field */}
                        <div className="mt-3">
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => updateLineItem(index, { description: e.target.value })}
                            placeholder="Description (optional)"
                            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-slate-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Section */}
              <div className="grid grid-cols-2 gap-6">
                {/* Notes */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Customer Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      placeholder="Notes visible to customer..."
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Internal Notes</label>
                    <textarea
                      value={formData.internalNotes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, internalNotes: e.target.value }))}
                      rows={3}
                      placeholder="Internal notes (not visible to customer)..."
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 resize-none"
                    />
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Quote Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="text-white">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm flex-1">Discount</span>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
                      >
                        <option value="FIXED" className="bg-slate-800">$</option>
                        <option value="PERCENTAGE" className="bg-slate-800">%</option>
                      </select>
                      <input
                        type="number"
                        value={formData.discount}
                        onChange={(e) => setFormData((prev) => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.01"
                        className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-right"
                      />
                      <span className="text-red-400 text-sm w-20 text-right">-{formatCurrency(discountAmount)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm flex-1">Tax Rate</span>
                      <input
                        type="number"
                        value={formData.taxRate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.01"
                        className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-right"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                      <span className="text-white text-sm w-20 text-right">{formatCurrency(taxAmount)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm flex-1">Shipping</span>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                        <input
                          type="number"
                          value={formData.shipping}
                          onChange={(e) => setFormData((prev) => ({ ...prev, shipping: parseFloat(e.target.value) || 0 }))}
                          min="0"
                          step="0.01"
                          className="w-24 pl-6 pr-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-right"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex justify-between">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-xl font-bold text-cyan-400">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Trail Section - Only show when editing */}
              {editingQuote && (
                <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsAuditExpanded(!isAuditExpanded)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-white">Activity History</h3>
                      <span className="text-xs text-slate-500">
                        ({auditLogs.length} {auditLogs.length === 1 ? 'entry' : 'entries'})
                      </span>
                    </div>
                    {isAuditExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isAuditExpanded && (
                    <div className="border-t border-white/10 max-h-64 overflow-y-auto">
                      {isLoadingAuditLogs ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        </div>
                      ) : auditLogs.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                          <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                          <p>No activity history yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {auditLogs.map((log) => (
                            <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                              <div className="flex items-start gap-3">
                                {/* Actor Icon */}
                                <div className={`p-1.5 rounded-full shrink-0 ${
                                  log.actorType === 'ADMIN'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : log.actorType === 'CUSTOMER'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {log.actorType === 'ADMIN' ? (
                                    <User className="w-3.5 h-3.5" />
                                  ) : log.actorType === 'CUSTOMER' ? (
                                    <User className="w-3.5 h-3.5" />
                                  ) : (
                                    <Bot className="w-3.5 h-3.5" />
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white">{log.description}</p>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <span>
                                      {log.actorType === 'ADMIN' && log.actorName
                                        ? log.actorName
                                        : log.actorType === 'CUSTOMER'
                                        ? 'Customer'
                                        : 'System'}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      {new Date(log.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                      {' at '}
                                      {new Date(log.createdAt).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Badge */}
                                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                  log.action.includes('CREATED') ? 'bg-green-500/20 text-green-400' :
                                  log.action.includes('SENT') ? 'bg-purple-500/20 text-purple-400' :
                                  log.action.includes('APPROVED') ? 'bg-green-500/20 text-green-400' :
                                  log.action.includes('DECLINED') ? 'bg-red-500/20 text-red-400' :
                                  log.action.includes('STATUS') ? 'bg-blue-500/20 text-blue-400' :
                                  log.action.includes('PRICING') ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {log.action.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button onClick={closeModal} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
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
                {editingQuote ? 'Save Changes' : 'Create Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
