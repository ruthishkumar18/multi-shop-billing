import React, { useState } from 'react';
import { Upload, Check, AlertCircle, Building, Image as ImageIcon } from 'lucide-react';
import { DatabaseService } from '../services/db';
import { ShopProfile as ShopProfileType } from '../types';

interface ShopProfileProps {
  userId: number;
  initialProfile: ShopProfileType;
  onProfileUpdated: (updated: ShopProfileType) => void;
}

export const ShopProfile: React.FC<ShopProfileProps> = ({
  userId,
  initialProfile,
  onProfileUpdated
}) => {
  const [brandName, setBrandName] = useState(initialProfile.brand_name);
  const [ownerName, setOwnerName] = useState(initialProfile.owner_name);
  const [mobile, setMobile] = useState(initialProfile.mobile);
  const [email, setEmail] = useState(initialProfile.email || '');
  const [address, setAddress] = useState(initialProfile.address || '');
  const [billHeader, setBillHeader] = useState(initialProfile.bill_header || '');
  const [billFooter, setBillFooter] = useState(initialProfile.bill_footer || '');
  const [terms, setTerms] = useState(initialProfile.terms_conditions || '');
  const [currencySymbol, setCurrencySymbol] = useState(initialProfile.currency_symbol || '₹');
  const [logoPreview, setLogoPreview] = useState<string | undefined>(initialProfile.logo_path);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg('Logo file size must be less than 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!brandName.trim()) {
      setErrorMsg('Shop / Brand name cannot be empty.');
      return;
    }
    if (!mobile.trim()) {
      setErrorMsg('Contact mobile number is required.');
      return;
    }

    setIsSaving(true);

    const res = DatabaseService.updateShopProfile(userId, {
      brand_name: brandName.trim(),
      owner_name: ownerName.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      bill_header: billHeader.trim() || undefined,
      bill_footer: billFooter.trim() || undefined,
      terms_conditions: terms.trim() || undefined,
      currency_symbol: currencySymbol,
      logo_path: logoPreview
    });

    setIsSaving(false);

    if (res.success) {
      setFeedbackMsg('Shop profile and invoice branding saved to MySQL database successfully!');
      onProfileUpdated(res.profile);
      setTimeout(() => setFeedbackMsg(null), 3500);
    } else {
      setErrorMsg('Failed to update shop profile.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Shop Profile & Invoice Customization
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure shop branding, contact coordinates, invoice headers, and tax terms
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Synced with MySQL Database</span>
        </span>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Brand & Identity Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-500" />
            <span>1. Store Identity & Logo</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shop / Brand Name *
              </label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner / Contact Person *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Logo Upload & Preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Shop Logo (Appears on Invoices & Receipts)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Store Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                )}
              </div>

              <div className="space-y-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="block text-xs text-red-600 hover:underline"
                  >
                    Remove Logo
                  </button>
                )}
                <p className="text-[11px] text-slate-400">
                  PNG, JPG or WEBP under 4MB. Square aspect recommended.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Coordinates */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            2. Contact & Location Coordinates
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Phone / Mobile *
              </label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Store Physical Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop number, Street, Landmark, City - PIN"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Invoice Layout & Content */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            3. Bill Template & Currency Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency Symbol
              </label>
              <select
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="₹">₹ (INR - Rupee)</option>
                <option value="$">$ (USD - Dollar)</option>
                <option value="€">€ (EUR - Euro)</option>
                <option value="£">£ (GBP - Pound)</option>
                <option value="AED">AED (Dirham)</option>
                <option value="৳">৳ (BDT - Taka)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Bill Header Note / FSSAI / GST Number
              </label>
              <input
                type="text"
                value={billHeader}
                onChange={(e) => setBillHeader(e.target.value)}
                placeholder="e.g. FSSAI Lic. No: 12421008000456 or GSTIN: 33AAAAA0000A1Z5"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Bill Footer Message
            </label>
            <input
              type="text"
              value={billFooter}
              onChange={(e) => setBillFooter(e.target.value)}
              placeholder="e.g. Thank you for your purchase! Visit again."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Terms & Conditions (Printed on Invoice)
            </label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="1. Goods once sold cannot be returned without bill..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving Changes...' : 'Save Profile & Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
