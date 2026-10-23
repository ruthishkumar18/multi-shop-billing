import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Search, Key, Power, Check,
  AlertCircle, X, Shield, Database, Store, TrendingUp,
  Activity, DollarSign, FileText, CheckCircle2, Clock,
  Layers, BarChart3, ArrowUpRight, Cpu, QrCode, Download,
  Monitor, Smartphone, Archive, RefreshCw
} from 'lucide-react';
import { DatabaseService } from '../services/db';
import { User, Bill, AuditLog } from '../types';
import { AdminExportCenter } from './AdminExportCenter';

interface AdminDashboardProps {
  currentAdmin: User;
  onOpenSetupGuide: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentAdmin,
  onOpenSetupGuide
}) => {
  // Navigation tabs within Admin console
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'customers' | 'audit' | 'database'>('overview');
  const [isExportCenterOpen, setIsExportCenterOpen] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  // Password Reset Modal
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Feedback Messages & Database Status
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; storage?: string; host?: string; database?: string; tables?: Record<string, number>; message?: string } | null>(null);
  const [isSyncingDb, setIsSyncingDb] = useState(false);

  const checkStatus = async () => {
    const status = await DatabaseService.checkMySQLStatus();
    setDbStatus(status);
  };

  const handleSyncToMySQL = async () => {
    setIsSyncingDb(true);
    setErrorMsg(null);
    const res = await DatabaseService.syncAllToMySQL();
    setIsSyncingDb(false);
    if (res.success) {
      setFeedbackMsg(res.message || 'All shop profiles, products, and invoices synchronized to MySQL database tables successfully!');
      await checkStatus();
      loadData();
      setTimeout(() => setFeedbackMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Failed to sync with MySQL. Please ensure MySQL server is running on port 3306.');
    }
  };

  const loadData = () => {
    const customerList = DatabaseService.getUsers().filter(u => u.role === 'customer');
    setUsers(customerList);
    const bills = DatabaseService.getAllBills();
    setAllBills(bills);
    const logs = DatabaseService.getAuditLogs();
    setAuditLogs(logs);
  };

  useEffect(() => {
    loadData();
    checkStatus();
  }, []);

  // System Metrics
  const totalCustomers = users.length;
  const activeCustomers = users.filter(u => u.status === 'active').length;
  const inactiveCustomers = users.filter(u => u.status === 'inactive').length;

  const completedBills = allBills.filter(b => b.status === 'completed');
  const totalNetworkRevenue = completedBills.reduce((acc, b) => acc + b.grand_total, 0);
  const totalInvoicesCount = completedBills.length;
  const avgInvoiceValue = totalInvoicesCount > 0 ? totalNetworkRevenue / totalInvoicesCount : 0;

  // Filtered Users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.mobile.includes(searchQuery);

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return u.status === 'active';
    if (statusFilter === 'inactive') return u.status === 'inactive';
    return true;
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!shopName.trim() || !ownerName.trim() || !username.trim() || !password.trim() || !mobile.trim()) {
      setErrorMsg('Please fill in all required customer fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    const res = DatabaseService.createUser({
      shop_name: shopName,
      owner_name: ownerName,
      username,
      password,
      mobile,
      email: email.trim() || undefined
    });

    if (res.success) {
      setFeedbackMsg(`Shop account '${shopName}' provisioned successfully.`);
      setIsAddModalOpen(false);
      setShopName('');
      setOwnerName('');
      setUsername('');
      setPassword('');
      setMobile('');
      setEmail('');
      loadData();
      setActiveAdminTab('customers');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'Failed to create customer account.');
    }
  };

  const handleToggleStatus = (user: User) => {
    const action = user.status === 'active' ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} '${user.shop_name}'?`)) {
      const res = DatabaseService.toggleUserStatus(user.id);
      if (res.success) {
        setFeedbackMsg(`Account '${user.shop_name}' status updated to ${res.newStatus}.`);
        loadData();
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!resettingUser) return;

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    const res = DatabaseService.resetUserPassword(resettingUser.id, newPassword);
    if (res.success) {
      setFeedbackMsg(`Password for '${resettingUser.shop_name}' reset successfully.`);
      setResettingUser(null);
      setNewPassword('');
      loadData();
      setTimeout(() => setFeedbackMsg(null), 3000);
    } else {
      setErrorMsg(res.error || 'Failed to reset password.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Console Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 text-emerald-400">
              <Shield className="w-3 h-3" />
              <span>Platform Administration</span>
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${dbStatus?.connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
              <Database className="w-3 h-3 text-emerald-600" />
              <span>{dbStatus?.storage ? `${dbStatus.storage} (Active)` : (dbStatus?.connected ? `MySQL: ${dbStatus.database || 'billing_db'} (Active)` : 'Storage: Local Disk (Active)')}</span>
            </span>
            {dbStatus?.tables && dbStatus.tables.users !== undefined && dbStatus.tables.users >= 0 && (
              <span className="text-[11px] text-slate-500 font-mono">
                ({dbStatus.tables.users} users, {dbStatus.tables.shop_profiles} profiles in DB)
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Admin Management Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncToMySQL}
            disabled={isSyncingDb}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-xs disabled:opacity-60"
            title="Push all registered shops and details into MySQL database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingDb ? 'animate-spin' : ''}`} />
            <span>{isSyncingDb ? 'Syncing DB...' : 'Sync to MySQL'}</span>
          </button>

          <button
            onClick={() => setIsExportCenterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Mobile QR & Export (.ZIP / .EXE / .APK)</span>
          </button>

          <button
            onClick={onOpenSetupGuide}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-xs"
          >
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>schema.sql & Workbench</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Register New Shop</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveAdminTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${activeAdminTab === 'overview' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Dashboard & Analytics</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('customers')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${activeAdminTab === 'customers' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Registered Shops ({totalCustomers})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('audit')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${activeAdminTab === 'audit' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>System Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS DASHBOARD */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Registered Shops
                </span>
                <Store className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {totalCustomers}
                </span>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="text-emerald-700 font-medium font-mono">{activeCustomers} active</span>
                  <span>·</span>
                  <span className="text-slate-400 font-mono">{inactiveCustomers} inactive</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Network Volume
                </span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  ₹{totalNetworkRevenue.toFixed(2)}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Across all customer shops
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Invoices Processed
                </span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {totalInvoicesCount}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Live counter receipts issued
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Avg Ticket Size
                </span>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  ₹{avgInvoiceValue.toFixed(2)}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Average amount per bill
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & System Health Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Performance Breakdown & Recent Activity */}
            <div className="lg:col-span-2 space-y-6">
              {/* Registered Shops Overview Card */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Customer Accounts Status
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveAdminTab('customers')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                  >
                    View All Accounts →
                  </button>
                </div>

                {users.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {users.slice(0, 5).map(u => {
                      const userBills = allBills.filter(b => b.user_id === u.id && b.status === 'completed');
                      const userSales = userBills.reduce((acc, b) => acc + b.grand_total, 0);

                      return (
                        <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 text-sm">{u.shop_name}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                {u.status}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              Owner: {u.owner_name} · User: <span className="font-mono">{u.username}</span> · Mobile: {u.mobile}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 tabular-nums block text-sm">
                              ₹{userSales.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {userBills.length} invoices
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 px-4 text-center text-slate-400 text-xs">
                    <Store className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
                    <p className="font-medium text-slate-600">No customer shops registered yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click "Register New Shop" to create your first customer shop account.</p>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Register First Customer Shop</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Live Audit Log Teaser */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Recent System Events
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveAdminTab('audit')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                  >
                    View All Events →
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {auditLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="p-3.5 flex items-start gap-3 text-xs">
                      <div className="p-1.5 bg-slate-100 rounded text-slate-600 shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{log.action}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] truncate mt-0.5">{log.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: System Health & Technical Architecture */}
            <div className="space-y-6">
              {/* Architecture & Server Status */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-slate-500" />
                    <span>Database Status</span>
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Database Engine</span>
                    <span className="font-mono font-semibold text-slate-900">MySQL 8.0</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Host / Port</span>
                    <span className="font-mono font-semibold text-slate-900">localhost:3306</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Database Name</span>
                    <span className="font-mono font-semibold text-slate-900">billing_db</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">User / Password</span>
                    <span className="font-mono font-semibold text-slate-900">root (no password)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Password Hashing</span>
                    <span className="font-mono font-semibold text-emerald-700">Werkzeug Scrypt</span>
                  </div>
                </div>

                <button
                  onClick={onOpenSetupGuide}
                  className="w-full mt-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Inspect MySQL Schema</span>
                </button>
              </div>

              {/* Quick Actions Panel */}
              <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs space-y-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Administrator Actions
                </span>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full py-2.5 px-3 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>Create Customer Account</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => setActiveAdminTab('customers')}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Customer Password</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={onOpenSetupGuide}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>View / Copy schema.sql</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTERED CUSTOMERS DIRECTORY */}
      {activeAdminTab === 'customers' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by shop name, owner, username, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                All ({totalCustomers})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'active' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Active ({activeCustomers})
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'inactive' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Inactive ({inactiveCustomers})
              </button>
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Shop / Business Name</th>
                      <th className="py-3 px-4">Owner Name</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Account Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.shop_name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{u.owner_name}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-600">{u.username}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{u.mobile}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {u.status === 'active' ? (
                            <span className="text-emerald-700 font-semibold text-[11px]">
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setErrorMsg(null);
                                setNewPassword('');
                                setResettingUser(u);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              title="Reset Password"
                            >
                              <Key className="w-3 h-3" />
                              <span>Reset Password</span>
                            </button>

                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${u.status === 'active' ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                              title={u.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power className="w-3 h-3" />
                              <span>{u.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-3 stroke-1" />
                <p className="font-semibold text-slate-700 text-sm">No customer accounts exist yet.</p>
                <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                  Only the Administrator can create customer shop accounts. Click below to add a shop.
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-xs"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Provision New Customer Shop</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM AUDIT LOGS */}
      {activeAdminTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              System Audit Trail & Security Logs
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {auditLogs.length} logged events
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {auditLogs.map(log => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${log.type === 'account' ? 'bg-indigo-50 text-indigo-700' : log.type === 'bill' ? 'bg-emerald-50 text-emerald-700' : log.type === 'auth' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">{log.action}</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">{log.details}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 text-[11px] block font-mono">
                    Actor: {log.actor}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Register New Customer Shop Account
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="m-4 mb-0 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shop / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Retail Traders"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Owner Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. metro_traders"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
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
                    placeholder="e.g. store@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-1">
                Note: Customers cannot register themselves. Only the administrator can provision accounts.
              </p>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Reset Password: {resettingUser.shop_name}
              </h3>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="m-4 mb-0 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Provide a new password for username: <span className="font-mono font-bold text-slate-900">{resettingUser.username}</span>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export & Deployment Modal */}
      <AdminExportCenter
        isOpen={isExportCenterOpen}
        onClose={() => setIsExportCenterOpen(false)}
      />
    </div>
  );
};
