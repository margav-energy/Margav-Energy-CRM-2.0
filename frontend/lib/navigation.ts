import { BarChart3, Calendar, Home, Users, Target, CheckSquare, Settings, Shield, MessageSquare, Database, History } from 'lucide-react';
import type { Role } from './auth-context';

export interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  roles: Role[];
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['AGENT', 'QUALIFIER', 'FIELD_SALES'] },
  { id: 'leads', label: 'Leads', icon: Users, roles: ['AGENT', 'QUALIFIER'] },
  { id: 'appointments', label: 'Appointments', icon: Calendar, roles: ['QUALIFIER', 'FIELD_SALES'] },
  { id: 'opportunities', label: 'Opportunities', icon: Target, roles: ['FIELD_SALES'] },
  { id: 'tasks', label: 'Tasks/Activities', icon: CheckSquare, roles: ['AGENT', 'QUALIFIER', 'FIELD_SALES'] },
  { id: 'calendar', label: 'Calendar', icon: Calendar, roles: ['QUALIFIER', 'FIELD_SALES'] },
  { id: 'reports', label: 'Reports/Analytics', icon: BarChart3, roles: ['AGENT', 'QUALIFIER', 'FIELD_SALES'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['AGENT', 'QUALIFIER', 'FIELD_SALES'] },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'admin-overview', label: 'Admin Overview', icon: Home, roles: ['ADMIN'] },
  { id: 'admin-leads', label: 'Lead Operations', icon: Users, roles: ['ADMIN'] },
  { id: 'admin-team', label: 'Team Performance', icon: Target, roles: ['ADMIN'] },
  { id: 'admin-appointments', label: 'Appointments', icon: Calendar, roles: ['ADMIN'] },
  { id: 'admin-sms', label: 'SMS Automation', icon: MessageSquare, roles: ['ADMIN'] },
  { id: 'admin-users', label: 'Users & Permissions', icon: Shield, roles: ['ADMIN'] },
  { id: 'admin-data-quality', label: 'Data Quality', icon: Database, roles: ['ADMIN'] },
  { id: 'admin-audit', label: 'Audit Trail', icon: History, roles: ['ADMIN'] },
  { id: 'admin-settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

export function getNavItemsForRole(role: Role): NavItem[] {
  if (role === 'ADMIN') {
    return ADMIN_NAV_ITEMS;
  }
  return ALL_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function getDefaultPageForRole(role: Role): string {
  return 'dashboard';
}
