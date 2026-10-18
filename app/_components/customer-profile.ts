import type { AddressDetails } from './address';

export type CustomerProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  phoneVerified: true;
  status: 'active';
  addressLabel: string;
  address: AddressDetails;
  createdAt: string;
};

// ตัวอย่างหน้าจอ: เก็บข้อมูลบัญชีไว้ในเบราว์เซอร์แทนการส่งไปยังเซิร์ฟเวอร์ (ไม่เก็บรหัสผ่าน)
const storageKey = 'lawnflow-customer-profile';

export function loadCustomerProfile(): CustomerProfile | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as CustomerProfile) : null;
  } catch {
    return null;
  }
}

export function saveCustomerProfile(profile: CustomerProfile) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(profile));
  } catch {
    // ไม่สามารถบันทึกได้ (เช่น private mode) — หน้าลงทะเบียนยังแสดงผลสำเร็จตามปกติ
  }
}
