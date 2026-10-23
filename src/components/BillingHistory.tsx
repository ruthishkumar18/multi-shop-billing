import React, { useState, useEffect } from 'react';
import {
  Search, Eye, Printer, MessageSquare, Ban,
  FileText, Calendar, Download, FileSpreadsheet, X, Check,
  BarChart3, CreditCard, ChevronRight
} from 'lucide-react';
import { DatabaseService } from '../services/db';
import { Bill, ShopProfile } from '../types';
import { InvoiceModal } from './InvoiceModal';
import {
  exportMonthlySalesCSV,
  exportMonthlySalesPDF,
  computeMonthlyMetrics
} from '../utils/reportExport';

interface BillingHistoryProps {
  userId: number;
  profile: ShopProfile;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BillingHistory: React.FC<BillingHistoryProps> = ({ userId, profile }) => {
  const currency = profile.currency_symbol || '₹';
  const [bills, setBills] = useState<Bill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState('');

  // Selected Bill for Viewing / Printing
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  // Void Modal State
  const [voidingBill, setVoidingBill] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Monthly Report Export Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState(new Date().getMonth());
  const [selectedReportYear, setSelectedReportYear] = useState(new Date().getFullYear());
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadBills = () => {
    const list = DatabaseService.getBills(userId);
    setBills(list);
  };

  useEffect(() => {
    loadBills();
  }, [userId]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await exportMonthlySalesCSV({
        monthName: MONTH_NAMES[selectedReportMonth],
        monthIndex: selectedReportMonth,
        year: selectedReportYear,
        profile,
        bills
      });
      if (res?.savedPath) {
        setSavedFilePath(res.savedPath);
        setExportNotice(`Report saved to Downloads: ${res.savedPath}`);
      } else {
        setExportNotice(`Monthly sales CSV (${res.filename}) downloaded.`);
      }
    } catch (err) {
      console.error('Export CSV error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const res = await exportMonthlySalesPDF({
        monthName: MONTH_NAMES[selectedReportMonth],
        monthIndex: selectedReportMonth,
        year: selectedReportYear,
        profile,
        bills
      });
      if (res?.savedPath) {
        setSavedFilePath(res.savedPath);
        setExportNotice(`Report saved to Downloads: ${res.savedPath}`);
      } else {
        setExportNotice(`Monthly sales PDF (${res.filename}) downloaded.`);
      }
    } catch (err) {
      console.error('Export PDF error:', err);
    } finally {
      setIsExporting(false);
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

  // Metrics calculation
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const activeBills = bills.filter(b => b.status === 'completed');

  const todayBills = activeBills.filter(b => b.bill_date.startsWith(todayStr));
  const todaySales = todayBills.reduce((acc, b) => acc + b.grand_total, 0);

  const monthBills = activeBills.filter(b => {
    const d = new Date(b.bill_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthSales = monthBills.reduce((acc, b) => acc + b.grand_total, 0);

  // Filter bills
  const filteredBills = bills.filter(b => {
    // Search query
    const matchesSearch =
      b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.buyer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.buyer_mobile.includes(searchQuery);

    if (!matchesSearch) return false;

    // Date filter
    if (dateFilter === 'today') {
      return b.bill_date.startsWith(todayStr);
    } else if (dateFilter === 'month') {
      const d = new Date(b.bill_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    } else if (dateFilter === 'custom' && customDate) {
      return b.bill_date.startsWith(customDate);
    }
    return true;
  });

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingBill) return;

    DatabaseService.voidBill(userId, voidingBill.id, voidReason);
    setVoidingBill(null);
    setVoidReason('');
    loadBills();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Billing History & Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logs, reprinting, WhatsApp delivery & void transaction management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Monthly Sales Reports (CSV / PDF)</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Today's Sales
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {currency}{todaySales.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">
              ({todayBills.length} bills)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            This Month's Sales
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {currency}{monthSales.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">
              ({monthBills.length} bills)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            All-Time Volume
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {currency}{activeBills.reduce((acc, b) => acc + b.grand_total, 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">
              ({activeBills.length} bills total)
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Bill #, buyer name, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${dateFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${dateFilter === 'today' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${dateFilter === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            This Month
          </button>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter('custom');
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredBills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Bill No</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Buyer Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(bill.bill_date).toLocaleDateString()} {new Date(bill.bill_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{bill.buyer_name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {bill.buyer_mobile || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {bill.items?.length || 1}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                      {currency}{bill.grand_total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      {bill.status === 'completed' ? (
                        <span className="text-emerald-700 font-semibold text-[11px]">
                          Completed
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold text-[11px]" title={bill.void_reason}>
                          Void
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingBill(bill)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title="View / Print Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {bill.status === 'completed' && (
                          <button
                            onClick={() => {
                              setVoidingBill(bill);
                              setVoidReason('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Void / Cancel Bill"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
            <p>No billing records found matching criteria.</p>
          </div>
        )}
      </div>

      {/* Invoice Modal for View / Print / WhatsApp / SMS */}
      {viewingBill && (
        <InvoiceModal
          bill={viewingBill}
          profile={profile}
          isOpen={true}
          onClose={() => setViewingBill(null)}
        />
      )}

      {/* Void Modal */}
      {voidingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-900">
                Cancel & Void Bill #{voidingBill.bill_number}
              </h3>
            </div>
            <form onSubmit={handleConfirmVoid} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Voiding this bill preserves the financial audit trail while marking the transaction as cancelled in your revenue metrics.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer returned items, Billing entry error"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidingBill(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monthly Sales Report Export Modal */}
      {isReportModalOpen && (() => {
        const reportMetrics = computeMonthlyMetrics(bills, selectedReportMonth, selectedReportYear);
        const availableYears = Array.from(new Set([new Date().getFullYear(), ...bills.map(b => new Date(b.bill_date).getFullYear())])).sort((a, b) => b - a);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-4 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300">
                      <BarChart3 className="w-3 h-3" />
                      <span>Financial Reporting & Analytics</span>
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-300 font-mono">{profile.brand_name}</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    Download Monthly Sales Report
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                    Export audit-compliant monthly sales reports in formatted CSV and PDF formats
                  </p>
                </div>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
                {/* File Saved To Downloads Notification (Desktop Mode) */}
                {savedFilePath && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-emerald-950 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">File saved to Downloads folder:</span>
                        <p className="font-mono text-[11px] text-emerald-800 mt-0.5 break-all">{savedFilePath}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenFile(savedFilePath)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                      >
                        Open File Now
                      </button>
                    </div>
                  </div>
                )}

                {/* Month & Year Selection Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block">Select Report Month & Year</span>
                      <span className="text-[11px] text-slate-500">Pick any billing period to compile sales analytics</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={selectedReportMonth}
                      onChange={(e) => setSelectedReportMonth(Number(e.target.value))}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx}>{name}</option>
                      ))}
                    </select>

                    <select
                      value={selectedReportYear}
                      onChange={(e) => setSelectedReportYear(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Period Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Net Realized Sales
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums block mt-0.5">
                      {currency}{reportMetrics.totalNetSales.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {reportMetrics.completedBills.length} paid invoice(s)
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Total Invoices
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums block mt-0.5">
                      {reportMetrics.monthlyBills.length}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {reportMetrics.voidBills.length > 0 ? `${reportMetrics.voidBills.length} voided` : '0 voided'}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Total Discounts
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums block mt-0.5">
                      {currency}{reportMetrics.totalDiscount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Gross: {currency}{reportMetrics.totalGross.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Avg Invoice Value
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums block mt-0.5">
                      {currency}{reportMetrics.avgBillValue.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500">per completed bill</span>
                  </div>
                </div>

                {/* Payment Methods Split */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <span>Payment Methods Split ({MONTH_NAMES[selectedReportMonth]} {selectedReportYear})</span>
                  </h4>
                  {Object.keys(reportMetrics.paymentBreakdown).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {Object.entries(reportMetrics.paymentBreakdown).map(([mode, info]) => {
                        const pct = reportMetrics.totalNetSales > 0 ? ((info.amount / reportMetrics.totalNetSales) * 100).toFixed(1) : '0';
                        return (
                          <div key={mode} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{mode}</span>
                              <span className="font-mono font-bold text-slate-900">{currency}{info.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                              <span>{info.count} bill(s)</span>
                              <span>{pct}% of sales</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No completed transactions recorded for this period.</p>
                  )}
                </div>

                {/* Export Format Action Cards */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Select Download Format
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* CSV Card */}
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-300 transition-colors">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>CSV SPREADSHEET</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">.csv format</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">Formatted Monthly CSV File</h5>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          Includes store header, executive metrics summary, payment methods breakdown, and complete line-item billing register with customer details.
                        </p>
                      </div>

                      <button
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                      >
                        {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>Download CSV Report ({MONTH_NAMES[selectedReportMonth]} {selectedReportYear})</span>
                      </button>
                    </div>

                    {/* PDF Card */}
                    <div className="border border-red-200 bg-red-50/40 rounded-xl p-4 flex flex-col justify-between hover:border-red-300 transition-colors">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                            <span>PDF DOCUMENT</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">.pdf format</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">Official Monthly PDF Report</h5>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          Clean A4 printable PDF document with store header branding, KPI summary blocks, payment table, and itemized audit records ready for tax filing.
                        </p>
                      </div>

                      <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                      >
                        {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-red-400" />}
                        <span>Download PDF Report ({MONTH_NAMES[selectedReportMonth]} {selectedReportYear})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Month Invoices Preview */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span className="font-semibold text-slate-800">
                      Invoices Included in Report: {reportMetrics.monthlyBills.length}
                    </span>
                    <span className="font-mono text-slate-500">
                      Total Volume: {currency}{reportMetrics.totalNetSales.toFixed(2)}
                    </span>
                  </div>

                  {reportMetrics.monthlyBills.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-[11px]">
                      {reportMetrics.monthlyBills.slice(0, 5).map(b => (
                        <div key={b.id} className="p-2 flex items-center justify-between bg-white hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">{b.bill_number}</span>
                            <span className="text-slate-500">· {b.buyer_name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-mono">{b.payment_mode || 'Cash'}</span>
                            <span className="font-mono font-bold text-slate-900">{currency}{b.grand_total.toFixed(2)}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {b.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {reportMetrics.monthlyBills.length > 5 && (
                        <div className="p-2 text-center text-slate-500 bg-slate-50 text-[11px]">
                          ... and {reportMetrics.monthlyBills.length - 5} more invoices included in exported report
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                      No invoices recorded for {MONTH_NAMES[selectedReportMonth]} {selectedReportYear}.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Reports include all historical records from local and database storage.
                </span>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
