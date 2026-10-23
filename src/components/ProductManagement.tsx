import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Package, Check,
  AlertCircle, Sparkles, RefreshCw, Filter, Layers
} from 'lucide-react';
import { DatabaseService } from '../services/db';
import { Product, ShopProfile } from '../types';
import { STORE_CATEGORIES, STANDARD_UNITS } from '../utils/unitConverter';

interface ProductManagementProps {
  userId: number;
  profile: ShopProfile;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({ userId, profile }) => {
  const currency = profile.currency_symbol || '₹';
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('kg');
  const [customUnit, setCustomUnit] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadProducts = () => {
    const list = DatabaseService.getProducts(userId);
    setProducts(list);
  };

  useEffect(() => {
    loadProducts();
  }, [userId]);

  const openAddModal = (defaultCat: string = 'Vegetables') => {
    setEditingProduct(null);
    setName('');
    setCategory(defaultCat === 'all' ? 'Vegetables' : defaultCat);
    setSku('');
    setUnit(defaultCat === 'Vegetables' || defaultCat === 'Fruits' || defaultCat === 'Grocery' ? 'kg' : 'Pieces');
    setCustomUnit('');
    setPrice('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category || 'General');
    setSku(product.sku || '');
    if ((STANDARD_UNITS as readonly string[]).includes(product.unit)) {
      setUnit(product.unit);
      setCustomUnit('');
    } else {
      setUnit('Custom');
      setCustomUnit(product.unit);
    }
    setPrice(product.price_per_unit);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    const priceNum = typeof price === 'number' ? price : parseFloat(String(price) || '0');
    if (priceNum < 0) {
      setErrorMsg('Price cannot be negative.');
      return;
    }

    const finalUnit = unit === 'Custom' ? (customUnit.trim() || 'Unit') : unit;

    if (editingProduct) {
      const res = DatabaseService.updateProduct(userId, editingProduct.id, {
        name: name.trim(),
        category,
        sku: sku.trim() || undefined,
        unit: finalUnit,
        price_per_unit: priceNum
      });
      if (res.success) {
        setFeedbackMsg(`Product '${name}' updated successfully.`);
        setIsModalOpen(false);
        loadProducts();
      } else {
        setErrorMsg(res.error || 'Failed to update product.');
      }
    } else {
      const res = DatabaseService.addProduct(userId, {
        name: name.trim(),
        category,
        sku: sku.trim() || undefined,
        unit: finalUnit,
        price_per_unit: priceNum
      });
      if (res.success) {
        setFeedbackMsg(`Product '${name}' added to catalog.`);
        setIsModalOpen(false);
        loadProducts();
      } else {
        setErrorMsg(res.error || 'Failed to add product.');
      }
    }

    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleDeleteProduct = (product: Product) => {
    if (confirm(`Are you sure you want to remove '${product.name}' from active catalog?`)) {
      DatabaseService.deleteProduct(userId, product.id);
      setFeedbackMsg(`Product '${product.name}' removed.`);
      loadProducts();
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  const handleSeedAllInOne = () => {
    DatabaseService.seedAllInOneCatalog(userId);
    loadProducts();
    setFeedbackMsg('Sample catalog for Vegetables, Fruits, Grocery, Stationery & Dairy loaded successfully!');
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  });

  const getCategoryBadgeClass = (cat?: string) => {
    switch (cat) {
      case 'Vegetables': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Fruits': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Grocery': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Stationery': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Dairy': return 'bg-sky-50 text-sky-700 border-sky-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Products & Pricing Catalogue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage inventory units (kg, grams, litres, pieces) for Grocery, Vegetables, Fruits & Stationery
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedAllInOne}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
            title="Load sample items for Grocery, Veg, Fruits & Stationery"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load All-in-One Catalog</span>
          </button>

          <button
            onClick={() => openAddModal(selectedCategory)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Category Filter Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
        {STORE_CATEGORIES.map(cat => {
          const count = cat.id === 'all'
            ? products.length
            : products.filter(p => p.category === cat.id).length;
          const isActive = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search catalogue by product name, SKU or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredProducts.length} of {products.length} items
        </span>
      </div>

      {/* Products Table with Responsive Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Base Unit</th>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4 text-right">Rate / Price</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{p.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getCategoryBadgeClass(p.category)}`}>
                        {p.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <span className="font-semibold text-slate-800">{p.unit}</span>
                      {(p.unit === 'kg' || p.unit.toLowerCase().includes('kilo')) && (
                        <span className="text-[10px] text-emerald-600 ml-1.5 block sm:inline">(Auto-calc grams)</span>
                      )}
                      {(p.unit === 'Litre' || p.unit === 'L') && (
                        <span className="text-[10px] text-blue-600 ml-1.5 block sm:inline">(Auto-calc ml)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {p.sku || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                      {currency}{p.price_per_unit.toFixed(2)} / {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title="Edit Unit / Price"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 text-center text-slate-400 text-xs">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
            <p className="font-semibold text-slate-700 text-sm">No products found in this category</p>
            <p className="text-slate-500 text-[11px] mt-1">
              Add individual products or click below to load pre-configured Grocery, Veg & Stationery items.
            </p>
            <button
              onClick={handleSeedAllInOne}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Load All-in-One Catalog</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingProduct ? 'Edit Product & Unit Pricing' : 'Add New Product to Store'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Store Category
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setCategory(newCat);
                    if (newCat === 'Vegetables' || newCat === 'Fruits' || newCat === 'Grocery') {
                      setUnit('kg');
                    } else if (newCat === 'Dairy') {
                      setUnit('Litre');
                    } else if (newCat === 'Stationery') {
                      setUnit('Pieces');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Vegetables">🥬 Vegetables (Weight: kg / grams)</option>
                  <option value="Fruits">🍎 Fruits (Weight: kg / grams / Dozen)</option>
                  <option value="Grocery">🌾 Grocery & Provisions (kg / grams / Packets)</option>
                  <option value="Stationery">✏️ Stationery & Office (Pieces / Packets / Boxes)</option>
                  <option value="Dairy">🥛 Dairy & Drinks (Litre / ml / Packets)</option>
                  <option value="General">🏷️ General / Other items</option>
                </select>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Tomatoes, Basmati Rice, Blue Gel Pen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Base Unit Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Pricing Unit *
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="kg">Kilograms (kg) — Supports automatic grams (200g, 345g)</option>
                  <option value="g">Grams (g)</option>
                  <option value="Pieces">Pieces (pcs) — For stationery, packaged items</option>
                  <option value="Packets">Packets (pkt)</option>
                  <option value="Boxes">Boxes</option>
                  <option value="Litre">Litre (L) — Supports automatic ml (250ml, 500ml)</option>
                  <option value="ml">Millilitres (ml)</option>
                  <option value="Dozen">Dozen (12 pcs)</option>
                  <option value="Metres">Metres (m)</option>
                  <option value="Custom">Custom Unit...</option>
                </select>
                {unit === 'Custom' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom unit (e.g. Bunches, Roll)"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  {unit === 'kg' && 'Customers can purchase in exact grams (e.g. 200g, 345g). Price will auto-calculate.'}
                  {unit === 'Litre' && 'Customers can purchase in exact ml (e.g. 250ml, 500ml). Price will auto-calculate.'}
                  {unit === 'Dozen' && 'Supports buying individual pieces from a dozen rate.'}
                </p>
              </div>

              {/* Price per Unit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Price per {unit === 'Custom' ? (customUnit || 'Unit') : unit} ({currency}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SKU / Barcode Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VEG-001, STA-PEN-02"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  {editingProduct ? 'Save Changes' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
