import type { AddressDetails } from './address';

export type WorkerStatus = 'pending_verification' | 'verified' | 'rejected';

export type WorkerProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  serviceRadiusKm: number;
  baseAddress: AddressDetails;
  idCardFileName: string;
  // รูปโปรไฟล์ (ย่อขนาดแล้ว) แสดงให้ลูกค้าเห็นเมื่อรับงาน
  photoDataUrl?: string;
  status: WorkerStatus;
  rejectReason?: string;
  reviewedAt?: string;
  submittedAt: string;
};

// ตัวอย่างหน้าจอ: เก็บข้อมูลการสมัครไว้ในเบราว์เซอร์แทนการส่งไปยังเซิร์ฟเวอร์
const storageKey = 'lawnflow-worker-profile';

export function loadWorkerProfile(): WorkerProfile | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as WorkerProfile) : null;
  } catch {
    return null;
  }
}

export function saveWorkerProfile(profile: WorkerProfile) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(profile));
  } catch {
    // ไม่สามารถบันทึกได้ (เช่น private mode) — หน้าสมัครยังแสดงผลสำเร็จตามปกติ
  }
}

// แอดมินอนุมัติ/ปฏิเสธใบสมัครช่างที่บันทึกไว้ในเบราว์เซอร์นี้
export function updateWorkerProfileStatus(status: WorkerStatus, rejectReason?: string) {
  const profile = loadWorkerProfile();
  if (!profile) return null;
  const updated: WorkerProfile = { ...profile, status, rejectReason, reviewedAt: new Date().toISOString() };
  saveWorkerProfile(updated);
  return updated;
}
