import type { Metadata } from 'next';
import WorkerEarningsReport from './_components/worker-earnings-report';

export const metadata: Metadata = {
  title: 'รายงานรายรับช่าง | LawnFlow',
  description: 'สรุปรายรับสุทธิ ยอดโอนแล้ว และเงินที่พักใน Escrow ของช่างตัดหญ้า',
};

export default function WorkerEarningsPage() {
  return <WorkerEarningsReport />;
}
