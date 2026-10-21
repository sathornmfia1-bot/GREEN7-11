import type { Metadata } from 'next';
import AdminDashboard from './_components/admin-dashboard';

export const metadata: Metadata = {
  title: 'แอดมิน | GREEN 7-Eleven',
  description: 'ตรวจสอบบัญชีช่าง ดูภาพรวมระบบ คลังงาน และลูกค้า',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
