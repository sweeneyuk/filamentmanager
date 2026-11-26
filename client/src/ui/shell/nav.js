import { Printer, Disc3, History, Recycle, ChartColumn, Calculator, Briefcase, Settings } from 'lucide-react';

export const MAIN_NAV = [
  { to: '/', label: 'Print status', short: 'Status', icon: Printer },
  { to: '/inventory', label: 'Spools', short: 'Spools', icon: Disc3 },
  { to: '/archive', label: 'Print history', short: 'History', icon: History },
  { to: '/scrap-saver', label: 'Scrap saver', icon: Recycle },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn },
  { to: '/calculator', label: 'Calculator', icon: Calculator },
  { to: '/jobs', label: 'Jobs and quotes', icon: Briefcase },
];
export const SETTINGS_NAV = { to: '/settings', label: 'Settings', icon: Settings };
