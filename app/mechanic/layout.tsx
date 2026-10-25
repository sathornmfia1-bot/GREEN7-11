import { RoleShell, type NavItem } from '../_components/role-shell';

const nav: NavItem[] = [
  { href: '/mechanic', label: 'งานใหม่', icon: '🧾' },
  { href: '/mechanic/jobs', label: 'งานของฉัน', icon: '🧰' },
  // มือถือ: รายรับเข้าจากหน้าโปรไฟล์ (แถบเมนูล่างมีไม่เกิน 4 ช่อง)
  { href: '/mechanic/earnings', label: 'รายรับ', icon: '💰', mobile: false },
  { href: '/mechanic/notifications', label: 'แจ้งเตือน', icon: '🔔', badge: 'notifications' },
  { href: '/mechanic/profile', label: 'โปรไฟล์', icon: '👤' },
];

export default function MechanicLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="mechanic" nav={nav}>{children}</RoleShell>;
}
