import type { Metadata } from 'next';
import CustomerRegistrationForm from './_components/customer-registration-form';

export const metadata: Metadata = {
  title: 'ลงทะเบียนลูกค้า | GREEN 7-Eleven',
  description: 'สมัครบัญชีลูกค้าเพื่อจองบริการดูแลสวนและตัดหญ้า',
};

export default function RegisterCustomerPage() {
  return <CustomerRegistrationForm />;
}
