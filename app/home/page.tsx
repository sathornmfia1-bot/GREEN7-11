import type { Metadata } from 'next';
import Home from '../page';

// /home แสดงหน้าแรกเดียวกับ / (ไม่ redirect) — ผู้ให้บริการภายนอก เช่น SMS2PRO ใช้ตรวจเว็บไซต์ที่ /home
export const metadata: Metadata = {
  title: 'GREEN 7-Eleven · จ้างช่างตัดหญ้าออนไลน์',
  description: 'บริการตัดหญ้าและดูแลสวน รู้ราคาทันที จองได้ในไม่กี่คลิก ชำระผ่าน QR',
  // บอกเครื่องมือค้นหาว่าหน้าหลักจริงคือ / เพื่อไม่ให้นับเป็นหน้าซ้ำ
  alternates: { canonical: '/' },
};

export default Home;
