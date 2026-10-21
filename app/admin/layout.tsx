import { RoleShell, type NavItem } from '../_components/role-shell';

const nav: NavItem[] = [
  { href: '/admin', label: 'แดชบอร์ด', icon: '📊' },
  { href: '/admin/mobile-preview', label: 'พรีวิวมือถือ', icon: '📱' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="admin" nav={nav}>{children}</RoleShell>;
}
