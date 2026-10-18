import { isoDateFromToday } from './date-input';
import type { AddressDetails } from './address';

export type Job = {
  id: number;
  title: string;
  area: number;
  grassHeight: number;
  isMonthly: boolean;
  date: string;
  time?: string;
  firstName: string;
  lastName: string;
  // เบอร์โทรลูกค้า (เฉพาะตัวเลข 10 หลัก) ให้ช่างโทรหาได้หลังรับงาน
  phone: string;
  address: AddressDetails;
  service: string;
  price: number;
  priceNote?: string;
  // ค่าใช้จ่ายเพิ่มหน้างานที่ลูกค้ายอมรับแล้ว (เช่น ค่าเคลียร์เศษวัสดุ)
  extraCharges?: number;
  // รูปสนามหญ้าที่ลูกค้าแนบตอนจอง
  photos?: string[];
  workStage?: WorkStage;
  completedAt?: string;
  // Escrow: เงินที่ลูกค้าจ่ายพักไว้ในระบบ จนกว่าช่างจะกดโอนออก
  payoutReleasedAt?: string;
  status: string;
};

// คำขอปรับราคาหน้างาน (PRD 6.7 QuoteAdjustment)
export type QuoteAdjustment = {
  id: number;
  jobId: number;
  oldAmount: number;
  newAmount: number;
  newArea: number;
  newGrassHeight: number;
  newExtraCharges: number;
  reasons: string[];
  note: string;
  requestedBy: 'mechanic';
  customerDecision: 'pending' | 'accepted' | 'rejected' | 'expired';
  // ยอมรับแล้วแต่ราคาสูงขึ้น ต้องชำระส่วนต่างก่อนงานดำเนินต่อ
  settlement?: 'awaiting_payment' | 'paid_difference' | 'refunded' | 'no_change';
  createdAt: string;
  decidedAt?: string;
  // ลูกค้าไม่ตอบภายในเวลานี้ คำขอหมดอายุ (1 ชั่วโมงหลังส่ง)
  expiresAt: string;
};

// ขั้นตอนการทำงานของช่างหลังรับงาน
export type WorkStage = 'matched' | 'arrived' | 'working' | 'done';

export type AppNotification = {
  id: number;
  jobId?: number;
  // ผู้รับแจ้งเตือน (ไม่ระบุ = ลูกค้า)
  audience?: 'customer' | 'worker';
  kind: 'arrived' | 'started' | 'completed' | 'info';
  message: string;
  createdAt: string;
  read: boolean;
};

export type Review = { jobId: number; rating: number; comment: string; createdAt: string };

// งานตัวอย่างใน Job Pool (ตัวอย่างหน้าจอ แทนข้อมูลจากเซิร์ฟเวอร์)
export const sampleJobs: Job[] = [
  { id: 1, title: 'งานบ้านหลังใหม่', area: 120, grassHeight: 0, isMonthly: false, date: isoDateFromToday(0), time: '15:00', firstName: 'นุช', lastName: 'สายสวน', phone: '0812345601', address: { addressLine: '45/7 หมู่บ้านพฤกษา ถนนรัตนาธิเบศร์', province: 'นนทบุรี', amphoe: 'เมืองนนทบุรี', district: 'บางกระสอ', location: { lat: 13.8612, lng: 100.5021 } }, service: 'ตัดหญ้าอย่างเดียว ไม่ขนทิ้ง', price: 840, status: 'รอรับงาน' },
  { id: 2, title: 'สวนคอนโด', area: 90, grassHeight: 0, isMonthly: false, date: isoDateFromToday(1), time: '08:30', firstName: 'มานะ', lastName: 'ตั้งใจ', phone: '0898765402', address: { addressLine: '88 ถนนสุขุมวิท 71', province: 'กรุงเทพมหานคร', amphoe: 'วัฒนา', district: 'คลองตันเหนือ', location: { lat: 13.7286, lng: 100.5998 } }, service: 'ตัดหญ้าและแต่งกิ่ง ไม่ขนทิ้ง', price: 1000, status: 'VIP priority' },
  { id: 3, title: 'บ้านแฝด', area: 150, grassHeight: 1, isMonthly: false, date: isoDateFromToday(1), time: '12:00', firstName: 'ฐิติมา', lastName: 'ร่มเย็น', phone: '0863334403', address: { addressLine: '19/3 ถนนแจ้งวัฒนะ', province: 'กรุงเทพมหานคร', amphoe: 'หลักสี่', district: 'ทุ่งสองห้อง', location: { lat: 13.8847, lng: 100.5646 } }, service: 'ตัดหญ้าอย่างเดียว ขนทิ้ง', price: 1725, status: 'ระยะใกล้' },
  { id: 4, title: 'บ้านเดี่ยวริมคลอง', area: 200, grassHeight: 0, isMonthly: false, date: isoDateFromToday(5), time: '09:00', firstName: 'สมศรี', lastName: 'ใบไม้', phone: '0927778804', address: { addressLine: '7 ซอยงามวงศ์วาน 23', province: 'นนทบุรี', amphoe: 'เมืองนนทบุรี', district: 'บางเขน', location: { lat: 13.8486, lng: 100.5386 } }, service: 'ตัดหญ้าและแต่งกิ่ง ขนทิ้ง', price: 1600, status: 'รอรับงาน' },
];
