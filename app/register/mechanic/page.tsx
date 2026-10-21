import type { Metadata } from 'next';
import WorkerRegistrationForm from './_components/worker-registration-form';

export const metadata: Metadata = {
  title: 'สมัครเป็นช่างตัดหญ้า | GREEN 7-Eleven',
  description: 'ลงทะเบียนช่างตัดหญ้าเพื่อรับงานบริการดูแลสวน',
};

export default function RegisterWorkerPage() {
  return <WorkerRegistrationForm />;
}
