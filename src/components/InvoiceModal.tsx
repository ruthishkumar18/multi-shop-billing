import React, { useEffect, useState } from 'react';
import {
  Printer, MessageSquare, Send, X, PlusCircle, CheckCircle2,
  ArrowLeft, LayoutDashboard, QrCode, Check, Download, RefreshCw
} from 'lucide-react';
import QRCode from 'qrcode';
import { Bill, ShopProfile } from '../types';
import { exportInvoicePDF } from '../utils/reportExport';

interface InvoiceModalProps {
  bill: Bill;
  profile: ShopProfile;
  isOpen: boolean;
  onClose: () => void;
  onCreateNewBill?: () => void;
  onBackToDashboard?: () => void;
  onBackToHistory?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  bill,
  profile,
  isOpen,
  onClose,
  onCreateNewBill,
  onBackToDashboard,
  onBackToHistory
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);

  // Compute public invoice URL
  const publicInvoiceUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invoice/${encodeURIComponent(bill.bill_number)}`
    : `/invoice/${encodeURIComponent(bill.bill_number)}`;

  // Generate QR code for this specific bill
  useEffect(() => {
    if (bill && bill.bill_number) {
      QRCode.toDataURL(publicInvoiceUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Failed to generate invoice QR code:', err));
    }
  }, [bill, publicInvoiceUrl]);

  // Allow Esc key to go back cleanly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currency = profile.currency_symbol || '₹';

  // Format WhatsApp message text
  const formatWhatsAppText = () => {
    const itemLines = (bill.items || []).map(
      (it, idx) => `${idx + 1}. ${it.product_name} (${it.quantity} ${it.unit}) - ${currency}${Number(it.amount).toFixed(2)}`
    ).join('\n');

    const message = `🧾 *${profile.brand_name} - Tax Invoice*\n` +
      `Bill No: *${bill.bill_number}*\n` +
      `Date: ${new Date(bill.bill_date).toLocaleDateString()} ${new Date(bill.bill_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
      `Customer: ${bill.buyer_name} (${bill.buyer_mobile || 'N/A'})\n\n` +
      `*Purchased Items:*\n${itemLines}\n\n` +
      `Subtotal: ${currency}${Number(bill.subtotal).toFixed(2)}\n` +
      (bill.discount > 0 ? `Discount: -${currency}${Number(bill.discount).toFixed(2)}\n` : '') +
      `*Grand Total: ${currency}${Number(bill.grand_total).toFixed(2)}*\n` +
      `Payment Mode: ${bill.payment_mode}\n\n` +
      `📱 *View Digital Copy & PDF:* ${publicInvoiceUrl}\n\n` +
      `${profile.bill_footer || 'Thank you for your purchase!'}`;

    return encodeURIComponent(message);
  };

  // Format SMS message text
  const formatSmsText = () => {
    const message = `${profile.brand_name}: Bill ${bill.bill_number} for ${bill.buyer_name}. Total: ${currency}${Number(bill.grand_total).toFixed(2)}. Digital copy: ${publicInvoiceUrl}`;
    return encodeURIComponent(message);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsSavingPdf(true);
    try {
      const res = await exportInvoicePDF(bill, profile);
      if (res?.savedPath) {
        setSavedPdfPath(res.savedPath);
      }
    } catch (err) {
      console.error('Download PDF error:', err);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleOpenFile = async (path: string) => {
    try {
      await fetch('/api/export/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    } catch {
      // ignore
    }
  };

  const cleanPhone = (phone: string) => {
    return phone ? phone.replace(/[^\d+]/g, '') : '';
  };

  const buyerPhone = cleanPhone(bill.buyer_mobile);
  const waUrl = buyerPhone
    ? `https://api.whatsapp.com/send?phone=${buyerPhone}&text=${formatWhatsAppText()}`
    : `https://api.whatsapp.com/send?text=${formatWhatsAppText()}`;

  const smsUrl = buyerPhone
    ? `sms:${buyerPhone}?body=${formatSmsText()}`
    : `sms:?body=${formatSmsText()}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Prominent Action Bar with Clear Back Button */}
        <div className="no-print bg-slate-900 text-white p-3 sm:px-5 sm:py-3.5 border-b border-slate-800 space-y-2.5">
          {/* Top Row: Navigation & Meta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-all border border-slate-700 hover:border-slate-600 shadow-sm"
                title="Return to previous screen"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-400" />
                <span>Back</span>
              </button>

              {onBackToDashboard && (
                <button
                  onClick={() => {
                    onClose();
                    onBackToDashboard();
                  }}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-300 hover:text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                  title="Go directly to Dashboard"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-800/80 px-2 py-1 rounded">
                <span>{bill.bill_number}</span>
                {bill.status === 'void' && (
                  <span className="text-[10px] font-bold text-red-400 bg-red-950/80 border border-red-800 px-1 rounded">
                    VOID
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Actions Row: Touch-friendly & Cleanly Wrapped */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              title="Print Invoice / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isSavingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              title="Download standalone PDF document"
            >
              {isSavingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download PDF</span>
            </button>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              title="Share invoice on WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={() => {
                navigator.clipboard.writeText(publicInvoiceUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
              title="Copy customer public digital link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <QrCode className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="hidden xs:inline">{copiedLink ? 'Link Copied' : 'Digital Link'}</span>
            </button>

            {onCreateNewBill && (
              <button
                onClick={() => {
                  onClose();
                  onCreateNewBill();
                }}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                title="Create a new bill"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>New Bill</span>
              </button>
            )}
          </div>
        </div>

        {/* Saved PDF to Downloads Notification (Desktop App Support) */}
        {savedPdfPath && (
          <div className="no-print mx-3 sm:mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-emerald-950 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Invoice PDF saved to Downloads:</span>
                <p className="font-mono text-[11px] text-emerald-800 mt-0.5 break-all">{savedPdfPath}</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenFile(savedPdfPath)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shrink-0"
            >
              Open File
            </button>
          </div>
        )}

        {/* Printable Invoice Container */}
        <div id="printable-invoice" className="p-4 sm:p-6 md:p-8 bg-white text-slate-800 font-sans">
          {/* Header & Logo */}
          <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-4 pb-4 sm:pb-6 border-b border-slate-200">
            <div className="space-y-1 max-w-md">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {profile.brand_name}
              </h2>
              {profile.address && (
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                  {profile.address}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 pt-1">
                {profile.mobile && <span>Phone: {profile.mobile}</span>}
                {profile.email && <span>· Email: {profile.email}</span>}
              </div>
              {profile.bill_header && (
                <p className="text-xs italic text-slate-500 pt-1 border-t border-slate-100 mt-1">
                  {profile.bill_header}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
              {profile.logo_path ? (
                <img
                  src={profile.logo_path}
                  alt={profile.brand_name}
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-md border border-slate-200"
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold">
                  LOGO
                </div>
              )}
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Tax Invoice
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-slate-900 tabular-nums block">
                  {bill.bill_number}
                </span>
              </div>
            </div>
          </div>

          {/* Bill Meta & Buyer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 py-3 sm:py-4 text-xs border-b border-slate-200">
            <div>
              <span className="text-slate-400 font-medium uppercase tracking-wider block mb-0.5">
                Billed To:
              </span>
              <p className="font-semibold text-slate-900 text-sm">{bill.buyer_name}</p>
              {bill.buyer_mobile && (
                <p className="text-slate-600 font-mono mt-0.5">Mobile: {bill.buyer_mobile}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <div>
                <span className="text-slate-400">Invoice Date: </span>
                <span className="font-medium text-slate-900">
                  {new Date(bill.bill_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
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

          {/* Line Items Table with Responsive Scroll Wrapper */}
          <div className="py-3 sm:py-4 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <table className="w-full text-xs min-w-[460px] sm:min-w-full">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500 font-semibold uppercase tracking-wider text-left">
                  <th className="py-2 w-8">#</th>
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-right">Qty & Unit</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bill.items?.map((item, index) => (
                  <tr key={item.id || index} className="text-slate-800">
                    <td className="py-2 text-slate-400 font-mono">{index + 1}</td>
                    <td className="py-2 font-medium text-slate-900">{item.product_name}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                      {currency}{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {currency}{Number(item.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations & Totals with Scannable Digital QR Code */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Scannable Bill QR Code */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl w-full sm:w-auto">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`QR code for ${bill.bill_number}`}
                  className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  <QrCode className="w-8 h-8 text-slate-300" />
                </div>
              )}
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                  Scan for Digital Copy
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Instant mobile view & PDF digital receipt
                </p>
                <span className="text-[9px] font-mono text-emerald-700 block truncate max-w-[190px]">
                  {bill.bill_number}
                </span>
              </div>
            </div>

            {/* Calculations & Totals */}
            <div className="w-full sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono tabular-nums">{currency}{Number(bill.subtotal).toFixed(2)}</span>
              </div>

              {bill.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono tabular-nums">-{currency}{Number(bill.discount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-300">
                <span>Grand Total:</span>
                <span className="font-mono tabular-nums text-base">{currency}{Number(bill.grand_total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Footer */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-2">
            {profile.terms_conditions && (
              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Terms & Conditions:</span>
                <p className="whitespace-pre-line text-slate-500 leading-relaxed text-[11px]">
                  {profile.terms_conditions}
                </p>
              </div>
            )}

            {profile.bill_footer && (
              <p className="text-center font-medium text-slate-700 pt-2">
                {profile.bill_footer}
              </p>
            )}

            <div className="text-center text-[10px] text-slate-400 pt-1">
              Computer Generated Invoice • Authorized Signatory
            </div>
          </div>
        </div>

        {/* Modal Bottom Sticky Return Bar */}
        <div className="no-print bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Return to Previous Page</span>
          </button>

          <span className="text-[11px] text-slate-400 hidden xs:inline">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 font-mono">Esc</kbd> to exit preview
          </span>
        </div>
      </div>
    </div>
  );
};
