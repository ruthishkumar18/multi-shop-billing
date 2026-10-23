import React, { useState } from 'react';
import { Database, Copy, Check, X, Terminal, Server, FileCode, CheckCircle2 } from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quickstart' | 'schema' | 'flask' | 'env'>('quickstart');

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const schemaSnippet = `-- Multi-Shop Billing Management System Schema
CREATE DATABASE IF NOT EXISTS billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE billing_db;

-- Users (Admin & Customers)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Shop Profiles
CREATE TABLE shop_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  brand_name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  logo_path VARCHAR(255) NULL,
  address TEXT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  bill_header TEXT NULL,
  bill_footer TEXT NULL,
  terms_conditions TEXT NULL,
  currency_symbol VARCHAR(10) DEFAULT '₹',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Products Catalog
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100) NULL,
  unit VARCHAR(50) NOT NULL,
  price_per_unit DECIMAL(12, 2) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Invoices / Bills
CREATE TABLE bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  bill_number VARCHAR(60) NOT NULL UNIQUE,
  buyer_name VARCHAR(150) NOT NULL,
  buyer_mobile VARCHAR(20) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12, 2) NOT NULL,
  payment_mode VARCHAR(50) DEFAULT 'Cash',
  status ENUM('completed', 'void') NOT NULL DEFAULT 'completed',
  void_reason VARCHAR(255) NULL,
  bill_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Line Items
CREATE TABLE bill_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(200) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);`;

  const envSnippet = `# .env Configuration (Localhost with MySQL root and NO password)
SECRET_KEY=billing-system-production-secret-2026
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=billing_db
DB_PORT=3306
PORT=5000`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                MySQL Workbench & Flask Setup Guide
              </h2>
              <p className="text-[11px] text-slate-300">
                Localhost connection (user: root, no password, port: 3306)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'quickstart' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Setup Instructions
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'schema' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            schema.sql
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'env' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            .env Configuration
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto text-xs space-y-6">
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">1</span>
                  <span>Configure MySQL in MySQL Workbench</span>
                </div>
                <div className="pl-8 text-slate-600 space-y-1.5 leading-relaxed">
                  <p>1. Open <strong>MySQL Workbench</strong> on your computer.</p>
                  <p>2. Connect to your local MySQL server instance:</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700 font-mono text-[11px]">
                    <li>Hostname: <code>localhost</code> or <code>127.0.0.1</code></li>
                    <li>Port: <code>3306</code></li>
                    <li>Username: <code>root</code></li>
                    <li>Password: <em>(Leave empty / no password as specified)</em></li>
                  </ul>
                  <p>3. Click <strong>File &gt; Open SQL Script...</strong> and select <code>schema.sql</code> (or copy the script from the <strong>schema.sql</strong> tab above).</p>
                  <p>4. Click the <strong>Execute (Lightning Bolt)</strong> button to create the <code>billing_db</code> database, tables, and default admin account.</p>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] mt-2">
                    <strong>Note on Workbench Output:</strong> Warnings like <code>1051 Unknown table</code> on <code>DROP TABLE IF EXISTS</code> are completely normal when setting up a fresh database for the first time. The script continues and creates all tables and the admin account.
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">2</span>
                  <span>Install Dependencies & Start Application</span>
                </div>
                <div className="pl-8 space-y-3">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-1">Option A: Python Flask Backend</span>
                    <div className="relative bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px]">
                      <p className="text-slate-400"># 1. Install dependencies from requirements.txt</p>
                      <p className="text-emerald-400">pip install -r requirements.txt</p>
                      <p className="text-slate-400 mt-2"># 2. Run Flask local backend</p>
                      <p className="text-emerald-400">python app.py</p>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800 block mb-1">Option B: Vite & React Frontend Web Suite</span>
                    <div className="relative bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px]">
                      <p className="text-slate-400"># 1. Install node packages</p>
                      <p className="text-emerald-400">npm install</p>
                      <p className="text-slate-400 mt-2"># 2. Start dev server</p>
                      <p className="text-emerald-400">npm run dev</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">3</span>
                  <span>Default Logins (Already Initialized)</span>
                </div>
                <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900 block">Default Administrator</span>
                    <p className="font-mono text-slate-600 mt-1">Username: <strong>admin</strong></p>
                    <p className="font-mono text-slate-600">Password: <strong>Admin@2026</strong></p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900 block">Customer Shops</span>
                    <p className="text-slate-600 mt-1 text-[11px]">
                      Created securely by the Administrator from the Admin Console. No self-registration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  schema.sql (Full script is saved at project root: /schema.sql)
                </span>
                <button
                  onClick={() => handleCopy(schemaSnippet, "schema")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded text-xs hover:bg-slate-800"
                >
                  {copiedSection === "schema" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy SQL</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed max-h-96">
                {schemaSnippet}
              </pre>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  .env File for Local Python / MySQL (Saved at /.env.example)
                </span>
                <button
                  onClick={() => handleCopy(envSnippet, "env")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded text-xs hover:bg-slate-800"
                >
                  {copiedSection === "env" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy .env</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed">
                {envSnippet}
              </pre>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
