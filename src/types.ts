export type UserRole = 'admin' | 'customer';
export type UserStatus = 'active' | 'inactive';
export type BillStatus = 'completed' | 'void';

export interface User {
  id: number;
  shop_name: string;
  owner_name: string;
  username: string;
  password_hash: string;
  role: UserRole;
  mobile: string;
  email?: string;
  status: UserStatus;
  created_at: string;
}

export interface ShopProfile {
  id: number;
  user_id: number;
  brand_name: string;
  owner_name: string;
  logo_path?: string;
  address?: string;
  mobile: string;
  email?: string;
  bill_header?: string;
  bill_footer?: string;
  terms_conditions?: string;
  currency_symbol: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  user_id: number;
  name: string;
  sku?: string;
  category?: string; // 'Vegetables' | 'Fruits' | 'Grocery' | 'Stationery' | 'Dairy' | 'General'
  unit: string;
  price_per_unit: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface BillItem {
  id: number;
  bill_id: number;
  product_id?: number | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  base_unit?: string;
  selected_unit?: string;
}

export interface Bill {
  id: number;
  user_id: number;
  bill_number: string;
  buyer_name: string;
  buyer_mobile: string;
  subtotal: number;
  discount: number;
  grand_total: number;
  payment_mode: string;
  status: BillStatus;
  void_reason?: string;
  bill_date: string;
  items?: BillItem[];
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  actor: string;
  timestamp: string;
  type: 'auth' | 'account' | 'bill' | 'system';
}

