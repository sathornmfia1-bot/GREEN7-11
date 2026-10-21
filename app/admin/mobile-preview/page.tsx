import type { Metadata } from 'next';
import MobilePreview from './_components/mobile-preview';

export const metadata: Metadata = {
  title: 'พรีวิวมือถือช่าง | GREEN 7-Eleven',
  description: 'ดูหน้าจอฝั่งช่างตัดหญ้าในขนาดหน้าจอมือถือ',
};

export default function MobilePreviewPage() {
  return <MobilePreview />;
}
