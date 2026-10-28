export type CategoryId = 'drilling' | 'cutting' | 'anchoring' | 'measuring' | 'batteries';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  category: CategoryId;
  price: number;
  rating: number;
  reviews: number;
  badge?: string;
  summary: string;
  specs: Record<string, string>;
}

export const CATEGORIES: Category[] = [
  { id: 'drilling', name: 'Drilling & Demolition', description: 'Rotary hammers, combihammers and breakers.' },
  { id: 'cutting', name: 'Cutting & Grinding', description: 'Angle grinders, saws and diamond systems.' },
  { id: 'anchoring', name: 'Anchoring Systems', description: 'Chemical and mechanical anchors.' },
  { id: 'measuring', name: 'Measuring & Detection', description: 'Laser meters, line lasers and scanners.' },
  { id: 'batteries', name: 'Batteries & Chargers', description: 'One battery platform for all your tools.' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'te-6-22',
    name: 'TE 6-22 Cordless Rotary Hammer',
    category: 'drilling',
    price: 459,
    rating: 4.8,
    reviews: 312,
    badge: 'Best seller',
    summary: 'Compact SDS plus rotary hammer for drilling in concrete and masonry.',
    specs: { Voltage: '22 V', 'Impact energy': '2.5 J', Weight: '2.6 kg', 'Drilling range': '6–22 mm' },
  },
  {
    id: 'te-30-a36',
    name: 'TE 30-A36 Combihammer',
    category: 'drilling',
    price: 829,
    rating: 4.7,
    reviews: 154,
    summary: 'Powerful combihammer with active vibration reduction for heavy-duty work.',
    specs: { Voltage: '36 V', 'Impact energy': '3.6 J', Weight: '5.4 kg', 'Drilling range': '10–28 mm' },
  },
  {
    id: 'te-500',
    name: 'TE 500 Demolition Hammer',
    category: 'drilling',
    price: 699,
    rating: 4.6,
    reviews: 98,
    summary: 'Light chiselling and tile removal with low vibration.',
    specs: { Power: '1300 W', 'Impact energy': '7.5 J', Weight: '5.8 kg' },
  },
  {
    id: 'ag-125',
    name: 'AG 125-A22 Angle Grinder',
    category: 'cutting',
    price: 319,
    rating: 4.7,
    reviews: 221,
    badge: 'New',
    summary: 'Cordless 125 mm angle grinder with brushless motor and kickback protection.',
    specs: { Voltage: '22 V', 'Disc diameter': '125 mm', 'No-load speed': '8500 rpm', Weight: '2.4 kg' },
  },
  {
    id: 'sc-30',
    name: 'SC 30WL Circular Saw',
    category: 'cutting',
    price: 389,
    rating: 4.5,
    reviews: 87,
    summary: 'Cordless circular saw for fast, precise cuts in wood.',
    specs: { Voltage: '22 V', 'Cutting depth': '70 mm', 'Blade diameter': '190 mm' },
  },
  {
    id: 'hit-hy-200',
    name: 'HIT-HY 200 Injectable Mortar',
    category: 'anchoring',
    price: 39,
    rating: 4.9,
    reviews: 403,
    summary: 'Hybrid mortar for high-performance anchoring of rebar and threaded rods.',
    specs: { Volume: '500 ml', 'Base material': 'Concrete', 'Working time': '6 min @ 20°C' },
  },
  {
    id: 'hst3',
    name: 'HST3 Wedge Anchor (box of 50)',
    category: 'anchoring',
    price: 64,
    rating: 4.8,
    reviews: 176,
    summary: 'High-performance stud anchor for cracked and uncracked concrete.',
    specs: { Size: 'M10 x 90', Material: 'Carbon steel, zinc plated', Quantity: '50 pcs' },
  },
  {
    id: 'pd-c',
    name: 'PD-C Laser Range Meter',
    category: 'measuring',
    price: 249,
    rating: 4.6,
    reviews: 132,
    summary: 'Laser range meter with touchscreen, camera and 100 m range.',
    specs: { Range: '0.05–100 m', Accuracy: '±1 mm', 'Protection class': 'IP54' },
  },
  {
    id: 'pm-30',
    name: 'PM 30-MG Multi-Line Laser',
    category: 'measuring',
    price: 579,
    rating: 4.7,
    reviews: 64,
    badge: 'Pro choice',
    summary: 'Green 360° line laser for levelling, aligning and squaring.',
    specs: { 'Laser colour': 'Green', Lines: '3 x 360°', Range: '30 m (80 m w/ receiver)' },
  },
  {
    id: 'b22-85',
    name: 'B 22-85 Battery 8.0 Ah',
    category: 'batteries',
    price: 189,
    rating: 4.8,
    reviews: 289,
    summary: 'High-capacity Li-ion battery compatible with all 22 V tools.',
    specs: { Voltage: '22 V', Capacity: '8.0 Ah', Weight: '0.9 kg' },
  },
  {
    id: 'c4-36',
    name: 'C 4/36-350 Fast Charger',
    category: 'batteries',
    price: 129,
    rating: 4.6,
    reviews: 112,
    summary: 'Fast charger for 12–36 V batteries with active cooling.',
    specs: { 'Input voltage': '230 V', 'Charging time (8 Ah)': '≈ 65 min' },
  },
];
