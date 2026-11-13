import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Monitor,
  Printer,
  ReceiptText,
  Settings,
  Store,
  Tags,
  Users,
} from 'lucide-react';

export const shopNavigation = [
  { label: 'Overview', to: '/shop', icon: LayoutDashboard, end: true },
  { label: 'Orders', to: '/shop/orders', icon: ReceiptText },
  { label: 'Machines', to: '/shop/machines', icon: Printer },
  { label: 'Pricing', to: '/shop/pricing', icon: Tags },
  { label: 'Payments', to: '/shop/payments', icon: CreditCard },
  { label: 'Subscription', to: '/shop/subscription', icon: BarChart3 },
  { label: 'Shop profile', to: '/shop/settings', icon: Settings },
];

export const adminNavigation = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Shops', to: '/admin/shops', icon: Store },
  { label: 'Machines', to: '/admin/machines', icon: Monitor },
  { label: 'Print jobs', to: '/admin/jobs', icon: ReceiptText },
  { label: 'Subscriptions', to: '/admin/subscriptions', icon: Users },
  { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
];
