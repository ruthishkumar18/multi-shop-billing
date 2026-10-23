/**
 * Multi-Unit Conversion & Pricing Engine for All-in-One Shops
 * (Vegetables, Fruits, Grocery, Stationery, Dairy & Provisions)
 */

export type UnitCategory = 'weight' | 'volume' | 'count' | 'length' | 'custom';

export interface StoreCategory {
  id: string;
  label: string;
  iconName: string;
  defaultUnit: string;
}

export const STORE_CATEGORIES: StoreCategory[] = [
  { id: 'all', label: 'All Items', iconName: 'LayoutGrid', defaultUnit: 'Pieces' },
  { id: 'Vegetables', label: 'Vegetables', iconName: 'Salad', defaultUnit: 'kg' },
  { id: 'Fruits', label: 'Fruits', iconName: 'Apple', defaultUnit: 'kg' },
  { id: 'Grocery', label: 'Grocery & Provisions', iconName: 'Wheat', defaultUnit: 'kg' },
  { id: 'Stationery', label: 'Stationery & Office', iconName: 'PenTool', defaultUnit: 'Pieces' },
  { id: 'Dairy', label: 'Dairy & Drinks', iconName: 'Milk', defaultUnit: 'Litre' },
  { id: 'General', label: 'General / Snacks', iconName: 'Package', defaultUnit: 'Pieces' }
];

export const STANDARD_UNITS = [
  'kg',
  'g',
  'Pieces',
  'Packets',
  'Boxes',
  'Litre',
  'ml',
  'Dozen',
  'Metres'
] as const;

export interface WeightPreset {
  label: string;
  qty: number;
  unit: string;
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  { label: '100g', qty: 100, unit: 'g' },
  { label: '250g', qty: 250, unit: 'g' },
  { label: '500g', qty: 500, unit: 'g' },
  { label: '750g', qty: 750, unit: 'g' },
  { label: '1 kg', qty: 1, unit: 'kg' },
  { label: '2 kg', qty: 2, unit: 'kg' }
];

export const VOLUME_PRESETS: WeightPreset[] = [
  { label: '100ml', qty: 100, unit: 'ml' },
  { label: '250ml', qty: 250, unit: 'ml' },
  { label: '500ml', qty: 500, unit: 'ml' },
  { label: '1 L', qty: 1, unit: 'Litre' },
  { label: '2 L', qty: 2, unit: 'Litre' }
];

export const COUNT_PRESETS: WeightPreset[] = [
  { label: '1', qty: 1, unit: 'Pieces' },
  { label: '2', qty: 2, unit: 'Pieces' },
  { label: '5', qty: 5, unit: 'Pieces' },
  { label: '10', qty: 10, unit: 'Pieces' },
  { label: '½ Doz (6)', qty: 6, unit: 'Pieces' },
  { label: '1 Doz (12)', qty: 1, unit: 'Dozen' }
];

/**
 * Normalizes user-entered unit strings into standard slugs
 */
export function normalizeUnitSlug(unit: string): string {
  const clean = (unit || '').toLowerCase().trim();
  if (clean.includes('kilo') || clean === 'kg' || clean.startsWith('kg')) return 'kg';
  if (clean.includes('gram') || clean === 'g' || clean.startsWith('g')) return 'g';
  if (clean.includes('litre') || clean.includes('liter') || clean === 'l' || clean.startsWith('l')) return 'litre';
  if (clean.includes('milli') || clean === 'ml' || clean.startsWith('ml')) return 'ml';
  if (clean.includes('dozen') || clean === 'doz') return 'dozen';
  if (clean.includes('piece') || clean.includes('pcs') || clean === 'pc') return 'pieces';
  if (clean.includes('packet') || clean.includes('pkt')) return 'packets';
  if (clean.includes('box')) return 'boxes';
  if (clean.includes('metre') || clean.includes('meter') || clean === 'm') return 'metres';
  return clean || 'pieces';
}

/**
 * Detects whether a unit represents weight, volume, or discrete piece
 */
export function getUnitCategory(unit: string): UnitCategory {
  const slug = normalizeUnitSlug(unit);
  if (slug === 'kg' || slug === 'g') return 'weight';
  if (slug === 'litre' || slug === 'ml') return 'volume';
  if (slug === 'dozen' || slug === 'pieces' || slug === 'packets' || slug === 'boxes') return 'count';
  if (slug === 'metres') return 'length';
  return 'custom';
}

/**
 * Returns available convertible sub-units for an entered base unit
 */
export function getAlternateUnits(baseUnit: string): string[] {
  const category = getUnitCategory(baseUnit);
  if (category === 'weight') return ['g', 'kg'];
  if (category === 'volume') return ['ml', 'Litre'];
  if (category === 'count') return ['Pieces', 'Packets', 'Boxes', 'Dozen'];
  return [baseUnit];
}

export interface UnitCalculationResult {
  amount: number;
  multiplier: number;
  effectiveBaseQty: number;
  formattedQty: string;
  calculationBreakdown: string;
}

/**
 * Automatically calculates exact pricing when buying in grams, kilograms, millilitres, or pieces
 */
export function calculateDynamicAmount(
  enteredQty: number,
  selectedUnit: string,
  baseUnit: string,
  basePrice: number,
  currencySymbol: string = '₹'
): UnitCalculationResult {
  const sUnit = normalizeUnitSlug(selectedUnit);
  const bUnit = normalizeUnitSlug(baseUnit);

  let multiplier = 1;

  // Weight conversions
  if (bUnit === 'kg' && sUnit === 'g') {
    multiplier = 0.001; // e.g. 200g of ₹40/kg = 0.2 kg * 40 = ₹8.00
  } else if (bUnit === 'g' && sUnit === 'kg') {
    multiplier = 1000;  // e.g. 1.5kg of ₹0.05/g = 1500g * 0.05
  }
  // Volume conversions
  else if (bUnit === 'litre' && sUnit === 'ml') {
    multiplier = 0.001; // e.g. 250ml of ₹120/L = 0.25 L * 120 = ₹30.00
  } else if (bUnit === 'ml' && sUnit === 'litre') {
    multiplier = 1000;
  }
  // Dozen conversions
  else if (bUnit === 'dozen' && sUnit === 'pieces') {
    multiplier = 1 / 12; // e.g. 6 pieces of ₹60/dozen = 0.5 dozen * 60 = ₹30.00
  } else if (bUnit === 'pieces' && sUnit === 'dozen') {
    multiplier = 12;
  }

  const effectiveBaseQty = Number((enteredQty * multiplier).toFixed(4));
  const amount = Number((effectiveBaseQty * basePrice).toFixed(2));

  // Formatted display strings
  let formattedQty = `${enteredQty} ${selectedUnit}`;
  let calculationBreakdown = `${enteredQty} ${selectedUnit} × ${currencySymbol}${basePrice.toFixed(2)}/${baseUnit} = ${currencySymbol}${amount.toFixed(2)}`;

  if (multiplier !== 1) {
    if (bUnit === 'kg' && sUnit === 'g') {
      formattedQty = `${enteredQty}g (${effectiveBaseQty} kg)`;
      calculationBreakdown = `${enteredQty}g (${effectiveBaseQty} kg) @ ${currencySymbol}${basePrice.toFixed(2)}/kg = ${currencySymbol}${amount.toFixed(2)}`;
    } else if (bUnit === 'litre' && sUnit === 'ml') {
      formattedQty = `${enteredQty}ml (${effectiveBaseQty} L)`;
      calculationBreakdown = `${enteredQty}ml (${effectiveBaseQty} L) @ ${currencySymbol}${basePrice.toFixed(2)}/L = ${currencySymbol}${amount.toFixed(2)}`;
    } else if (bUnit === 'dozen' && sUnit === 'pieces') {
      formattedQty = `${enteredQty} pcs (${Number(effectiveBaseQty.toFixed(2))} doz)`;
      calculationBreakdown = `${enteredQty} pcs @ ${currencySymbol}${basePrice.toFixed(2)}/dozen = ${currencySymbol}${amount.toFixed(2)}`;
    }
  }

  return {
    amount,
    multiplier,
    effectiveBaseQty,
    formattedQty,
    calculationBreakdown
  };
}

/**
 * Pre-seeded sample catalog for an All-in-One Store
 * (Vegetables, Fruits, Grocery, Stationery, Dairy)
 */
export const SAMPLE_ALL_IN_ONE_CATALOG = [
  // 🥬 Vegetables (Sold by kg / g)
  { name: 'Fresh Tomatoes', category: 'Vegetables', unit: 'kg', price_per_unit: 40.00, sku: 'VEG-TOM-01' },
  { name: 'Red Onions', category: 'Vegetables', unit: 'kg', price_per_unit: 35.00, sku: 'VEG-ONI-02' },
  { name: 'Potatoes (Aloo)', category: 'Vegetables', unit: 'kg', price_per_unit: 30.00, sku: 'VEG-POT-03' },
  { name: 'Green Beans', category: 'Vegetables', unit: 'kg', price_per_unit: 60.00, sku: 'VEG-BEA-04' },
  { name: 'Fresh Carrots', category: 'Vegetables', unit: 'kg', price_per_unit: 50.00, sku: 'VEG-CAR-05' },
  { name: 'Spinach (Palak)', category: 'Vegetables', unit: 'Pieces', price_per_unit: 15.00, sku: 'VEG-SPI-06' },

  // 🍎 Fruits (Sold by kg / Dozen / g)
  { name: 'Royal Gala Apples', category: 'Fruits', unit: 'kg', price_per_unit: 160.00, sku: 'FRU-APP-01' },
  { name: 'Robusta Bananas', category: 'Fruits', unit: 'Dozen', price_per_unit: 60.00, sku: 'FRU-BAN-02' },
  { name: 'Nagpur Oranges', category: 'Fruits', unit: 'kg', price_per_unit: 80.00, sku: 'FRU-ORA-03' },
  { name: 'Seedless Grapes', category: 'Fruits', unit: 'kg', price_per_unit: 90.00, sku: 'FRU-GRA-04' },
  { name: 'Fresh Pomegranate', category: 'Fruits', unit: 'kg', price_per_unit: 180.00, sku: 'FRU-POM-05' },

  // 🌾 Grocery & Provisions (Sold by kg / g / Litre)
  { name: 'Premium Basmati Rice', category: 'Grocery', unit: 'kg', price_per_unit: 95.00, sku: 'GRO-RIC-01' },
  { name: 'Toor Dhal (Pigeon Pea)', category: 'Grocery', unit: 'kg', price_per_unit: 140.00, sku: 'GRO-DHA-02' },
  { name: 'Refined Sugar', category: 'Grocery', unit: 'kg', price_per_unit: 44.00, sku: 'GRO-SUG-03' },
  { name: 'Whole Wheat Atta Flour', category: 'Grocery', unit: 'kg', price_per_unit: 48.00, sku: 'GRO-FLR-04' },
  { name: 'Sunflower Cooking Oil', category: 'Grocery', unit: 'Litre', price_per_unit: 135.00, sku: 'GRO-OIL-05' },
  { name: 'Tata Iodized Salt (1kg)', category: 'Grocery', unit: 'Packets', price_per_unit: 25.00, sku: 'GRO-SLT-06' },

  // ✏️ Stationery (Sold by Pieces / Packets / Boxes)
  { name: 'Classmate Notebook (Long size)', category: 'Stationery', unit: 'Pieces', price_per_unit: 45.00, sku: 'STA-NOT-01' },
  { name: 'Gel Pen (Blue 0.5mm)', category: 'Stationery', unit: 'Pieces', price_per_unit: 10.00, sku: 'STA-PEN-02' },
  { name: 'A4 Copier Paper Ream (500 sheets)', category: 'Stationery', unit: 'Packets', price_per_unit: 280.00, sku: 'STA-A4P-03' },
  { name: 'Camlin Geometry Mathematical Box', category: 'Stationery', unit: 'Boxes', price_per_unit: 120.00, sku: 'STA-GEO-04' },
  { name: 'Fevicol MR Adhesive (50g)', category: 'Stationery', unit: 'Pieces', price_per_unit: 25.00, sku: 'STA-FEV-05' },

  // 🥛 Dairy & Drinks
  { name: 'Fresh Toned Milk', category: 'Dairy', unit: 'Litre', price_per_unit: 56.00, sku: 'DAI-MLK-01' },
  { name: 'Fresh Curd / Dahi (500g)', category: 'Dairy', unit: 'Packets', price_per_unit: 32.00, sku: 'DAI-CRD-02' },
  { name: 'Amul Butter (100g)', category: 'Dairy', unit: 'Pieces', price_per_unit: 58.00, sku: 'DAI-BUT-03' }
];
