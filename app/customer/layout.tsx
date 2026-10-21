import { RoleShell, type NavItem } from '../_components/role-shell';

const nav: NavItem[] = [
  { href: '/customer', label: 'จองบริการ', icon: '🌿' },
  { href: '/customer/bookings', label: 'การจองของฉัน', icon: '📋' },
  { href: '/customer/notifications', label: 'แจ้งเตือน', icon: '🔔', badge: 'notifications' },
  { href: '/customer/account', label: 'บัญชี', icon: '⚙️' },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="customer" nav={nav}>{children}</RoleShell>;
}
