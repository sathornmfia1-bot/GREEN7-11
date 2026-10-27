import type { ReviewStatus, ReviewTopic } from './review';
import type { AddressDetails } from '../_components/address';

// ชนิดข้อมูลที่ใช้ร่วมกันระหว่างหน้าเว็บ (client) และเซิร์ฟเวอร์ — แปลงมาจากตารางใน Supabase (ดู database.md)

export type WorkStage = 'matched' | 'arrived' | 'working' | 'done';

export type Job = {
  id: string;
  customerId: string;
  mechanicId?: string;
  title: string;
  area: number;
  grassHeight: number;
  isMonthly: boolean;
  date: string;
  time?: string;
  firstName: string;
  lastName: string;
  // ช่างเห็นเบอร์ลูกค้าเฉพาะงานที่รับแล้ว (งานใน Job Pool เป็นค่าว่าง)
  phone: string;
  address: AddressDetails;
  service: string;
  price: number;
  priceNote?: string;
  extraCharges?: number;
  photos?: string[];
  // รูปงานที่เสร็จแล้ว (ช่างแนบตอนกด "ทำงานเสร็จแล้ว") · โหลดแยกจากข้อมูลหลักเหมือน photos
  completionPhotos?: string[];
  workStage?: WorkStage;
  completedAt?: string;
  payoutReleasedAt?: string;
  bookedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  refundNote?: string;
  status: string;
  bookingId?: string;
  // แพ็กเกจรายเดือน: นัดที่เท่าไรจากทั้งหมด และงานที่เสนอให้ช่างประจำก่อน (ถึงเวลา offerExpiresAt)
  visitNo?: number;
  visitCount?: number;
  offeredToMe?: boolean;
  offerExpiresAt?: string;
};

// นัดของแพ็กเกจรายเดือน (ลูกค้าเห็นของตัวเอง) · jobId มีเมื่อสร้างงานแล้ว
export type PackageVisit = {
  id: string;
  bookingId: string;
  visitNo: number;
  cycleNo: number;
  cycleStart: string;
  cycleEnd: string;
  date: string;
  amount: number;
  status: 'scheduled' | 'released' | 'cancelled';
  jobId?: string;
};

export type QuoteAdjustment = {
  id: string;
  jobId: string;
  oldAmount: number;
  newAmount: number;
  newArea: number;
  newGrassHeight: number;
  newExtraCharges: number;
  reasons: string[];
  note: string;
  requestedBy: 'mechanic';
  customerDecision: 'pending' | 'accepted' | 'rejected' | 'expired';
  settlement?: 'awaiting_payment' | 'paid_difference' | 'refunded' | 'no_change';
  createdAt: string;
  decidedAt?: string;
  expiresAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  jobId?: string;
  kind: 'arrived' | 'started' | 'completed' | 'info';
  message: string;
  createdAt: string;
  read: boolean;
};

export type Review = {
  jobId: string;
  customerId: string;
  mechanicId: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: ReviewStatus;
  topics: Partial<Record<ReviewTopic, number>>;
  issues: string[];
};

export type Inspection = {
  jobId: string;
  beforeUrl?: string;
  afterUrl?: string;
  completeness: number;
  estimatedArea: number;
  grassHeight: number;
  debrisHours: number;
  createdAt: string;
};

export type ServiceAddress = { id: string; label: string; details: AddressDetails; isDefault: boolean };

export type CustomerAccount = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addresses: ServiceAddress[];
  createdAt: string;
};

export type MechanicStatus = 'pending_verification' | 'verified' | 'rejected';

export type MechanicAccount = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  photoDataUrl?: string;
  bankName: string;
  // เก็บเฉพาะ 4 หลักท้ายในหน้าเว็บ (เลขเต็มเข้ารหัสในฐานข้อมูล)
  accountLast4: string;
  accountName: string;
  serviceRadiusKm: number;
  // เครื่องมือที่ใช้ (ค่าใน app/_lib/equipment.ts) · ว่างถ้ายังไม่ได้รัน migration หรือสมัครก่อนมีช่องนี้
  equipment: string[];
  // ชื่อองค์กร (ไม่บังคับ) และจำนวนสมาชิกช่างตัดหญ้า (รวมตัวผู้สมัคร)
  organizationName?: string;
  teamSize?: number;
  baseAddress: AddressDetails;
  idCardFileName: string;
  status: MechanicStatus;
  rejectReason?: string;
  reviewedAt?: string;
  submittedAt: string;
  ratingAverage: number;
  ratingCount: number;
  completedJobsCount: number;
};

export type AdminAccount = { id: string; firstName: string; lastName: string; phone: string };

// ข้อมูลที่หน้าเว็บของแต่ละ role ได้รับ (เซิร์ฟเวอร์กรองตามสิทธิ์แล้ว)
export type Snapshot = {
  customers: CustomerAccount[];
  mechanics: MechanicAccount[];
  admins: AdminAccount[];
  jobs: Job[];
  adjustments: QuoteAdjustment[];
  notifications: AppNotification[];
  reviews: Review[];
  inspections: Inspection[];
  visits?: PackageVisit[];
};

export type Result = { ok: boolean; message: string };

export const emptySnapshot: Snapshot = { customers: [], mechanics: [], admins: [], jobs: [], adjustments: [], notifications: [], reviews: [], inspections: [] };
