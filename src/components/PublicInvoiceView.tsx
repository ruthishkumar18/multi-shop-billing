import React, { useEffect, useState } from 'react';
import {
  Printer, ArrowLeft, CheckCircle2, Store, Calendar,
  CreditCard, ShieldCheck, Download, Copy, Check, RefreshCw
} from 'lucide-react';
import { DatabaseService } from '../services/db';
import { Bill, ShopProfile } from '../types';
import { exportInvoicePDF } from '../utils/reportExport';

interface PublicInvoiceViewProps {
  billNumber: string;
  onGoHome?: () => void;
}

export const PublicInvoiceView: React.FC<PublicInvoiceViewProps> = ({
  billNumber,
  onGoHome
}) => {
  const [data, setData] = useState<{ bill: Bill; profile: ShopProfile } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  useEffect(() => {
    // 1. Try local database service
    const local = DatabaseService.getBillByNumber(billNumber);
    if (local) {
      setData(local);
      setLoading(false);
      return;
    }

    // 2. Fallback to API if running with backend
    fetch(`/api/public/invoice/${encodeURIComponent(billNumber)}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.bill && resData.profile) {
          setData(resData);
        }
      })
      .catch(err => console.warn('Could not fetch from backend API:', err))
      .finally(() => setLoading(false));
  }, [billNumber]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setIsSavingPdf(true);
    try {
      await exportInvoicePDF(data.bill, data.profile);
    } catch (err) {
      console.error('Invoice PDF download error:', err);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">Loading Digital Invoice...</p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">{billNumber}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Invoice Not Found</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            We could not locate invoice <span className="font-mono font-semibold text-slate-800">{billNumber}</span>. Please verify the QR code or link provided by your merchant.
          </p>
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="mt-6 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Go to Merchant Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  const { bill, profile } = data;
  const currency = profile.currency_symbol || '₹';

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-6 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
        {/* Navigation & Actions Top Bar */}
        <div className="no-print bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Portal</span>
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Receipt</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              title="Copy public link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isSavingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSavingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Digital Invoice Card */}
        <div id="printable-invoice" className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm">
          {/* Header */}
          <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-4 pb-4 sm:pb-6 border-b border-slate-200">
            <div className="space-y-1 max-w-sm">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {profile.brand_name}
              </h1>
              {profile.address && (
                <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">
                  {profile.address}
                </p>
              )}
              <div className="text-xs text-slate-500 pt-1">
                {profile.mobile && <span>Tel: {profile.mobile}</span>}
                {profile.email && <span> · {profile.email}</span>}
              </div>
            </div>

            <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between items-center sm:items-end">
              {profile.logo_path && (
                <img
                  src={profile.logo_path}
                  alt={profile.brand_name}
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-md border border-slate-200 sm:mb-2"
                />
              )}
              <div className="text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Digital Invoice
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-slate-900">
                  {bill.bill_number}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Bill Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-3 sm:py-4 text-xs border-b border-slate-200">
            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px] mb-0.5">
                Customer Details
              </span>
              <p className="font-semibold text-slate-900 text-sm">{bill.buyer_name}</p>
              {bill.buyer_mobile && (
                <p className="text-slate-600 font-mono mt-0.5">{bill.buyer_mobile}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <div>
                <span className="text-slate-400">Date: </span>
                <span className="font-medium text-slate-900">
                  {new Date(bill.bill_date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Time: </span>
                <span className="font-medium text-slate-900">
                  {new Date(bill.bill_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Payment: </span>
                <span className="font-medium text-slate-900">{bill.payment_mode}</span>
              </div>
            </div>
          </div>

          {/* Itemized List with Responsive Horizontal Scroll */}
          <div className="py-3 sm:py-4 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <table className="w-full text-xs min-w-[440px] sm:min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-left">
                  <th className="py-2 w-8">#</th>
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bill.items?.map((item, index) => (
                  <tr key={item.id || index} className="text-slate-800">
                    <td className="py-2.5 text-slate-400 font-mono text-[11px]">{index + 1}</td>
                    <td className="py-2.5 font-medium text-slate-900">{item.product_name}</td>
                    <td className="py-2.5 text-right font-mono text-slate-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-600">
                      {currency}{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-slate-900">
                      {currency}{Number(item.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <div className="w-full sm:w-60 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">{currency}{Number(bill.subtotal).toFixed(2)}</span>
              </div>

              {bill.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono">-{currency}{Number(bill.discount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono text-base">{currency}{Number(bill.grand_total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer & Terms */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-2">
            {profile.terms_conditions && (
              <div>
                <span className="font-semibold text-slate-700 block text-[11px] mb-0.5">Terms & Conditions:</span>
                <p className="text-slate-500 text-[11px] leading-relaxed whitespace-pre-line">
                  {profile.terms_conditions}
                </p>
              </div>
            )}

            {profile.bill_footer && (
              <p className="text-center font-medium text-slate-700 pt-3">
                {profile.bill_footer}
              </p>
            )}

            <div className="text-center text-[10px] text-slate-400 pt-2">
              Official Digital Tax Invoice • Generated by Multi-Shop Billing System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
