import { User, ShopProfile, Product, Bill, BillItem, AuditLog } from '../types';
import { SAMPLE_ALL_IN_ONE_CATALOG } from '../utils/unitConverter';

const STORAGE_KEY_PREFIX = 'billing_app_v2_';

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage`, e);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage`, e);
  }
}

// Helper for seamless backend MySQL synchronization
export async function sendToBackend<T>(endpoint: string, method: string = 'POST', data?: any): Promise<T | null> {
  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    // If backend is offline, application functions gracefully on local cache
    return null;
  }
}

// Initial Data: ONLY Admin Account (Zero Dummy Customer Data)
const INITIAL_USERS: User[] = [
  {
    id: 1,
    shop_name: 'System Administration',
    owner_name: 'Master Administrator',
    username: 'admin',
    password_hash: 'Admin@2026',
    role: 'admin',
    mobile: '9876543210',
    email: 'admin@billingsystem.local',
    status: 'active',
    created_at: new Date().toISOString()
  }
];

const INITIAL_PROFILES: ShopProfile[] = [];
const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_BILLS: Bill[] = [];

const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    action: 'System Initialized',
    details: 'Database structure initialized with Master Administrator account.',
    actor: 'System',
    timestamp: new Date().toISOString(),
    type: 'system'
  }
];

export class DatabaseService {
  // Authentication
  static login(username: string, password: string): { user: User; profile?: ShopProfile } | { error: string } {
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
      return { error: 'Invalid username or password.' };
    }

    if (user.password_hash !== password) {
      return { error: 'Invalid username or password.' };
    }

    if (user.status !== 'active') {
      return { error: 'Your account has been deactivated. Please contact the administrator.' };
    }

    let profile: ShopProfile | undefined;
    if (user.role === 'customer') {
      profile = this.getShopProfile(user.id);
    }

    this.addAuditLog('User Login', `User '${user.username}' signed into ${user.role} console`, user.username, 'auth');

    return { user, profile };
  }

  // Users
  static getUsers(): User[] {
    return getStored<User[]>('users', INITIAL_USERS);
  }

  static createUser(data: {
    shop_name: string;
    owner_name: string;
    username: string;
    password: string;
    mobile: string;
    email?: string;
  }): { success: boolean; error?: string; user?: User } {
    const users = this.getUsers();
    const existing = users.find(u => u.username.toLowerCase() === data.username.trim().toLowerCase());
    if (existing) {
      return { success: false, error: 'Username is already taken. Please choose another.' };
    }

    const nextId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser: User = {
      id: nextId,
      shop_name: data.shop_name.trim(),
      owner_name: data.owner_name.trim(),
      username: data.username.trim(),
      password_hash: data.password,
      role: 'customer',
      mobile: data.mobile.trim(),
      email: data.email?.trim() || undefined,
      status: 'active',
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    setStored('users', users);

    // Create default profile
    const profiles = getStored<ShopProfile[]>('profiles', INITIAL_PROFILES);
    const newProfile: ShopProfile = {
      id: profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1,
      user_id: nextId,
      brand_name: data.shop_name.trim(),
      owner_name: data.owner_name.trim(),
      mobile: data.mobile.trim(),
      email: data.email?.trim() || undefined,
      bill_header: `Welcome to ${data.shop_name.trim()}`,
      bill_footer: 'Thank you for shopping with us! Visit again.',
      terms_conditions: 'Goods once sold cannot be returned after 7 days without bill receipt.',
      currency_symbol: '₹'
    };
    profiles.push(newProfile);
    setStored('profiles', profiles);

    this.addAuditLog('Customer Registered', `Created shop account for '${data.shop_name}' (username: ${data.username})`, 'admin', 'account');

    // Asynchronously commit directly to MySQL database
    sendToBackend('/api/users', 'POST', {
      shop_name: data.shop_name.trim(),
      owner_name: data.owner_name.trim(),
      username: data.username.trim(),
      password: data.password,
      mobile: data.mobile.trim(),
      email: data.email?.trim() || null
    });
    this.autoPersist();

    return { success: true, user: newUser };
  }

  static toggleUserStatus(userId: number): { success: boolean; newStatus?: 'active' | 'inactive'; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };
    if (user.role === 'admin') return { success: false, error: 'Cannot deactivate admin account' };

    user.status = user.status === 'active' ? 'inactive' : 'active';
    setStored('users', users);

    this.addAuditLog('Account Status Changed', `Shop '${user.shop_name}' set to ${user.status}`, 'admin', 'account');

    // Asynchronously commit status change to MySQL database
    sendToBackend(`/api/users/${userId}/toggle-status`, 'POST');
    this.autoPersist();

    return { success: true, newStatus: user.status };
  }

  static resetUserPassword(userId: number, newPassword: string): { success: boolean; error?: string } {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    user.password_hash = newPassword;
    setStored('users', users);

    this.addAuditLog('Password Reset', `Password reset for shop username '${user.username}'`, 'admin', 'account');

    // Asynchronously commit password change to MySQL database
    sendToBackend(`/api/users/${userId}/reset-password`, 'POST', { password: newPassword });
    this.autoPersist();

    return { success: true };
  }

  static updateCredentials(userId: number, currentPassword: string, newUsername?: string, newPassword?: string): { success: boolean; error?: string; updatedUser?: User } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    if (user.password_hash !== currentPassword) {
      return { success: false, error: 'Current password does not match.' };
    }

    if (newUsername && newUsername.trim() !== user.username) {
      const existing = users.find(u => u.username.toLowerCase() === newUsername.trim().toLowerCase() && u.id !== userId);
      if (existing) {
        return { success: false, error: 'New username is already taken by another account.' };
      }
      user.username = newUsername.trim();
    }

    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return { success: false, error: 'New password must be at least 6 characters.' };
      }
      user.password_hash = newPassword.trim();
      sendToBackend(`/api/users/${userId}/reset-password`, 'POST', { password: newPassword.trim() });
    }

    setStored('users', users);
    this.addAuditLog('Credentials Updated', `Credentials updated for user '${user.username}'`, user.username, 'account');
    this.autoPersist();

    return { success: true, updatedUser: user };
  }

  // Shop Profiles
  static getShopProfile(userId: number): ShopProfile {
    const profiles = getStored<ShopProfile[]>('profiles', INITIAL_PROFILES);
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) return profile;

    // Create a fallback profile if missing
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    const newProfile: ShopProfile = {
      id: profiles.length + 1,
      user_id: userId,
      brand_name: user?.shop_name || 'My Store',
      owner_name: user?.owner_name || 'Store Owner',
      mobile: user?.mobile || '',
      email: user?.email || '',
      bill_header: 'Welcome to our store',
      bill_footer: 'Thank you for your purchase!',
      terms_conditions: 'Goods once sold cannot be returned without bill.',
      currency_symbol: '₹'
    };
    profiles.push(newProfile);
    setStored('profiles', profiles);
    return newProfile;
  }

  static updateShopProfile(userId: number, updates: Partial<ShopProfile>): { success: boolean; profile: ShopProfile } {
    const profiles = getStored<ShopProfile[]>('profiles', INITIAL_PROFILES);
    const index = profiles.findIndex(p => p.user_id === userId);
    let profile: ShopProfile;

    if (index >= 0) {
      profiles[index] = { ...profiles[index], ...updates, updated_at: new Date().toISOString() };
      profile = profiles[index];
    } else {
      profile = {
        id: profiles.length + 1,
        user_id: userId,
        brand_name: updates.brand_name || 'Store',
        owner_name: updates.owner_name || 'Owner',
        mobile: updates.mobile || '',
        currency_symbol: updates.currency_symbol || '₹',
        ...updates,
        updated_at: new Date().toISOString()
      };
      profiles.push(profile);
    }
    setStored('profiles', profiles);

    // Sync users shop_name and owner_name
    if (updates.brand_name || updates.owner_name) {
      const users = this.getUsers();
      const user = users.find(u => u.id === userId);
      if (user) {
        if (updates.brand_name) user.shop_name = updates.brand_name;
        if (updates.owner_name) user.owner_name = updates.owner_name;
        setStored('users', users);
      }
    }

    // Crucial: Persist shop profile directly to MySQL database
    sendToBackend(`/api/shop-profile/${userId}`, 'POST', {
      brand_name: profile.brand_name,
      owner_name: profile.owner_name,
      mobile: profile.mobile,
      email: profile.email || null,
      address: profile.address || null,
      bill_header: profile.bill_header || null,
      bill_footer: profile.bill_footer || null,
      terms_conditions: profile.terms_conditions || null,
      currency_symbol: profile.currency_symbol || '₹',
      logo_path: profile.logo_path || null
    });
    this.autoPersist();

    return { success: true, profile };
  }

  // Products
  static getProducts(userId: number): Product[] {
    const products = getStored<Product[]>('products', INITIAL_PRODUCTS);
    const userProducts = products.filter(p => p.user_id === userId && p.status === 'active');
    if (userProducts.length === 0) {
      return this.seedAllInOneCatalog(userId);
    }
    return userProducts;
  }

  static seedAllInOneCatalog(userId: number): Product[] {
    const products = getStored<Product[]>('products', INITIAL_PRODUCTS);
    let nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const existingNames = new Set(products.filter(p => p.user_id === userId).map(p => p.name.toLowerCase()));

    for (const item of SAMPLE_ALL_IN_ONE_CATALOG) {
      if (!existingNames.has(item.name.toLowerCase())) {
        products.push({
          id: nextId++,
          user_id: userId,
          name: item.name,
          category: item.category,
          sku: item.sku,
          unit: item.unit,
          price_per_unit: item.price_per_unit,
          status: 'active',
          created_at: new Date().toISOString()
        });
      }
    }

    setStored('products', products);
    this.autoPersist();
    return products.filter(p => p.user_id === userId && p.status === 'active');
  }

  static addProduct(userId: number, productData: { name: string; sku?: string; category?: string; unit: string; price_per_unit: number }): { success: boolean; product?: Product; error?: string } {
    if (!productData.name.trim()) return { success: false, error: 'Product name is required.' };
    if (productData.price_per_unit < 0) return { success: false, error: 'Price must be 0 or higher.' };

    const products = getStored<Product[]>('products', INITIAL_PRODUCTS);
    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

    const newProd: Product = {
      id: nextId,
      user_id: userId,
      name: productData.name.trim(),
      category: productData.category || 'General',
      sku: productData.sku?.trim() || undefined,
      unit: productData.unit || 'Pieces',
      price_per_unit: Number(productData.price_per_unit.toFixed(2)),
      status: 'active',
      created_at: new Date().toISOString()
    };

    products.push(newProd);
    setStored('products', products);

    // Persist product to MySQL
    sendToBackend('/api/products', 'POST', {
      user_id: userId,
      name: newProd.name,
      category: newProd.category,
      sku: newProd.sku,
      unit: newProd.unit,
      price_per_unit: newProd.price_per_unit
    });
    this.autoPersist();

    return { success: true, product: newProd };
  }

  static updateProduct(userId: number, productId: number, updates: Partial<Product>): { success: boolean; error?: string } {
    const products = getStored<Product[]>('products', INITIAL_PRODUCTS);
    const prod = products.find(p => p.id === productId && p.user_id === userId);
    if (!prod) return { success: false, error: 'Product not found' };

    if (updates.name !== undefined) prod.name = updates.name.trim();
    if (updates.category !== undefined) prod.category = updates.category;
    if (updates.sku !== undefined) prod.sku = updates.sku.trim() || undefined;
    if (updates.unit !== undefined) prod.unit = updates.unit;
    if (updates.price_per_unit !== undefined) prod.price_per_unit = Number(updates.price_per_unit.toFixed(2));

    setStored('products', products);

    // Persist update to MySQL
    sendToBackend(`/api/products/${productId}/edit`, 'POST', {
      name: prod.name,
      category: prod.category,
      sku: prod.sku,
      unit: prod.unit,
      price_per_unit: prod.price_per_unit
    });
    this.autoPersist();

    return { success: true };
  }

  static deleteProduct(userId: number, productId: number): { success: boolean; error?: string } {
    const products = getStored<Product[]>('products', INITIAL_PRODUCTS);
    const prod = products.find(p => p.id === productId && p.user_id === userId);
    if (!prod) return { success: false, error: 'Product not found' };

    prod.status = 'inactive';
    setStored('products', products);

    // Persist delete to MySQL
    sendToBackend(`/api/products/${productId}/delete`, 'POST');
    this.autoPersist();

    return { success: true };
  }

  // Bills
  static getBills(userId: number): Bill[] {
    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);
    return bills.filter(b => b.user_id === userId).sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
  }

  static getAllBills(): Bill[] {
    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);
    return bills.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
  }

  static getBillById(billId: number): Bill | undefined {
    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);
    return bills.find(b => b.id === billId);
  }

  static createBill(userId: number, data: {
    buyer_name: string;
    buyer_mobile: string;
    discount: number;
    payment_mode: string;
    items: Array<{
      product_id?: number | null;
      product_name: string;
      unit: string;
      quantity: number;
      unit_price: number;
    }>;
  }): { success: boolean; bill?: Bill; error?: string } {
    if (!data.buyer_name.trim()) {
      return { success: false, error: 'Buyer name is required.' };
    }
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Bill must contain at least one line item.' };
    }

    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);

    // Compute line amounts & subtotal
    let subtotal = 0;
    const billItems: BillItem[] = data.items.map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unit_price) || 0;
      const lineAmount = Number((qty * price).toFixed(2));
      subtotal += lineAmount;

      return {
        id: Date.now() + idx,
        bill_id: 0,
        product_id: item.product_id || null,
        product_name: item.product_name.trim(),
        unit: item.unit || 'Pieces',
        quantity: qty,
        unit_price: price,
        amount: lineAmount
      };
    });

    subtotal = Number(subtotal.toFixed(2));
    const discount = Math.min(subtotal, Math.max(0, Number(data.discount) || 0));
    const grandTotal = Number((subtotal - discount).toFixed(2));

    // Unique bill number generation: INV-YYYYMMDD-SEQ
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const userBillsToday = bills.filter(b => b.user_id === userId && b.bill_number.startsWith(`INV-${dateStr}`));
    const seq = String(userBillsToday.length + 1).padStart(3, '0');
    const billNumber = `INV-${dateStr}-${seq}`;

    const nextBillId = bills.length > 0 ? Math.max(...bills.map(b => b.id)) + 1 : 1;
    billItems.forEach(it => it.bill_id = nextBillId);

    const newBill: Bill = {
      id: nextBillId,
      user_id: userId,
      bill_number: billNumber,
      buyer_name: data.buyer_name.trim(),
      buyer_mobile: data.buyer_mobile.trim(),
      subtotal,
      discount,
      grand_total: grandTotal,
      payment_mode: data.payment_mode || 'Cash',
      status: 'completed',
      bill_date: new Date().toISOString(),
      items: billItems
    };

    bills.unshift(newBill);
    setStored('bills', bills);

    this.addAuditLog('Invoice Generated', `Bill #${billNumber} for ₹${grandTotal} generated for ${data.buyer_name}`, `user_${userId}`, 'bill');

    // Persist invoice & line items directly to MySQL
    sendToBackend('/api/bills', 'POST', {
      user_id: userId,
      buyer_name: data.buyer_name.trim(),
      buyer_mobile: data.buyer_mobile.trim(),
      discount,
      payment_mode: data.payment_mode || 'Cash',
      items: data.items
    });
    this.autoPersist();

    return { success: true, bill: newBill };
  }

  static getBillByNumber(billNumber: string): { bill: Bill; profile: ShopProfile } | null {
    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);
    const bill = bills.find(b => b.bill_number.trim().toLowerCase() === billNumber.trim().toLowerCase());
    if (!bill) return null;
    const profile = this.getShopProfile(bill.user_id);
    return { bill, profile };
  }

  static voidBill(userId: number, billId: number, reason: string): { success: boolean; error?: string } {
    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);
    const bill = bills.find(b => b.id === billId && b.user_id === userId);
    if (!bill) return { success: false, error: 'Bill not found' };

    bill.status = 'void';
    bill.void_reason = reason.trim() || 'Cancelled by merchant';
    setStored('bills', bills);

    this.addAuditLog('Bill Voided', `Bill #${bill.bill_number} voided. Reason: ${bill.void_reason}`, `user_${userId}`, 'bill');

    // Persist void to MySQL
    sendToBackend(`/api/bills/${billId}/void`, 'POST', { reason: bill.void_reason });
    this.autoPersist();

    return { success: true };
  }

  // Automatic background disk sync
  static autoPersist(): void {
    setTimeout(() => {
      this.syncAllToMySQL().catch(() => {});
    }, 150);
  }

  // Re-hydrate application state on launch from persistent backend database
  static async bootstrapFromBackend(): Promise<boolean> {
    try {
      const res = await fetch('/api/database/bootstrap');
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || !data.success) return false;

      let changed = false;
      if (Array.isArray(data.users) && data.users.length > 0) {
        const localUsers = this.getUsers();
        const mergedUsers = [...localUsers];
        for (const u of data.users) {
          const idx = mergedUsers.findIndex(x => x.id === u.id || x.username.toLowerCase() === u.username.toLowerCase());
          if (idx >= 0) {
            mergedUsers[idx] = { ...mergedUsers[idx], ...u };
          } else {
            mergedUsers.push(u);
          }
        }
        setStored('users', mergedUsers);
        changed = true;
      }

      if (Array.isArray(data.profiles) && data.profiles.length > 0) {
        const localProfiles = getStored<ShopProfile[]>('profiles', INITIAL_PROFILES);
        const mergedProfiles = [...localProfiles];
        for (const p of data.profiles) {
          const idx = mergedProfiles.findIndex(x => x.user_id === p.user_id);
          if (idx >= 0) {
            mergedProfiles[idx] = { ...mergedProfiles[idx], ...p };
          } else {
            mergedProfiles.push(p);
          }
        }
        setStored('profiles', mergedProfiles);
        changed = true;
      }

      if (Array.isArray(data.products) && data.products.length > 0) {
        const localProducts = getStored<Product[]>('products', INITIAL_PRODUCTS);
        const mergedProducts = [...localProducts];
        for (const pr of data.products) {
          const idx = mergedProducts.findIndex(x => x.id === pr.id);
          if (idx >= 0) {
            mergedProducts[idx] = { ...mergedProducts[idx], ...pr };
          } else {
            mergedProducts.push(pr);
          }
        }
        setStored('products', mergedProducts);
        changed = true;
      }

      if (Array.isArray(data.bills) && data.bills.length > 0) {
        const localBills = getStored<Bill[]>('bills', INITIAL_BILLS);
        const mergedBills = [...localBills];
        for (const b of data.bills) {
          const idx = mergedBills.findIndex(x => x.bill_number === b.bill_number);
          if (idx >= 0) {
            mergedBills[idx] = { ...mergedBills[idx], ...b };
          } else {
            mergedBills.push(b);
          }
        }
        setStored('bills', mergedBills);
        changed = true;
      }

      return changed;
    } catch {
      return false;
    }
  }

  // Database Synchronization & Health Check
  static async checkMySQLStatus(): Promise<{
    connected: boolean;
    database?: string;
    host?: string;
    tables?: Record<string, number>;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/database/status');
      if (!res.ok) {
        return { connected: false, message: `Status code ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { connected: false, error: e?.message || 'Could not connect to backend server' };
    }
  }

  static async syncAllToMySQL(): Promise<{
    success: boolean;
    synced?: any;
    message?: string;
    error?: string;
  }> {
    const users = this.getUsers();
    const profiles = getStored<ShopProfile[]>('profiles', INITIAL_PROFILES);
    const products = getStored<Product[]>('products', INITIAL_PRODUCTS);
    const bills = getStored<Bill[]>('bills', INITIAL_BILLS);

    try {
      const res = await fetch('/api/database/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users, profiles, products, bills })
      });
      if (!res.ok) {
        return { success: false, error: `Server returned ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to sync to MySQL' };
    }
  }

  // Audit Logs
  static getAuditLogs(): AuditLog[] {
    return getStored<AuditLog[]>('logs', INITIAL_LOGS);
  }

  static addAuditLog(action: string, details: string, actor: string, type: 'auth' | 'account' | 'bill' | 'system'): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      action,
      details,
      actor,
      timestamp: new Date().toISOString(),
      type
    };
    logs.unshift(newLog);
    // Keep max 100 logs
    if (logs.length > 100) logs.pop();
    setStored('logs', logs);
  }

  // Reset to factory defaults (keeps ONLY Admin)
  static resetToDefaults(): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'users');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'profiles');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'products');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'bills');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'logs');
    setStored('users', INITIAL_USERS);
    setStored('profiles', INITIAL_PROFILES);
    setStored('products', INITIAL_PRODUCTS);
    setStored('bills', INITIAL_BILLS);
    setStored('logs', INITIAL_LOGS);
  }
}
