import React, { useState, useEffect } from 'react';
import {
  PlusCircle, Eye, Printer, MessageSquare,
  Package, TrendingUp, Calendar, ShoppingBag
} from 'lucide-react';
import { DatabaseService } from '../services/db';
import { Bill, ShopProfile } from '../types';
import { InvoiceModal } from './InvoiceModal';

interface CustomerDashboardProps {
  userId: number;
  profile: ShopProfile;
  onNavigateToBilling: () => void;
  onNavigateToProducts: () => void;
  onNavigateToHistory: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  userId,
  profile,
  onNavigateToBilling,
  onNavigateToProducts,
  onNavigateToHistory
}) => {
  const currency = profile.currency_symbol || '₹';
  const [bills, setBills] = useState<Bill[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  useEffect(() => {
    const userBills = DatabaseService.getBills(userId);
    setBills(userBills);
    const products = DatabaseService.getProducts(userId);
    setTotalProducts(products.length);
  }, [userId]);

  // Metrics
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

  const recentBills = bills.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {profile.brand_name} Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Store Owner: <span className="text-slate-800 font-medium">{profile.owner_name}</span> · {profile.mobile}
          </p>
        </div>

        <button
          onClick={onNavigateToBilling}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Create New Bill</span>
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Sales
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {currency}{todaySales.toFixed(2)}
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Across {todayBills.length} counter transactions
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Bills
            </span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {todayBills.length}
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Completed invoices today
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              This Month's Revenue
            </span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {currency}{monthSales.toFixed(2)}
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {monthBills.length} total monthly orders
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Catalogue
            </span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalProducts}
            </span>
            <button
              onClick={onNavigateToProducts}
              className="text-[11px] text-slate-700 hover:text-slate-900 hover:underline block mt-0.5 font-medium"
            >
              Manage item prices →
            </button>
          </div>
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Recent Invoices
          </span>
          <button
            onClick={onNavigateToHistory}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
          >
            View Full History →
          </button>
        </div>

        {recentBills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[550px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Bill No</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBills.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.bill_number}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(b.bill_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{b.buyer_name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{b.buyer_mobile || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                      {currency}{b.grand_total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'completed' ? (
                        <span className="text-emerald-700 font-semibold text-[11px]">Completed</span>
                      ) : (
                        <span className="text-red-700 font-semibold text-[11px]">Void</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setViewingBill(b)}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors text-[11px]"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-6 text-center text-slate-400 text-xs">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
            <p className="font-semibold text-slate-700 text-sm">No bills generated yet</p>
            <p className="text-slate-500 text-[11px] mt-1 max-w-sm mx-auto">
              Ready to start counter billing? You can add items to your catalogue or enter custom items directly on the billing screen.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={onNavigateToBilling}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Create First Bill</span>
              </button>
              <button
                onClick={onNavigateToProducts}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-medium text-xs"
              >
                <span>Add Products</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {viewingBill && (
        <InvoiceModal
          bill={viewingBill}
          profile={profile}
          isOpen={true}
          onClose={() => setViewingBill(null)}
        />
      )}
    </div>
  );
};
