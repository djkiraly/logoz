'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  X,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

type FulfillmentMethod =
  | 'EMBROIDERY'
  | 'SCREEN_PRINT'
  | 'DTG'
  | 'VINYL'
  | 'SUBLIMATION'
  | 'LASER'
  | 'PROMO';

type Category = {
  id: string;
  slug: string;
  title: string;
};

type Supplier = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  heroImageUrl: string | null;
  gallery: string[];
  basePrice: string | number;
  minQuantity: number;
  categoryId: string;
  supplierId: string | null;
  fulfillment: FulfillmentMethod[];
  visible: boolean;
  featured: boolean;
  category?: Category;
  supplier?: Supplier | null;
  createdAt: string;
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

type ProductFormData = {
  sku: string;
  name: string;
  description: string;
  heroImageUrl: string | null;
  gallery: string[];
  basePrice: string;
  minQuantity: number;
  categoryId: string;
  supplierId: string | null;
  fulfillment: FulfillmentMethod[];
  visible: boolean;
  featured: boolean;
};

const emptyProduct: ProductFormData = {
  sku: '',
  name: '',
  description: '',
  heroImageUrl: null,
  gallery: [],
  basePrice: '0',
  minQuantity: 1,
  categoryId: '',
  supplierId: null,
  fulfillment: [],
  visible: false,
  featured: false,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyProduct);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes, suppliersRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/categories'),
        fetch('/api/admin/vendors'),
      ]);

      const [productsData, categoriesData, suppliersData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
        suppliersRes.json(),
      ]);

      if (productsData.ok) setProducts(productsData.data);
      if (categoriesData.ok) setCategories(categoriesData.data);
      if (suppliersData.ok) setSuppliers(suppliersData.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(emptyProduct);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description,
      heroImageUrl: product.heroImageUrl,
      gallery: product.gallery || [],
      basePrice: String(product.basePrice),
      minQuantity: product.minQuantity,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      fulfillment: product.fulfillment,
      visible: product.visible,
      featured: product.featured,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(emptyProduct);
  };

  const handleImageUpload = async (file: File, isGallery: boolean = false) => {
    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('folder', 'products');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (isGallery) {
        setFormData((prev) => ({
          ...prev,
          gallery: [...prev.gallery, data.data.url],
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          heroImageUrl: data.data.url,
        }));
      }

      setMessage({ type: 'success', text: 'Image uploaded successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isGallery: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file, isGallery);
    }
    e.target.value = '';
  };

  const removeGalleryImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!formData.sku.trim() || !formData.name.trim() || !formData.categoryId) {
      setMessage({ type: 'error', text: 'SKU, name, and category are required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        basePrice: parseFloat(formData.basePrice) || 0,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      setMessage({
        type: 'success',
        text: editingProduct ? 'Product updated successfully!' : 'Product created successfully!',
      });
      closeModal();
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save product',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete product');
      }

      setMessage({ type: 'success', text: 'Product deleted successfully!' });
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete product',
      });
    }
  };

  const toggleVisibility = async (product: Product) => {
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !product.visible }),
      });

      if (!response.ok) {
        throw new Error('Failed to update visibility');
      }

      setMessage({
        type: 'success',
        text: product.visible ? 'Product hidden from storefront' : 'Product now visible on storefront',
      });
      fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update visibility',
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseInt(value, 10)) : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleFulfillmentToggle = (method: FulfillmentMethod) => {
    setFormData((prev) => ({
      ...prev,
      fulfillment: prev.fulfillment.includes(method)
        ? prev.fulfillment.filter((m) => m !== method)
        : [...prev.fulfillment, method],
    }));
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(num) ? '0.00' : num.toFixed(2);
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
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-slate-400 mt-1">
            Manage your product catalog. Products marked as visible will appear on your storefront.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
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

      {/* Products List */}
      {products.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
          <p className="text-slate-400 mb-4">No products yet. Add your first product to get started.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Product</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">SKU</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Category</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Price</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {product.heroImageUrl ? (
                        <img
                          src={product.heroImageUrl}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover bg-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{product.name}</span>
                          {product.featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300 font-mono text-sm">{product.sku}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300">{product.category?.title || '-'}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-300">${formatPrice(product.basePrice)}</span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleVisibility(product)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        product.visible
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'
                      }`}
                    >
                      {product.visible ? (
                        <>
                          <Eye className="w-3 h-3" />
                          Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          Hidden
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit product"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === product.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(product.id)}
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
                          onClick={() => setDeleteConfirm(product.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete product"
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
            <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-lg font-semibold text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
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
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="e.g., APP-ELITE-TEE"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="e.g., Elite Performance Tee"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  placeholder="Product description..."
                />
              </div>

              {/* Hero Image */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Hero Image
                </label>
                <div className="flex items-start gap-4">
                  {formData.heroImageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.heroImageUrl}
                        alt="Hero preview"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => setFormData((prev) => ({ ...prev, heroImageUrl: null }))}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-white/5 border border-white/10 border-dashed flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, false)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Upload Image
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                      Or enter URL directly:
                    </p>
                    <input
                      type="url"
                      value={formData.heroImageUrl || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, heroImageUrl: e.target.value || null }))
                      }
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Gallery */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Gallery Images
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.gallery.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Gallery ${index + 1}`}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => removeGalleryImage(index)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, true)}
                    className="hidden"
                  />
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 border-dashed flex flex-col items-center justify-center text-slate-500 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span className="text-xs mt-1">Add</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Price & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Base Price ($)
                  </label>
                  <input
                    type="number"
                    name="basePrice"
                    value={formData.basePrice}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    name="minQuantity"
                    value={formData.minQuantity}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Category & Supplier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Category *
                  </label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-slate-800">
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Supplier
                  </label>
                  <select
                    name="supplierId"
                    value={formData.supplierId || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        supplierId: e.target.value || null,
                      }))
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id} className="bg-slate-800">
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fulfillment Methods */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Fulfillment Methods
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FULFILLMENT_METHODS.map((method) => (
                    <label
                      key={method.value}
                      className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.fulfillment.includes(method.value)}
                        onChange={() => handleFulfillmentToggle(method.value)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                      <span className="text-sm text-slate-300">{method.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Visibility & Featured */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="visible"
                    checked={formData.visible}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-300">Visible on Storefront</span>
                    <p className="text-xs text-slate-500">
                      Show this product on the homepage
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-300">Featured Product</span>
                    <p className="text-xs text-slate-500">
                      Highlight this product prominently
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 sticky bottom-0 bg-slate-900">
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
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
