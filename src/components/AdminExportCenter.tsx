import React, { useState, useEffect, useRef } from 'react';
import {
  Download, QrCode, Monitor, Smartphone, Archive,
  Copy, Check, ExternalLink, ShieldAlert, Sparkles, RefreshCw, X, Globe
} from 'lucide-react';
import QRCode from 'qrcode';
import JSZip from 'jszip';

interface AdminExportCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminExportCenter: React.FC<AdminExportCenterProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'zip' | 'exe' | 'apk' | 'qr' | 'live'>('qr');
  const [qrUrl, setQrUrl] = useState<string>(window.location.origin);
  const [lanUrl, setLanUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isZipping, setIsZipping] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);

  // Fetch host LAN IP for mobile & tablet Wi-Fi sharing
  useEffect(() => {
    fetch('/api/network/info')
      .then(res => res.json())
      .then(data => {
        if (data?.lan_url) {
          setLanUrl(data.lan_url);
        }
      })
      .catch(() => {});
  }, []);

  // Generate QR Code dynamically
  useEffect(() => {
    QRCode.toDataURL(qrUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Failed to generate QR code:', err));
  }, [qrUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'billing-system-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 1-Click Complete Project .ZIP Generator
  const handleDownloadProjectZip = async () => {
    setIsZipping(true);
    setZipSuccess(false);

    try {
      const zip = new JSZip();

      // Files to fetch and bundle into the zip
      const rootFiles = [
        'schema.sql',
        'app.py',
        'run.py',
        'run_app.bat',
        'build.py',
        'requirements.txt',
        'package.json',
        '.env.example',
        'README.md',
        'HOSTING_AND_FREE_LIVE_GUIDE.md',
        'start_public_live_tunnel.bat',
        'vite.config.ts',
        'tsconfig.json',
        'index.html',
        'desktop_launcher.py',
        'build_desktop_exe.bat',
        'capacitor.config.json',
        'build_android_apk.bat'
      ];

      for (const filename of rootFiles) {
        try {
          const res = await fetch('/' + filename);
          if (res.ok) {
            const content = await res.text();
            zip.file(filename, content);
          }
        } catch (e) {
          console.warn(`Could not fetch ${filename}, skipping.`, e);
        }
      }

      // Add 1-Port Unified Launcher script inside the zip
      const runSinglePortBat = `@echo off\r\ntitle Multi-Shop Billing System - Single Port 5000\r\ncolor 0A\r\necho ======================================================================\r\necho    MULTI-SHOP BILLING MANAGEMENT SYSTEM (SINGLE-PORT UNIFIED MODE)\r\necho ======================================================================\r\necho.\r\necho [1/2] Checking Python & MySQL dependencies...\r\npip install -r requirements.txt --quiet\r\necho.\r\necho [2/2] Starting Flask Backend & Frontend on Single Port 5000...\r\necho Application is ready at http://localhost:5000\r\necho.\r\nstart http://localhost:5000\r\npython app.py\r\npause\r\n`;

      zip.file('run_app.bat', runSinglePortBat);

      // Generate zip blob
      const blob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'multi-shop-billing-management-system.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to create zip archive:', err);
      alert('Failed to bundle zip archive. Please try again.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Export & Universal Deployment Center
              </h2>
              <p className="text-[11px] text-slate-300">
                Package project (.zip), Desktop executable (.exe), Android APK, & Live Mobile QR Code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'qr' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Mobile UI & Backend QR</span>
          </button>

          <button
            onClick={() => setActiveTab('zip')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'zip' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <Archive className="w-4 h-4 text-indigo-600" />
            <span>Download .ZIP</span>
          </button>

          <button
            onClick={() => setActiveTab('exe')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'exe' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>Desktop (.EXE)</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'apk' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <Smartphone className="w-4 h-4 text-amber-600" />
            <span>Android (.APK)</span>
          </button>

          <button
            onClick={() => setActiveTab('live')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'live' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>🌐 Go Live Free (PC Storage)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 max-h-[75vh] overflow-y-auto text-xs space-y-6">
          {/* TAB 1: QR CODE */}
          {activeTab === 'qr' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* QR Canvas / Image */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="System Access QR Code"
                      className="w-56 h-56 rounded-xl bg-white p-2 shadow-sm border border-slate-200"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl">
                      <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                  )}

                  <button
                    onClick={handleDownloadQrPng}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR Code (PNG)</span>
                  </button>
                </div>

                {/* Info & URL Controller */}
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live UI & Backend Connected
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Scan to Open Billing System on Mobile
                    </h3>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                      Scan this QR code using any smartphone, iPhone, or POS tablet camera on your store network to immediately launch the billing interface connected to the backend.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Target Access URL in QR Code:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={qrUrl}
                        onChange={(e) => setQrUrl(e.target.value)}
                        placeholder="http://192.168.1.100:3000"
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                        title="Copy link"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                      <span>Quick presets:</span>
                      <button
                        type="button"
                        onClick={() => setQrUrl(window.location.origin)}
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        Current Origin
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setQrUrl('http://localhost:3000')}
                        className="text-slate-700 font-semibold hover:underline"
                      >
                        localhost:3000
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setQrUrl('http://localhost:5000')}
                        className="text-slate-700 font-semibold hover:underline"
                      >
                        localhost:5000
                      </button>
                      {lanUrl && (
                        <>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => setQrUrl(lanUrl)}
                            className="text-blue-700 font-bold hover:underline"
                            title="Share with Phones & Tablets on the same Wi-Fi"
                          >
                            📱 Wi-Fi Share ({lanUrl})
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOWNLOAD ZIP */}
          {activeTab === 'zip' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-indigo-600" />
                  <span>Download Complete Project Archive (.ZIP)</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Downloads all source files, schemas, backend logic, and scripts into a single clean zip archive ready to extract on any computer.
                </p>

                <div className="pt-3 flex flex-wrap gap-2.5">
                  <a
                    href="/MultiShopBilling_Portable.zip"
                    download="MultiShopBilling_Portable.zip"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4 text-white" />
                    <span>Download Pre-Compiled Package (.ZIP) — Recommended</span>
                  </a>

                  <a
                    href="/dist.zip"
                    download="dist.zip"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4 text-white" />
                    <span>Download Frontend dist.zip Only</span>
                  </a>

                  <button
                    onClick={handleDownloadProjectZip}
                    disabled={isZipping}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isZipping ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                        <span>Bundling Source Code...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-slate-600" />
                        <span>Download Source Code Only (.ZIP)</span>
                      </>
                    )}
                  </button>
                </div>

                {zipSuccess && (
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 pt-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Project zip package generated and downloaded successfully!</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-800">Included in the ZIP Package:</span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                  <li className="p-2 bg-white border border-slate-200 rounded">📄 schema.sql (MySQL Database)</li>
                  <li className="p-2 bg-white border border-slate-200 rounded">🐍 app.py (Flask Backend)</li>
                  <li className="p-2 bg-white border border-slate-200 rounded">📦 package.json & requirements.txt</li>
                  <li className="p-2 bg-white border border-slate-200 rounded">🖥️ desktop_launcher.py (.exe builder)</li>
                  <li className="p-2 bg-white border border-slate-200 rounded">🚀 run_app.bat & run.py (1-Port Launcher)</li>
                  <li className="p-2 bg-white border border-slate-200 rounded">🌐 Single Port (Frontend & Backend on 5000)</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: DESKTOP EXE */}
          {activeTab === 'exe' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <span>Build Standalone Desktop Application (.EXE)</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Compile the entire billing application into a single standalone Windows executable (<code>MultiShopBilling.exe</code>) that runs on any Windows 10 or 11 system without requiring Node or external dependencies.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-800">1-Step Automated Windows Build:</span>
                <p className="text-slate-600 text-[11px]">
                  Run the included compiler batch script inside your project folder:
                </p>
                <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] space-y-1">
                  <p className="text-slate-400"># Option 1: Universal Builder script (build.py):</p>
                  <p className="text-emerald-400">python build.py --exe</p>
                  <p className="text-slate-400 mt-2"># Option 2: 1-Click Windows batch script:</p>
                  <p className="text-emerald-400">build_desktop_exe.bat</p>
                  <p className="text-slate-400 mt-2"># Option 3: Direct PyInstaller:</p>
                  <p className="text-emerald-400">pip install pyinstaller pywebview</p>
                  <p className="text-emerald-400">pyinstaller --onefile --windowed --name="MultiShopBilling" desktop_launcher.py</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Output: <code>dist\MultiShopBilling\MultiShopBilling.exe</code> — you can copy this executable to any computer to launch the billing app in native window mode.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: ANDROID APK */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <span>Build Android Application (.APK) & POS Terminal</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Package the billing management interface into an Android APK package (<code>app-debug.apk</code>) to install on handheld Android billing devices, tablets, and mobile phones.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-800">1-Step Automated Android Build:</span>
                <p className="text-slate-600 text-[11px]">
                  Run the included Android builder script inside your project folder:
                </p>
                <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] space-y-1">
                  <p className="text-slate-400"># Run in project directory with Android SDK / Android Studio:</p>
                  <p className="text-emerald-400">build_android_apk.bat</p>
                  <p className="text-slate-400 mt-2"># Manual commands:</p>
                  <p className="text-emerald-400">npm run build</p>
                  <p className="text-emerald-400">npx cap add android && npx cap sync</p>
                  <p className="text-emerald-400">cd android && gradlew.bat assembleDebug</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Output APK: <code>android\app\build\outputs\apk\debug\app-debug.apk</code> — install directly using <code>adb install</code> or send the APK file via WhatsApp/Drive to any Android device.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: GO LIVE 100% FREE (PC STORAGE) */}
          {activeTab === 'live' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <Globe className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Host Live Website 100% Free Using Your Local PC Storage
                  </h3>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  You do not need to pay for cloud databases or hosting fees! You can run the billing system and MySQL database directly on your own PC, and use a secure free tunnel (Cloudflare Tunnel or ngrok) to generate a public HTTPS link accessible by anyone in the world.
                </p>
              </div>

              {/* Architecture Diagram Box */}
              <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-1.5 leading-relaxed">
                <p className="text-emerald-400 font-bold"># Live System Architecture (100% Free + Local PC Storage):</p>
                <p className="text-slate-300">Customers (Mobile Phones / Web) ──▶ Public HTTPS URL (trycloudflare.com)</p>
                <p className="text-slate-300">                                       │ (Encrypted Tunnel)</p>
                <p className="text-slate-300">                                       ▼</p>
                <p className="text-emerald-300">                              Your Local PC (localhost:5000)</p>
                <p className="text-amber-300">                                       ▼</p>
                <p className="text-amber-200">                     Local PC Hard Drive Storage (MySQL billing_db)</p>
              </div>

              {/* 3 Simple Steps */}
              <div className="space-y-3">
                <span className="font-semibold text-slate-800">Quick 3-Step Setup:</span>

                <div className="space-y-2">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900 block text-xs">Step 1: Start your billing system</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">Double-click <code>run_app.bat</code> to start Flask on Port 5000.</p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900 block text-xs">Step 2: Start the Free Public Tunnel</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">Double-click <code>start_public_live_tunnel.bat</code> or run in terminal:</p>
                    <div className="mt-1.5 p-2 bg-slate-900 text-emerald-400 rounded font-mono text-[11px]">
                      cloudflared tunnel --url http://localhost:5000
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900 block text-xs">Step 3: Share your Live HTTPS URL</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Cloudflare generates a secure URL like <code>https://your-store.trycloudflare.com</code>. Paste that into the QR Code tab above to generate a scannable mobile QR code for your live store!
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1">
                  📄 Full detailed documentation with custom domain setup is available in <code>HOSTING_AND_FREE_LIVE_GUIDE.md</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
