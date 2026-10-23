/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Store, Users, PlusCircle, Package, History,
  Settings, LogOut, Menu, X, Database, Shield
} from 'lucide-react';
import { User, ShopProfile } from './types';
import { DatabaseService } from './services/db';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { BillingScreen } from './components/BillingScreen';
import { ProductManagement } from './components/ProductManagement';
import { BillingHistory } from './components/BillingHistory';
import { ShopProfile as ShopProfileComponent } from './components/ShopProfile';
import { AccountSettings } from './components/AccountSettings';
import { SetupGuideModal } from './components/SetupGuideModal';
import { PublicInvoiceView } from './components/PublicInvoiceView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ShopProfile | null>(null);

  // Automatically re-hydrate state from backend persistent storage across .exe launches
  useEffect(() => {
    DatabaseService.bootstrapFromBackend().catch(() => {});
  }, []);

  // Check for public digital invoice in URL (scanned via QR code or shared link)
  const [publicBillNumber, setPublicBillNumber] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/invoice/')) {
      return decodeURIComponent(path.replace('/invoice/', ''));
    }
    if (path.startsWith('/public/invoice/')) {
      return decodeURIComponent(path.replace('/public/invoice/', ''));
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('invoice') || params.get('bill') || null;
  });

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);

  const handleLoginSuccess = (user: User, profile?: ShopProfile) => {
    setCurrentUser(user);
    if (user.role === 'customer') {
      const p = profile || DatabaseService.getShopProfile(user.id);
      setCurrentProfile(p);
      setActiveTab('billing'); // Direct speed to billing for counter staff
    } else {
      setActiveTab('admin_customers');
    }
  };

  const handleLogout = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved items in your billing screen. Sign out anyway?')) {
        return;
      }
    }
    setCurrentUser(null);
    setCurrentProfile(null);
    setHasUnsavedChanges(false);
    setActiveTab('dashboard');
  };

  const handleTabChange = (newTab: string) => {
    if (hasUnsavedChanges && activeTab === 'billing' && newTab !== 'billing') {
      if (!confirm('You have items in your current bill. Leaving this screen will reset the cart. Continue?')) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    setActiveTab(newTab);
    setIsMobileMenuOpen(false);
  };

  // If customer is accessing public digital invoice via QR Code or link, render digital receipt directly
  if (publicBillNumber) {
    return (
      <PublicInvoiceView
        billNumber={publicBillNumber}
        onGoHome={() => {
          setPublicBillNumber(null);
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  // If not logged in, render Login Page (clean without extra technical details)
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 
        TOP BAR CONTRACT:
        Zone 1: Brand wordmark
        Zone 2: 4-5 single-line nav links
        Zone 3: Account info & Logout
      */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-8 h-16">
            {/* Zone 1: Brand Title */}
            <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
              <div className="p-2 bg-slate-900 text-white rounded-lg">
                {isAdmin ? <Shield className="w-4 h-4" /> : <Store className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-bold tracking-tight text-slate-900 text-sm sm:text-base">
                  {isAdmin ? 'Admin Console' : (currentProfile?.brand_name || currentUser.shop_name)}
                </span>
                {isAdmin && (
                  <span className="hidden sm:inline-block ml-2 text-xs text-slate-400">
                    System Manager
                  </span>
                )}
              </div>
            </div>

            {/* Zone 2: Navigation Links (Desktop) */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => handleTabChange('admin_customers')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'admin_customers' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Customer Accounts
                  </button>
                  <button
                    onClick={() => setIsSetupGuideOpen(true)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1"
                  >
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span>MySQL / schema.sql</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('account_settings')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'account_settings' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Admin Credentials
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleTabChange('dashboard')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => handleTabChange('billing')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${activeTab === 'billing' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Create Bill</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('products')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'products' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Products
                  </button>
                  <button
                    onClick={() => handleTabChange('history')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Billing History
                  </button>
                  <button
                    onClick={() => handleTabChange('profile')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'profile' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Shop Profile
                  </button>
                  <button
                    onClick={() => handleTabChange('account_settings')}
                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${activeTab === 'account_settings' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  >
                    Account
                  </button>
                </>
              )}
            </nav>

            {/* Zone 3: Account Profile & Logout */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 leading-none">
                  {currentUser.owner_name}
                </span>
                <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                  @{currentUser.username}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              {/* Mobile hamburger button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-600 hover:text-slate-900 focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {isAdmin ? (
              <>
                <button
                  onClick={() => handleTabChange('admin_customers')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Customer Accounts
                </button>
                <button
                  onClick={() => {
                    setIsSetupGuideOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  MySQL / schema.sql Setup
                </button>
                <button
                  onClick={() => handleTabChange('account_settings')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Admin Credentials
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleTabChange('dashboard')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleTabChange('billing')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Create Bill
                </button>
                <button
                  onClick={() => handleTabChange('products')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Products Catalogue
                </button>
                <button
                  onClick={() => handleTabChange('history')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Billing History
                </button>
                <button
                  onClick={() => handleTabChange('profile')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Shop Profile
                </button>
                <button
                  onClick={() => handleTabChange('account_settings')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Account Credentials
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAdmin ? (
          <>
            {activeTab === 'admin_customers' && (
              <AdminDashboard
                currentAdmin={currentUser}
                onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
              />
            )}
            {activeTab === 'account_settings' && (
              <AccountSettings
                currentUser={currentUser}
                onUserUpdated={(updated) => setCurrentUser(updated)}
              />
            )}
          </>
        ) : (
          <>
            {currentProfile && (
              <>
                {activeTab === 'dashboard' && (
                  <CustomerDashboard
                    userId={currentUser.id}
                    profile={currentProfile}
                    onNavigateToBilling={() => handleTabChange('billing')}
                    onNavigateToProducts={() => handleTabChange('products')}
                    onNavigateToHistory={() => handleTabChange('history')}
                  />
                )}

                {activeTab === 'billing' && (
                  <BillingScreen
                    userId={currentUser.id}
                    profile={currentProfile}
                    setHasUnsavedChanges={setHasUnsavedChanges}
                    onNavigateToDashboard={() => handleTabChange('dashboard')}
                  />
                )}

                {activeTab === 'products' && (
                  <ProductManagement
                    userId={currentUser.id}
                    profile={currentProfile}
                  />
                )}

                {activeTab === 'history' && (
                  <BillingHistory
                    userId={currentUser.id}
                    profile={currentProfile}
                  />
                )}

                {activeTab === 'profile' && (
                  <ShopProfileComponent
                    userId={currentUser.id}
                    initialProfile={currentProfile}
                    onProfileUpdated={(updated) => setCurrentProfile(updated)}
                  />
                )}

                {activeTab === 'account_settings' && (
                  <AccountSettings
                    currentUser={currentUser}
                    onUserUpdated={(updated) => setCurrentUser(updated)}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Database & Workbench Setup Modal */}
      <SetupGuideModal
        isOpen={isSetupGuideOpen}
        onClose={() => setIsSetupGuideOpen(false)}
      />
    </div>
  );
}
