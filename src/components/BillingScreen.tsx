import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Trash2, ShoppingCart, ArrowRight,
  AlertCircle, Sparkles, RefreshCw, ArrowLeft, CheckCircle2, Eye,
  LayoutDashboard, Scale, Layers, ChevronDown, Check
} from 'lucide-react';
import { DatabaseService } from '../services/db';
import { Product, ShopProfile, Bill, BillItem } from '../types';
import { InvoiceModal } from './InvoiceModal';
import {
  STORE_CATEGORIES,
  WEIGHT_PRESETS,
  VOLUME_PRESETS,
  COUNT_PRESETS,
  getUnitCategory,
  getAlternateUnits,
  calculateDynamicAmount
} from '../utils/unitConverter';

interface BillingScreenProps {
  userId: number;
  profile: ShopProfile;
  onBillCreated?: () => void;
  onNavigateToDashboard?: () => void;
  setHasUnsavedChanges?: (unsaved: boolean) => void;
}

interface CartItem {
  id: string;
  product_id?: number | null;
  product_name: string;
  category?: string;
  quantity: number; // e.g. 345
  unit: string; // e.g. 'g'
  base_unit: string; // e.g. 'kg'
  unit_price: number; // base price e.g. 40.00 / kg
  amount: number; // calculated e.g. 13.80
  display_text: string; // e.g. '345 g @ ₹40.00/kg'
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  userId,
  profile,
  onBillCreated,
  onNavigateToDashboard,
  setHasUnsavedChanges
}) => {
  const currency = profile.currency_symbol || '₹';

  // Buyer Info
  const [buyerName, setBuyerName] = useState('');
  const [buyerMobile, setBuyerMobile] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Products from catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Line Item Entry inputs
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customItemName, setCustomItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Vegetables');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [selectedUnit, setSelectedUnit] = useState('g');
  const [itemPrice, setItemPrice] = useState<number | ''>(40);
  const [itemQty, setItemQty] = useState<number | ''>(250);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');

  // Feedback & Invoice Modal
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Load catalog products
  useEffect(() => {
    const list = DatabaseService.getProducts(userId);
    setProducts(list);
  }, [userId]);

  // Track unsaved changes
  useEffect(() => {
    const hasItems = cartItems.length > 0 || buyerName.trim().length > 0;
    if (setHasUnsavedChanges) {
      setHasUnsavedChanges(hasItems);
    }
  }, [cartItems, buyerName, setHasUnsavedChanges]);

  // Handle clicking outside of product search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products by search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  });

  // When a product is picked from catalog
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCustomItemName(product.name);
    setItemCategory(product.category || 'General');
    setBaseUnit(product.unit);
    setItemPrice(product.price_per_unit);

    // Smart default unit: if base is kg, default to g (grams) for convenient grocery entry
    const cat = getUnitCategory(product.unit);
    if (cat === 'weight') {
      setSelectedUnit('g');
      setItemQty(250); // Default to 250 grams
    } else if (cat === 'volume') {
      setSelectedUnit('ml');
      setItemQty(500); // Default to 500 ml
    } else {
      setSelectedUnit(product.unit);
      setItemQty(1); // Default to 1 piece
    }

    setIsDropdownOpen(false);
    setSearchQuery('');

    // Auto-focus quantity field for ultra-rapid counter entry
    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 50);
  };

  // Compute live calculation
  const currentQtyNum = typeof itemQty === 'number' ? itemQty : parseFloat(String(itemQty) || '0');
  const currentPriceNum = typeof itemPrice === 'number' ? itemPrice : parseFloat(String(itemPrice) || '0');

  const liveCalc = calculateDynamicAmount(
    currentQtyNum,
    selectedUnit,
    baseUnit,
    currentPriceNum,
    currency
  );

  const unitCategory = getUnitCategory(baseUnit);
  const alternateUnits = getAlternateUnits(baseUnit);

  const handleAddLineItem = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = selectedProduct ? selectedProduct.name : customItemName.trim();
    if (!name) {
      setErrorMsg('Please select a product or enter an item description.');
      return;
    }

    if (currentQtyNum <= 0) {
      setErrorMsg('Quantity / Weight must be greater than 0.');
      return;
    }
    if (currentPriceNum < 0) {
      setErrorMsg('Unit price cannot be negative.');
      return;
    }

    const newItem: CartItem = {
      id: Math.random().toString(36).substring(2, 9),
      product_id: selectedProduct?.id || null,
      product_name: name,
      category: itemCategory,
      quantity: currentQtyNum,
      unit: selectedUnit,
      base_unit: baseUnit,
      unit_price: currentPriceNum,
      amount: liveCalc.amount,
      display_text: liveCalc.formattedQty
    };

    setCartItems(prev => [...prev, newItem]);

    // Reset line entry for next item
    setSelectedProduct(null);
    setCustomItemName('');
    setItemQty(250);
    setSelectedUnit('g');
    setBaseUnit('kg');

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateItemQty = (id: string, newQty: number) => {
    if (newQty <= 0) return;
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const recalculated = calculateDynamicAmount(
          newQty,
          item.unit,
          item.base_unit,
          item.unit_price,
          currency
        );
        return {
          ...item,
          quantity: newQty,
          amount: recalculated.amount,
          display_text: recalculated.formattedQty
        };
      }
      return item;
    }));
  };

  // Monetary calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.amount, 0);

  let calculatedDiscount = 0;
  if (discountAmount && Number(discountAmount) > 0) {
    if (discountType === 'percent') {
      calculatedDiscount = (subtotal * Number(discountAmount)) / 100;
    } else {
      calculatedDiscount = Number(discountAmount);
    }
  }
  calculatedDiscount = Math.min(subtotal, Number(calculatedDiscount.toFixed(2)));
  const grandTotal = Math.max(0, Number((subtotal - calculatedDiscount).toFixed(2)));

  const handleSaveBill = () => {
    setErrorMsg(null);

    if (!buyerName.trim()) {
      setErrorMsg('Please enter customer/buyer name to generate invoice.');
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg('Please add at least one item to the invoice.');
      return;
    }

    setIsSaving(true);

    const result = DatabaseService.createBill(userId, {
      buyer_name: buyerName,
      buyer_mobile: buyerMobile,
      discount: calculatedDiscount,
      payment_mode: paymentMode,
      items: cartItems.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: it.amount
      }))
    });

    setIsSaving(false);

    if (result.success && result.bill) {
      setCompletedBill(result.bill);
      setLastSavedBill(result.bill);
      handleResetBill();
      if (onBillCreated) onBillCreated();
    } else {
      setErrorMsg(result.error || 'Failed to generate bill.');
    }
  };

  const handleResetBill = () => {
    setBuyerName('');
    setBuyerMobile('');
    setCartItems([]);
    setDiscountAmount('');
    setSelectedProduct(null);
    setCustomItemName('');
    setItemPrice(40);
    setItemQty(250);
    setSelectedUnit('g');
    setBaseUnit('kg');
    setCompletedBill(null);
    setErrorMsg(null);
    if (setHasUnsavedChanges) setHasUnsavedChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with prominent Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title="Return to Shop Dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Dashboard</span>
            </button>
          )}

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Counter Billing & POS
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              All-in-One: Grocery, Vegetables, Fruits, Stationery with automatic gram/kg pricing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cartItems.length > 0 && (
            <button
              onClick={handleResetBill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Cart</span>
            </button>
          )}

          <div className="px-3 py-1 bg-slate-100 rounded-md text-xs text-slate-700 font-mono font-semibold">
            {profile.brand_name}
          </div>
        </div>
      </div>

      {/* Success Notification if a bill was recently saved */}
      {lastSavedBill && !completedBill && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Bill #{lastSavedBill.bill_number} generated successfully!</span>
              <span className="text-emerald-700 ml-2">Total: {currency}{lastSavedBill.grand_total.toFixed(2)} ({lastSavedBill.buyer_name})</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCompletedBill(lastSavedBill)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View / Print Invoice</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Left is Item Selection & Line Entry, Right is Cart & Buyer Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Search & Line Items Cart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Entry Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>1. Select Item & Enter Quantity / Weight</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {products.length} products available
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {STORE_CATEGORIES.map(cat => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      if (cat.id !== 'all') {
                        setItemCategory(cat.id);
                        if (cat.id === 'Vegetables' || cat.id === 'Fruits' || cat.id === 'Grocery') {
                          setBaseUnit('kg');
                          setSelectedUnit('g');
                          setItemQty(250);
                        } else if (cat.id === 'Dairy') {
                          setBaseUnit('Litre');
                          setSelectedUnit('ml');
                          setItemQty(500);
                        } else {
                          setBaseUnit('Pieces');
                          setSelectedUnit('Pieces');
                          setItemQty(1);
                        }
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Search Input with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search catalogue by product name (e.g. Tomato, Rice, Pen)..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                />
              </div>

              {/* Suggestions Dropdown */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-30 divide-y divide-slate-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{p.name}</span>
                            {p.category && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {p.category}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Rate: {currency}{p.price_per_unit.toFixed(2)} per {p.unit}
                            {(p.unit === 'kg' || p.unit.toLowerCase().includes('kilo')) && ' · auto-converts grams (200g, 345g)'}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {currency}{p.price_per_unit.toFixed(2)} / {p.unit}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-500">
                      No matching products. You can enter item details below to bill a custom item.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Product Chips for rapid one-touch counter billing */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Quick Add:</span>
              {filteredProducts.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-md text-[11px] font-semibold transition-colors shrink-0 shadow-2xs"
                >
                  {p.name} ({currency}{p.price_per_unit}/{p.unit})
                </button>
              ))}
            </div>

            {/* Line Item Inputs Form */}
            <form onSubmit={handleAddLineItem} className="pt-3 border-t border-slate-200 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Item Name / Custom */}
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {selectedProduct ? 'Selected Item' : 'Item Description / Custom'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tomatoes, Apples, Basmati Rice, Pen"
                    value={selectedProduct ? selectedProduct.name : customItemName}
                    onChange={(e) => {
                      if (selectedProduct) setSelectedProduct(null);
                      setCustomItemName(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {/* Base Rate Price */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Rate ({currency} per {baseUnit})
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-mono font-bold text-slate-400">
                      {currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full pl-7 pr-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                {/* Quantity / Weight Input with Unit Switcher */}
                <div className="sm:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      {unitCategory === 'weight' ? 'Weight' : unitCategory === 'volume' ? 'Volume' : 'Quantity'}
                    </label>

                    {/* Unit Toggle Switches (e.g. g vs kg) */}
                    <div className="flex items-center gap-1">
                      {alternateUnits.map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            // If switching between kg and g, auto-convert the number in the input
                            if (selectedUnit === 'kg' && u === 'g' && typeof itemQty === 'number') {
                              setItemQty(Number((itemQty * 1000).toFixed(0)));
                            } else if (selectedUnit === 'g' && u === 'kg' && typeof itemQty === 'number') {
                              setItemQty(Number((itemQty / 1000).toFixed(3)));
                            } else if (selectedUnit === 'Litre' && u === 'ml' && typeof itemQty === 'number') {
                              setItemQty(Number((itemQty * 1000).toFixed(0)));
                            } else if (selectedUnit === 'ml' && u === 'Litre' && typeof itemQty === 'number') {
                              setItemQty(Number((itemQty / 1000).toFixed(3)));
                            }
                            setSelectedUnit(u);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            selectedUnit === u
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      ref={qtyInputRef}
                      type="number"
                      step={selectedUnit === 'g' || selectedUnit === 'ml' ? '1' : '0.001'}
                      min="0.001"
                      required
                      placeholder={selectedUnit === 'g' ? 'e.g. 200, 345, 500' : '1'}
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500 pointer-events-none">
                      {selectedUnit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Weight / Quantity Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">Presets:</span>
                {(unitCategory === 'weight' ? WEIGHT_PRESETS : unitCategory === 'volume' ? VOLUME_PRESETS : COUNT_PRESETS).map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setSelectedUnit(preset.unit);
                      setItemQty(preset.qty);
                    }}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      selectedUnit === preset.unit && itemQty === preset.qty
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Live Calculation Preview Banner */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Formula:</span>
                  <span className="font-mono text-slate-800 font-semibold">{liveCalc.calculationBreakdown}</span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs text-slate-500">Total:</span>
                  <span className="font-mono text-base font-bold text-emerald-700">
                    {currency}{liveCalc.amount.toFixed(2)}
                  </span>

                  <button
                    type="submit"
                    className="ml-2 inline-flex items-center gap-1 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Add to Bill</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Cart Items Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Billed Line Items ({cartItems.length})
                </span>
              </div>

              <span className="text-xs font-mono text-slate-600">
                Subtotal: <strong className="text-slate-900">{currency}{subtotal.toFixed(2)}</strong>
              </span>
            </div>

            {cartItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 w-8">#</th>
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-4 text-right">Weight / Qty</th>
                      <th className="py-2.5 px-4 text-right">Rate</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cartItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                          {item.category && (
                            <span className="text-[10px] text-slate-500 font-medium">{item.category}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="font-mono font-bold text-slate-900">{item.display_text}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                          {currency}{item.unit_price.toFixed(2)} / {item.base_unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {currency}{item.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 px-4 text-center text-slate-400 text-xs">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
                <p className="font-semibold text-slate-700">Cart is empty</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Select a product above or click quick presets to add items with automatic gram/kg calculations.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Customer Details & Checkout Summary */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
              2. Customer Details
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe, Cash Counter"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Customer Mobile Number (For Digital Receipt / WhatsApp)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={buyerMobile}
                onChange={(e) => setBuyerMobile(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Cash">Cash</option>
                <option value="UPI / QR Code">UPI / QR Code</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
                <option value="Store Credit / Udhar">Store Credit / Udhar</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Pricing & Checkout Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
              3. Invoice Summary
            </span>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Subtotal ({cartItems.length} items):</span>
                <span className="font-mono font-bold text-slate-900">{currency}{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount Input */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-slate-600 mb-1.5">
                  <span className="text-[11px] font-semibold">Discount:</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('flat')}
                      className={`px-1.5 py-0.5 rounded font-bold ${discountType === 'flat' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      Flat ({currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-1.5 py-0.5 rounded font-bold ${discountType === 'percent' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      % Percent
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {calculatedDiscount > 0 && (
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                      -{currency}{calculatedDiscount.toFixed(2)} deducted
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-3">
                <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                <span className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                  {currency}{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleSaveBill}
              disabled={isSaving || cartItems.length === 0}
              className="w-full mt-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Generating Bill...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Generate Tax Invoice ({currency}{grandTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Modal Preview */}
      {completedBill && (
        <InvoiceModal
          bill={completedBill}
          profile={profile}
          isOpen={!!completedBill}
          onClose={() => setCompletedBill(null)}
          onCreateNewBill={() => {
            setCompletedBill(null);
            handleResetBill();
          }}
          onBackToDashboard={onNavigateToDashboard}
        />
      )}
    </div>
  );
};
