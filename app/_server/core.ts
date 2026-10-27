import 'server-only';
import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '../_lib/session';
import type { AppNotification, Job, MechanicAccount, QuoteAdjustment, WorkStage } from '../_lib/types';

// เซิร์ฟเวอร์เท่านั้น: เชื่อม Supabase ด้วย service role (ข้าม RLS) แล้วตรวจสิทธิ์เองตามเซสชันจำลองของแต่ละ role
let adminClient: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // บอกชื่อตัวแปรที่ขาดให้ชัด (ไม่แสดงค่า) — บนเครื่องตั้งใน .env.local · บน Vercel ตั้งใน Settings → Environment Variables แล้ว Redeploy
  const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(', ');
  if (!url || !key) throw new Error(`ไม่พบตัวแปร ${missing} (บนเครื่อง: .env.local · บน Vercel: Settings → Environment Variables → ติ๊ก Production แล้ว Redeploy)`);
  adminClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

export class AccessError extends Error {}

export type UserRow = { id: string; role: Role; first_name: string; last_name: string; phone: string; email: string | null; created_at: string };

// ผู้ใช้จากเซสชันของ role นี้เท่านั้น — เซสชันของ role อื่นใช้แทนไม่ได้
export async function requireUser(role: Role): Promise<UserRow> {
  const id = (await cookies()).get(`lawnflow_session_${role}`)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AccessError('กรุณาเข้าสู่ระบบใหม่');
  const { data } = await sb().from('users').select('id, role, first_name, last_name, phone, email, created_at').eq('id', id).eq('role', role).maybeSingle();
  if (!data) throw new AccessError('กรุณาเข้าสู่ระบบใหม่');
  return data as UserRow;
}

export function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

// ---------------------------------------------------------------------------
// แจ้งเตือน
// ---------------------------------------------------------------------------
export type NotificationType =
  | 'job_matched' | 'mechanic_arrived' | 'work_started' | 'work_completed_review_request'
  | 'adjustment_requested' | 'adjustment_accepted' | 'adjustment_rejected' | 'adjustment_expired' | 'adjustment_difference_paid'
  | 'job_cancelled_by_customer' | 'job_cancelled_by_mechanic' | 'refund_completed' | 'payout_completed'
  | 'verification_approved' | 'verification_rejected' | 'booking_paid' | 'review_received' | 'visit_offered' | 'visit_rescheduled';

export async function notify(userId: string, type: NotificationType, message: string, jobId?: string) {
  const { error } = await sb().from('notifications').insert({ user_id: userId, type, title: message.slice(0, 200), job_id: jobId ?? null });
  // แจ้งเตือนไม่สำเร็จไม่ควรทำให้งานหลักล้มเหลว (เช่น ยังไม่ได้รัน migration ประเภทแจ้งเตือนใหม่)
  if (error) console.warn(`notify(${type}) failed: ${error.message}`);
}

const kindOf: Partial<Record<string, AppNotification['kind']>> = {
  mechanic_arrived: 'arrived',
  work_started: 'started',
  work_completed_review_request: 'completed',
};

export function toNotification(row: { id: string; user_id: string; job_id: string | null; type: string; title: string; created_at: string; read_at: string | null }): AppNotification {
  return { id: row.id, userId: row.user_id, jobId: row.job_id ?? undefined, kind: kindOf[row.type] ?? 'info', message: row.title, createdAt: row.created_at, read: Boolean(row.read_at) };
}

// ---------------------------------------------------------------------------
// แปลงแถวในฐานข้อมูลเป็นข้อมูลที่หน้าเว็บใช้
// ---------------------------------------------------------------------------
// ไม่รวมรูปสนามหญ้า (เก็บเป็น data URL ขนาดใหญ่) — โหลดแยกด้วย jobPhotosSelect เฉพาะงานที่หน้าเว็บยังไม่มี
export const jobSelect = `id, booking_id, customer_id, mechanic_id, title, is_monthly, service_name, area_sq_wah, grass_height_level, appointment_date, appointment_time,
  address_line, province, amphoe, district, zipcode, lat, lng, quote_amount, extra_charges, final_amount, status, completed_at, cancelled_at, cancelled_by, created_at,
  customer:users!jobs_customer_id_fkey(first_name, last_name, phone),
  booking:bookings!jobs_booking_id_fkey(pricing_mode, prepaid_months),
  settlement:job_settlements(status, released_at),
  refunds(amount, bank_name, bank_account_last4, bank_account_name)`;
export const jobPhotosSelect = 'id, booking:bookings!jobs_booking_id_fkey(booking_photos(url, sort_order))';

type One<T> = T | T[] | null;
const first = <T>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);
const num = (value: unknown) => Number(value ?? 0);
const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

const stageOf: Partial<Record<string, WorkStage>> = { matched: 'matched', arrived: 'arrived', working: 'working', completed: 'done', closed: 'done' };
const statusLabel: Record<string, string> = { open: 'รอรับงาน', matched: 'จับคู่ช่างแล้ว', arrived: 'ถึงที่นัดหมายแล้ว', working: 'กำลังทำงาน', completed: 'ทำงานเสร็จแล้ว', closed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิกแล้ว' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJobPhotos(row: any): string[] {
  const booking = first(row.booking) as { booking_photos: { url: string; sort_order: number }[] } | null;
  return (booking?.booking_photos ?? []).sort((a, b) => a.sort_order - b.sort_order).map((photo) => photo.url);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJob(row: any, options: { showPhone: boolean }): Job {
  const customer = first(row.customer) as { first_name: string; last_name: string; phone: string } | null;
  const booking = first(row.booking) as { pricing_mode: string; prepaid_months: number | null } | null;
  const settlement = first(row.settlement) as { status: string; released_at: string | null } | null;
  const refund = first(row.refunds) as { amount: number; bank_name: string | null; bank_account_last4: string | null; bank_account_name: string | null } | null;
  const price = num(row.final_amount);
  const adjusted = price !== num(row.quote_amount);
  return {
    id: row.id,
    customerId: row.customer_id,
    mechanicId: row.mechanic_id ?? undefined,
    title: row.title ?? (row.is_monthly ? 'งานแพ็กเกจรายเดือน' : 'งานจ่ายครั้งเดียว'),
    area: num(row.area_sq_wah),
    grassHeight: num(row.grass_height_level),
    isMonthly: row.is_monthly,
    date: row.appointment_date,
    time: row.appointment_time ? String(row.appointment_time).slice(0, 5) : undefined,
    firstName: customer?.first_name ?? '',
    lastName: customer?.last_name ?? '',
    phone: options.showPhone ? customer?.phone ?? '' : '',
    address: {
      addressLine: row.address_line, province: row.province, amphoe: row.amphoe, district: row.district ?? '',
      location: row.lat !== null && row.lng !== null ? { lat: num(row.lat), lng: num(row.lng) } : undefined,
    },
    service: row.service_name,
    price,
    priceNote: adjusted ? 'ปรับราคาหน้างานแล้ว' : booking?.pricing_mode === 'monthly' && booking.prepaid_months ? `ชำระล่วงหน้า ${booking.prepaid_months} เดือน` : undefined,
    extraCharges: num(row.extra_charges),
    workStage: stageOf[row.status],
    completedAt: row.completed_at ?? undefined,
    payoutReleasedAt: settlement?.status === 'released' ? settlement.released_at ?? undefined : undefined,
    bookedAt: row.created_at,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    refundNote: refund ? `คืนเงิน ฿${money(num(refund.amount))} เข้า ${refund.bank_name} xxx-${refund.bank_account_last4} (${refund.bank_account_name})` : undefined,
    status: statusLabel[row.status] ?? row.status,
    bookingId: row.booking_id,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAdjustment(row: any): QuoteAdjustment {
  return {
    id: row.id, jobId: row.job_id, oldAmount: num(row.old_amount), newAmount: num(row.new_amount), newArea: num(row.new_area_sq_wah),
    newGrassHeight: num(row.new_grass_height_level), newExtraCharges: num(row.new_extra_charges), reasons: row.reasons ?? [], note: row.note ?? '',
    requestedBy: 'mechanic', customerDecision: row.customer_decision, settlement: row.settlement ?? undefined,
    createdAt: row.created_at, decidedAt: row.decided_at ?? undefined, expiresAt: row.expires_at,
  };
}

export const mechanicSelect = `user_id, photo_url, id_card_image_url, bank_name, bank_account_last4, bank_account_name, service_radius_km,
  base_address_line, base_province, base_amphoe, base_district, base_lat, base_lng, verification_status, reject_reason, reviewed_at, submitted_at,
  rating_average, rating_count, completed_jobs_count, user:users!mechanic_profiles_user_id_fkey(first_name, last_name, phone)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMechanic(row: any, options: { full: boolean }): MechanicAccount {
  const user = first(row.user) as { first_name: string; last_name: string; phone: string } | null;
  return {
    id: row.user_id,
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    phone: options.full ? user?.phone ?? '' : '',
    photoDataUrl: row.photo_url || undefined,
    bankName: options.full ? row.bank_name : '',
    accountLast4: options.full ? row.bank_account_last4 : '',
    accountName: options.full ? row.bank_account_name : '',
    serviceRadiusKm: row.service_radius_km,
    equipment: [],
    baseAddress: options.full
      ? { addressLine: row.base_address_line, province: row.base_province, amphoe: row.base_amphoe, district: row.base_district ?? '', location: { lat: num(row.base_lat), lng: num(row.base_lng) } }
      : { addressLine: '', province: '', amphoe: '', district: '' },
    idCardFileName: options.full ? row.id_card_image_url : '',
    status: row.verification_status,
    rejectReason: row.reject_reason ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    submittedAt: row.submitted_at,
    ratingAverage: num(row.rating_average),
    ratingCount: num(row.rating_count),
    completedJobsCount: num(row.completed_jobs_count),
  };
}

// ---------------------------------------------------------------------------
// ตารางราคาจากฐานข้อมูล (คำนวณราคาฝั่งเซิร์ฟเวอร์ ไม่เชื่อตัวเลขจากเบราว์เซอร์)
// ---------------------------------------------------------------------------
export async function loadPricing() {
  const [services, levels, packages, settings] = await Promise.all([
    sb().from('service_types').select('code, name, base_price, base_area_wa, extra_per_wa').eq('is_active', true),
    sb().from('grass_height_levels').select('level, label, multiplier'),
    sb().from('monthly_packages').select('code, name, base_price, base_area_wa, extra_per_wa').eq('is_active', true),
    sb().from('platform_settings').select('key, value'),
  ]);
  const setting = (key: string, fallback: number) => {
    const row = must(settings).find((item: { key: string }) => item.key === key) as { value: unknown } | undefined;
    return row ? Number(row.value) : fallback;
  };
  const serviceRows = must(services) as { code: string; name: string; base_price: number; base_area_wa: number; extra_per_wa: number }[];
  const levelRows = must(levels) as { level: number; label: string; multiplier: number }[];
  // ยังไม่ได้รัน migration แพ็กเกจใหม่ (ไม่มีคอลัมน์ base_price / is_active) → ยังไม่มีแพ็กเกจให้เลือก แต่จ่ายครั้งเดียวใช้ได้ตามปกติ
  const packagesMissing = packages.error && ['42703', 'PGRST204'].includes((packages.error as { code?: string }).code ?? '');
  const packageRows = (packagesMissing ? [] : must(packages)) as { code: string; name: string; base_price: number; base_area_wa: number; extra_per_wa: number }[];

  function pricePerVisit(serviceCode: string, area: number, grassLevel: number) {
    const service = serviceRows.find((item) => item.code === serviceCode);
    const level = levelRows.find((item) => item.level === grassLevel);
    if (!service || !level) throw new Error('ไม่พบประเภทบริการหรือระดับความสูงหญ้า');
    return Math.round((num(service.base_price) + Math.max(area - service.base_area_wa, 0) * num(service.extra_per_wa)) * num(level.multiplier));
  }

  // แพ็กเกจรายเดือน: ราคาต่อครั้งไม่คิดตัวคูณความสูงหญ้า
  function packageVisitPrice(packageCode: string, area: number) {
    const pack = packageRows.find((item) => item.code === packageCode);
    if (!pack) throw new Error('ไม่พบแพ็กเกจ');
    return Math.round(num(pack.base_price) + Math.max(area - pack.base_area_wa, 0) * num(pack.extra_per_wa));
  }

  return {
    services: serviceRows,
    packages: packageRows,
    pricePerVisit,
    packageVisitPrice,
    platformFeePercent: setting('platform_fee_percent', 15),
    escrowReleaseDays: setting('escrow_release_days', 2),
    adjustmentExpiryMinutes: setting('adjustment_expiry_minutes', 60),
    maxLawnPhotos: setting('max_lawn_photos', 10),
  };
}
