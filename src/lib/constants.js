/**
 * Domain constants for SmartPrint.
 * Order lifecycle is shared by the customer portal, shop dashboard and admin console.
 */

export const ORDER_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  QUEUED: 'queued',
  PRINTING: 'printing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export const ORDER_STATUS_META = {
  [ORDER_STATUS.AWAITING_PAYMENT]: { label: 'Awaiting payment', tone: 'neutral' },
  [ORDER_STATUS.PAID]: { label: 'Paid', tone: 'info' },
  [ORDER_STATUS.QUEUED]: { label: 'Queued at machine', tone: 'info' },
  [ORDER_STATUS.PRINTING]: { label: 'Printing', tone: 'brand' },
  [ORDER_STATUS.COMPLETED]: { label: 'Completed', tone: 'success' },
  [ORDER_STATUS.FAILED]: { label: 'Failed', tone: 'danger' },
  [ORDER_STATUS.REFUNDED]: { label: 'Refunded', tone: 'warning' },
};

export const MACHINE_STATUS = {
  ONLINE: 'online',
  BUSY: 'busy',
  OFFLINE: 'offline',
  MAINTENANCE: 'maintenance',
};

export const MACHINE_STATUS_META = {
  [MACHINE_STATUS.ONLINE]: { label: 'Online', tone: 'success', dot: 'bg-success' },
  [MACHINE_STATUS.BUSY]: { label: 'Printing', tone: 'brand', dot: 'bg-brand-500' },
  [MACHINE_STATUS.OFFLINE]: { label: 'Offline', tone: 'neutral', dot: 'bg-ink-300' },
  [MACHINE_STATUS.MAINTENANCE]: { label: 'Maintenance', tone: 'warning', dot: 'bg-warn' },
};

export const PLAN_CATALOG = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    billing: 'forever',
    tagline: 'For a single counter finding its feet.',
    limits: { machines: 1, monthlyJobs: 300, commission: '6%' },
    features: [
      '1 machine, 1 shop location',
      'QR ordering page',
      'Basic job dashboard',
      'UPI settlement (T+3)',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 1499,
    billing: 'per month',
    tagline: 'For busy shops running multiple machines.',
    limits: { machines: 5, monthlyJobs: 2500, commission: '3.5%' },
    popular: true,
    features: [
      'Up to 5 machines',
      'Pricing rules per machine',
      'Payment + settlement reports',
      'Print agent monitoring',
      'Priority chat support',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 3999,
    billing: 'per month',
    tagline: 'For multi-branch print networks.',
    limits: { machines: 25, monthlyJobs: 20000, commission: '2%' },
    features: [
      'Up to 25 machines, multi-branch',
      'Role-based staff accounts',
      'Revenue analytics + exports',
      'Dedicated onboarding manager',
      '99.9% platform SLA',
    ],
  },
];

export const PAPER_OPTIONS = [
  { id: 'a4', label: 'A4', hint: '210 × 297 mm' },
  { id: 'a3', label: 'A3', hint: '297 × 420 mm (where supported)' },
];

export const FINISHING_OPTIONS = [
  { id: 'none', label: 'Plain stack', price: 0 },
  { id: 'staple', label: 'Staple corner', price: 5 },
  { id: 'spiral', label: 'Spiral bind', price: 40 },
];

export const PAGE_SIZE_LABEL = {
  a4: 'A4',
  a3: 'A3',
  letter: 'Letter',
};

export const BINDING_LABEL = {
  none: 'Plain',
  staple: 'Stapled',
  spiral: 'Spiral bound',
};

/** Demo accounts. Passwords are intentionally visible: this is a frontend-only preview. */
export const DEMO_ACCOUNTS = [
  {
    id: 'usr_shop_01',
    role: 'shop',
    name: 'Rohit Sharma',
    email: 'owner@smartprint.in',
    password: 'demo1234',
    shopId: 'shop_hsr_01',
    shopName: 'Sharma Digital Press',
    title: 'Owner',
  },
  {
    id: 'usr_shop_02',
    role: 'shop',
    name: 'Neha Verma',
    email: 'campus@smartprint.in',
    password: 'demo1234',
    shopId: 'shop_hsr_02',
    shopName: 'Campus Copy Centre',
    title: 'Manager',
  },
  {
    id: 'usr_admin_01',
    role: 'admin',
    name: 'Aarav Mehta',
    email: 'admin@smartprint.in',
    password: 'demo1234',
    shopId: null,
    shopName: 'SmartPrint Platform',
    title: 'Super Admin',
  },
];

export const STATUS_TONES = {
  success: 'bg-success/10 text-success ring-success/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/20',
  info: 'bg-brand-50 text-brand-600 ring-brand-500/15',
  warning: 'bg-warn/10 text-warn ring-warn/20',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  neutral: 'bg-ink-900/[0.04] text-ink-600 ring-ink-900/10',
};
