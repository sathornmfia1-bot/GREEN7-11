'use server';

import { AccessError, jobPhotosSelect, jobSelect, loadPricing, mechanicSelect, must, notify, requireUser, sb, toAdjustment, toJob, toJobPhotos, toMechanic, toNotification, type UserRow } from './core';
import type { AddressDetails } from '../_components/address';
import { hashSecret, lockMinutes, maxFailedAttempts, maxResetAttempts, passwordProblem, resetCodeMinutes, sixDigitCode, verifySecret } from './password';
import { overallRating, reviewProblem, reviewStatuses, type ReviewInput } from '../_lib/review';
import type { Role } from '../_lib/session';
import type { CustomerAccount, Inspection, Result, ServiceAddress, Snapshot } from '../_lib/types';

// ทุกฟังก์ชันในไฟล์นี้ทำงานบนเซิร์ฟเวอร์ ตรวจเซสชันของ role ที่เกี่ยวข้อง แล้วอ่าน/เขียน Supabase
// ระบบล็อกอินเป็นแบบจำลอง (OTP แสดงบนหน้าจอ) แต่ข้อมูลทั้งหมดเก็บในฐานข้อมูลจริง

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });
const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

async function guard<T extends Result>(run: () => Promise<T>): Promise<T | Result> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AccessError) return fail(error.message);
    console.error(error);
    return fail(`เกิดข้อผิดพลาด: ${(error as Error).message}`);
  }
}

// วันที่ตามเวลาไทย (yyyy-mm-dd) และจำนวนวันจากวันนี้
function bangkokToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}
function daysFromToday(isoDate: string) {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${bangkokToday()}T00:00:00Z`)) / 86400000);
}
const hex = (value: string) => `\\x${Buffer.from(value, 'utf8').toString('hex')}`;
const digitsOf = (value: string) => value.replace(/\D/g, '');

// ---------------------------------------------------------------------------
// ข้อมูลสำหรับหน้าเว็บของแต่ละ role (กรองตามสิทธิ์)
// ---------------------------------------------------------------------------
export async function loadSnapshot(role: Role): Promise<{ ok: true; data: Snapshot } | { ok: false; message: string; auth: boolean }> {
  try {
    const me = await requireUser(role);
    if (role !== 'admin') await expireAdjustmentsNow();
    if (role === 'customer') return { ok: true, data: await customerSnapshot(me) };
    if (role === 'mechanic') return { ok: true, data: await mechanicSnapshot(me) };
    return { ok: true, data: await adminSnapshot() };
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, message: error.message, auth: true };
    console.error(error);
    return { ok: false, message: (error as Error).message, auth: false };
  }
}

// รูปสนามหญ้าของงาน (ข้อมูลใหญ่) โหลดแยกเฉพาะงานที่ระบุ ด้วยสิทธิ์เดียวกับ loadSnapshot · null = โหลดไม่สำเร็จ
export async function loadJobPhotos(role: Role, jobIds: string[]): Promise<Record<string, string[]> | null> {
  const ids = jobIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  if (!ids.length) return {};
  try {
    const me = await requireUser(role);
    let query = sb().from('jobs').select(jobPhotosSelect).in('id', ids);
    if (role === 'customer') query = query.eq('customer_id', me.id);
    if (role === 'mechanic') query = query.or(`mechanic_id.eq.${me.id},and(status.eq.open,cancelled_at.is.null)`);
    const rows = must(await query) as { id: string }[];
    return Object.fromEntries(rows.map((row) => [row.id, toJobPhotos(row)]));
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function addressesOf(userIds: string[]) {
  if (!userIds.length) return [];
  return must(await sb().from('service_addresses').select('*').in('user_id', userIds).is('deleted_at', null).order('created_at')) as Record<string, never>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCustomer(user: any, addressRows: any[]): CustomerAccount {
  return {
    id: user.id, firstName: user.first_name, lastName: user.last_name, phone: user.phone, email: user.email ?? '', createdAt: user.created_at,
    addresses: addressRows.filter((row) => row.user_id === user.id).map((row) => ({
      id: row.id, label: row.label, isDefault: row.is_default,
      details: { addressLine: row.address_line, province: row.province, amphoe: row.amphoe, district: row.district ?? '', location: row.lat !== null && row.lng !== null ? { lat: Number(row.lat), lng: Number(row.lng) } : undefined },
    })),
  };
}

async function related(jobIds: string[]) {
  if (!jobIds.length) return { adjustments: [], reviews: [] };
  const [adjustments, reviews] = await Promise.all([
    sb().from('quote_adjustments').select('*').in('job_id', jobIds).order('created_at'),
    // select('*') ให้ใช้ได้ทั้งก่อนและหลังรัน migration หัวข้อรีวิว
    sb().from('reviews').select('*').in('job_id', jobIds),
  ]);
  return {
    adjustments: must(adjustments).map(toAdjustment),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reviews: must(reviews).map((row: any) => ({
      jobId: row.job_id, customerId: row.customer_id, mechanicId: row.mechanic_id, rating: row.rating, comment: row.comment ?? '', createdAt: row.created_at,
      status: row.status ?? 'complete',
      topics: { cleanliness: row.cleanliness_rating ?? undefined, punctuality: row.punctuality_rating ?? undefined, service: row.service_rating ?? undefined },
      issues: row.issues ?? [],
    })),
  };
}

async function notificationsOf(userId: string) {
  return must(await sb().from('notifications').select('id, user_id, job_id, type, title, created_at, read_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)).map(toNotification);
}

async function customerSnapshot(me: UserRow): Promise<Snapshot> {
  const jobRows = must(await sb().from('jobs').select(jobSelect).eq('customer_id', me.id).order('appointment_date'));
  const jobs = jobRows.map((row) => toJob(row, { showPhone: true }));
  const mechanicIds = [...new Set(jobs.map((job) => job.mechanicId).filter((id): id is string => Boolean(id)))];
  const [addressRows, mechanicRows, extra, notifications] = await Promise.all([
    addressesOf([me.id]),
    mechanicIds.length ? sb().from('mechanic_profiles').select(mechanicSelect).in('user_id', mechanicIds).then(must) : Promise.resolve([]),
    related(jobs.map((job) => job.id)),
    notificationsOf(me.id),
  ]);
  return {
    customers: [toCustomer(me, addressRows)],
    // ลูกค้าเห็นเฉพาะชื่อ รูป และเรทติ้งของช่างที่รับงานตัวเอง
    mechanics: mechanicRows.map((row) => toMechanic(row, { full: false })),
    admins: [], jobs, ...extra, notifications, inspections: [],
  };
}

async function mechanicSnapshot(me: UserRow): Promise<Snapshot> {
  const [profile, jobRows] = await Promise.all([
    sb().from('mechanic_profiles').select(mechanicSelect).eq('user_id', me.id).single().then(must),
    // งานของฉัน + งานที่ยังไม่มีช่างรับ
    sb().from('jobs').select(jobSelect).or(`mechanic_id.eq.${me.id},and(status.eq.open,cancelled_at.is.null)`).order('appointment_date').then(must),
  ]);
  // เบอร์โทรลูกค้าแสดงเฉพาะงานที่ช่างคนนี้รับแล้ว
  const jobs = jobRows.map((row: { mechanic_id: string | null }) => toJob(row, { showPhone: row.mechanic_id === me.id }));
  const myJobIds = jobs.filter((job) => job.mechanicId === me.id).map((job) => job.id);
  const [extra, notifications, inspections] = await Promise.all([related(myJobIds), notificationsOf(me.id), inspectionsOf(myJobIds)]);
  return { customers: [], mechanics: [toMechanic(profile, { full: true })], admins: [], jobs, ...extra, notifications, inspections };
}

async function adminSnapshot(): Promise<Snapshot> {
  const [users, mechanicRows, jobRows] = await Promise.all([
    sb().from('users').select('id, role, first_name, last_name, phone, email, created_at').order('created_at').then(must),
    sb().from('mechanic_profiles').select(mechanicSelect).order('submitted_at', { ascending: false }).then(must),
    sb().from('jobs').select(jobSelect).order('appointment_date').then(must),
  ]);
  const customerUsers = users.filter((user: { role: string }) => user.role === 'customer');
  const addressRows = await addressesOf(customerUsers.map((user: { id: string }) => user.id));
  const jobs = jobRows.map((row) => toJob(row, { showPhone: true }));
  const extra = await related(jobs.map((job) => job.id));
  return {
    customers: customerUsers.map((user) => toCustomer(user, addressRows)),
    mechanics: mechanicRows.map((row) => toMechanic(row, { full: true })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admins: users.filter((user: any) => user.role === 'admin').map((user: any) => ({ id: user.id, firstName: user.first_name, lastName: user.last_name, phone: user.phone })),
    jobs, ...extra, notifications: [], inspections: [],
  };
}

async function inspectionsOf(jobIds: string[]): Promise<Inspection[]> {
  if (!jobIds.length) return [];
  const rows = must(await sb().from('ai_inspections')
    .select('job_id, completeness_percent, estimated_area_sq_wah, detected_grass_height_level, estimated_debris_hours, created_at, before:inspection_photos!ai_inspections_before_photo_id_fkey(url), after:inspection_photos!ai_inspections_after_photo_id_fkey(url)')
    .in('job_id', jobIds).order('created_at', { ascending: false }));
  const latest = new Map<string, Inspection>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows.forEach((row: any) => {
    if (latest.has(row.job_id)) return;
    const pick = (value: { url: string } | { url: string }[] | null) => (Array.isArray(value) ? value[0]?.url : value?.url);
    latest.set(row.job_id, {
      jobId: row.job_id, beforeUrl: pick(row.before), afterUrl: pick(row.after), completeness: row.completeness_percent,
      estimatedArea: row.estimated_area_sq_wah, grassHeight: row.detected_grass_height_level, debrisHours: row.estimated_debris_hours, createdAt: row.created_at,
    });
  });
  return [...latest.values()];
}

// ---------------------------------------------------------------------------
// เข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่าน (hash เก็บในตาราง user_credentials)
// ---------------------------------------------------------------------------
export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'not_registered' | 'no_password' | 'locked' | 'not_ready' | 'error'; message: string };

const credentialsNotReady = 'ระบบรหัสผ่านยังไม่พร้อม · แอดมินต้องรัน supabase/migrations/20261021000000_passwords.sql ใน Supabase SQL Editor';
// ตารางยังไม่ถูกสร้าง (ยังไม่ได้รัน migration)
const missingTable = (error: { code?: string } | null) => error?.code === 'PGRST205' || error?.code === '42P01';

function roleLabelOf(role: Role) {
  return { customer: 'ลูกค้า', mechanic: 'ช่างตัดหญ้า', admin: 'แอดมิน' }[role];
}

async function accountByPhone(role: Role, phone: string) {
  const { data } = await sb().from('users').select('id').eq('phone', digitsOf(phone)).eq('role', role).maybeSingle();
  return data as { id: string } | null;
}

export async function loginWithPassword(role: Role, phone: string, password: string): Promise<LoginResult> {
  try {
    if (!/^0\d{9}$/.test(digitsOf(phone)) || !password) return { ok: false, reason: 'invalid', message: 'กรุณากรอกเบอร์โทร 10 หลักและรหัสผ่าน' };
    const user = await accountByPhone(role, phone);
    if (!user) return { ok: false, reason: 'not_registered', message: `เบอร์นี้ยังไม่ได้ลงทะเบียนเป็น${roleLabelOf(role)}` };
    const { data: credential, error } = await sb().from('user_credentials').select('password_hash, failed_attempts, locked_until').eq('user_id', user.id).maybeSingle();
    if (missingTable(error)) return { ok: false, reason: 'not_ready', message: credentialsNotReady };
    if (error) throw error;
    if (!credential) return { ok: false, reason: 'no_password', message: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณากด “ลืมหรือยังไม่เคยตั้งรหัสผ่าน?”' };
    if (credential.locked_until && Date.parse(credential.locked_until) > Date.now()) {
      return { ok: false, reason: 'locked', message: `ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ ${lockMinutes} นาที หรือตั้งรหัสผ่านใหม่` };
    }
    if (!(await verifySecret(password, credential.password_hash))) {
      const failed = credential.failed_attempts + 1;
      const locked = failed >= maxFailedAttempts;
      await sb().from('user_credentials').update({ failed_attempts: locked ? 0 : failed, locked_until: locked ? new Date(Date.now() + lockMinutes * 60000).toISOString() : null }).eq('user_id', user.id);
      return locked
        ? { ok: false, reason: 'locked', message: `ใส่รหัสผ่านผิด ${maxFailedAttempts} ครั้ง บัญชีถูกล็อก ${lockMinutes} นาที หรือตั้งรหัสผ่านใหม่` }
        : { ok: false, reason: 'invalid', message: `เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง (ใส่ได้อีก ${maxFailedAttempts - failed} ครั้ง)` };
    }
    if (credential.failed_attempts || credential.locked_until) await sb().from('user_credentials').update({ failed_attempts: 0, locked_until: null }).eq('user_id', user.id);
    return { ok: true, userId: user.id };
  } catch (error) {
    console.error(error);
    return { ok: false, reason: 'error', message: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่' };
  }
}

async function savePassword(userId: string, password: string) {
  const { error } = await sb().from('user_credentials').upsert({ user_id: userId, password_hash: await hashSecret(password), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() });
  if (missingTable(error)) throw new AccessError(credentialsNotReady);
  if (error) throw error;
}

// ลืม/ยังไม่เคยตั้งรหัสผ่าน ขั้นที่ 1: สร้างรหัสยืนยัน 6 หลัก (เก็บเป็น hash)
// โหมดทดสอบ: ยังไม่ส่ง SMS จริง จึงส่งรหัสกลับมาแสดงบนหน้าจอ (testCode) — เมื่อต่อ SMS แล้วให้ลบ testCode ออก
export async function requestPasswordReset(role: Role, phone: string): Promise<Result & { testCode?: string; validMinutes?: number }> {
  return guard(async () => {
    const user = await accountByPhone(role, phone);
    if (!user) return fail(`เบอร์นี้ยังไม่ได้ลงทะเบียนเป็น${roleLabelOf(role)}`);
    const code = sixDigitCode();
    const { error } = await sb().from('password_resets').upsert({ user_id: user.id, code_hash: await hashSecret(code), expires_at: new Date(Date.now() + resetCodeMinutes * 60000).toISOString(), attempts: 0, created_at: new Date().toISOString() });
    if (missingTable(error)) return fail(credentialsNotReady);
    if (error) throw error;
    return { ...ok(`ส่งรหัสยืนยันแล้ว ใช้ได้ ${resetCodeMinutes} นาที`), testCode: code, validMinutes: resetCodeMinutes };
  });
}

// ขั้นที่ 2: ตรวจรหัสยืนยัน แล้วตั้งรหัสผ่านใหม่ และเข้าสู่ระบบให้ทันที
export async function resetPassword(role: Role, phone: string, code: string, password: string): Promise<Result & { userId?: string }> {
  return guard(async () => {
    const problem = passwordProblem(password);
    if (problem) return fail(problem);
    const user = await accountByPhone(role, phone);
    if (!user) return fail(`เบอร์นี้ยังไม่ได้ลงทะเบียนเป็น${roleLabelOf(role)}`);
    const { data: reset, error } = await sb().from('password_resets').select('code_hash, expires_at, attempts').eq('user_id', user.id).maybeSingle();
    if (missingTable(error)) return fail(credentialsNotReady);
    if (error) throw error;
    if (!reset || Date.parse(reset.expires_at) < Date.now()) return fail('รหัสยืนยันหมดอายุ กรุณาขอรหัสใหม่');
    if (reset.attempts >= maxResetAttempts) return fail('ใส่รหัสยืนยันผิดหลายครั้ง กรุณาขอรหัสใหม่');
    if (!(await verifySecret(code, reset.code_hash))) {
      await sb().from('password_resets').update({ attempts: reset.attempts + 1 }).eq('user_id', user.id);
      return fail('รหัสยืนยันไม่ถูกต้อง');
    }
    await savePassword(user.id, password);
    await sb().from('password_resets').delete().eq('user_id', user.id);
    return { ...ok('ตั้งรหัสผ่านเรียบร้อย'), userId: user.id };
  });
}

export async function listTestAccounts(role: Role) {
  const users = must(await sb().from('users').select('id, first_name, last_name, phone').eq('role', role).order('created_at').limit(8));
  if (role !== 'mechanic') return users.map((user) => ({ ...user, status: undefined as string | undefined }));
  const statuses = must(await sb().from('mechanic_profiles').select('user_id, verification_status').in('user_id', users.map((user) => user.id)));
  return users.map((user) => ({ ...user, status: statuses.find((row) => row.user_id === user.id)?.verification_status as string | undefined }));
}

// ---------------------------------------------------------------------------
// ลงทะเบียน
// ---------------------------------------------------------------------------
async function createAccount(role: Role, user: { firstName: string; lastName: string; phone: string; email?: string; password: string }) {
  const phone = digitsOf(user.phone);
  if (!/^0\d{9}$/.test(phone)) throw new Error('เบอร์โทรไม่ถูกต้อง');
  const problem = passwordProblem(user.password);
  if (problem) throw new AccessError(problem);
  const { data: existing } = await sb().from('users').select('role').eq('phone', phone).maybeSingle();
  if (existing) throw new AccessError(existing.role === role ? 'เบอร์นี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ' : 'เบอร์นี้ใช้ลงทะเบียนบัญชีประเภทอื่นแล้ว');
  // บัญชีใน Supabase Auth (ยืนยันเบอร์แล้ว) — ยังไม่ใช้ล็อกอินจริง เตรียมไว้เมื่อเปลี่ยนเป็น OTP จริง
  const { data: auth, error } = await sb().auth.admin.createUser({ phone: `+66${phone.slice(1)}`, phone_confirm: true, user_metadata: { role } });
  if (error || !auth.user) throw new Error(error?.message ?? 'สร้างบัญชีไม่สำเร็จ');
  must(await sb().from('users').insert({ id: auth.user.id, role, first_name: user.firstName.trim(), last_name: user.lastName.trim(), phone, phone_verified: true, email: user.email?.trim() || null }));
  await savePassword(auth.user.id, user.password);
  return auth.user.id;
}

export async function registerCustomer(input: { firstName: string; lastName: string; phone: string; email: string; password: string; addressLabel: string; address: AddressDetails }) {
  return guard(async () => {
    const id = await createAccount('customer', input);
    const address = must(await sb().from('service_addresses').insert(addressRow(id, input.addressLabel, input.address, true)).select('id').single());
    must(await sb().from('customer_profiles').insert({ user_id: id, default_service_address_id: address.id }));
    return { ...ok('สมัครสมาชิกสำเร็จ'), id };
  });
}

export async function registerMechanic(input: { firstName: string; lastName: string; phone: string; password: string; bankName: string; accountNumber: string; accountName: string; serviceRadiusKm: number; baseAddress: AddressDetails; idCardFileName: string; photoDataUrl?: string }) {
  return guard(async () => {
    const base = input.baseAddress;
    if (!base.location) throw new Error('กรุณาปักหมุดที่อยู่ฐาน');
    const account = digitsOf(input.accountNumber);
    const id = await createAccount('mechanic', input);
    must(await sb().from('mechanic_profiles').insert({
      user_id: id, photo_url: input.photoDataUrl ?? '', id_card_image_url: input.idCardFileName,
      bank_name: input.bankName, bank_account_number_enc: hex(account), bank_account_last4: account.slice(-4), bank_account_name: input.accountName.trim() || `${input.firstName.trim()} ${input.lastName.trim()}`,
      service_radius_km: input.serviceRadiusKm,
      base_address_line: base.addressLine, base_province: base.province, base_amphoe: base.amphoe, base_district: base.district || null, base_lat: base.location.lat, base_lng: base.location.lng,
    }));
    return { ...ok('ส่งใบสมัครเรียบร้อย'), id };
  });
}

function addressRow(userId: string, label: string, details: AddressDetails, isDefault: boolean) {
  return {
    user_id: userId, label, is_default: isDefault, address_line: details.addressLine.trim(), province: details.province, amphoe: details.amphoe,
    district: details.district || null, lat: details.location?.lat ?? null, lng: details.location?.lng ?? null,
  };
}

// ---------------------------------------------------------------------------
// ลูกค้า
// ---------------------------------------------------------------------------
export type BookingInput = {
  mode: 'single' | 'monthly';
  serviceName: string;
  area: number;
  grassHeight: number;
  monthlyFrequency: number;
  sundayPackage: boolean;
  prepaidMonths: number;
  date: string;
  addressId: string;
  photos: string[];
};

export async function createBooking(input: BookingInput) {
  return guard(async () => {
    const me = await requireUser('customer');
    const pricing = await loadPricing();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || daysFromToday(input.date) < 0) return fail('กรุณาเลือกวันนัดหมายตั้งแต่วันนี้เป็นต้นไป');
    const area = Math.round(Number(input.area));
    if (!(area > 0)) return fail('กรุณากรอกพื้นที่ (ตารางวา)');
    if (input.photos.length > pricing.maxLawnPhotos || input.photos.some((url) => !url.startsWith('data:image/') || url.length > 600000)) return fail('รูปไม่ถูกต้องหรือมากเกินไป');
    const address = must(await sb().from('service_addresses').select('*').eq('id', input.addressId).eq('user_id', me.id).is('deleted_at', null).maybeSingle());
    if (!address) return fail('ไม่พบที่อยู่บริการ');

    // คำนวณราคาจากตารางราคาในฐานข้อมูล
    let serviceCode: string;
    let serviceName: string;
    let packageCode: string | null = null;
    let unitPrice: number;
    if (input.mode === 'single') {
      const service = pricing.services.find((item) => item.name === input.serviceName);
      if (!service) return fail('ไม่พบประเภทบริการ');
      serviceCode = service.code;
      serviceName = service.name;
      unitPrice = pricing.pricePerVisit(service.code, area, input.grassHeight);
    } else {
      if (![3, 6, 12].includes(input.prepaidMonths)) return fail('จำนวนเดือนที่ชำระล่วงหน้าไม่ถูกต้อง');
      const pack = input.sundayPackage
        ? pricing.packages.find((item) => item.fixed_monthly_price !== null)
        : pricing.packages.find((item) => item.visits_per_month === input.monthlyFrequency);
      if (!pack) return fail('ไม่พบแพ็กเกจ');
      packageCode = pack.code;
      if (pack.fixed_monthly_price !== null) {
        serviceCode = pricing.packages.find((item) => item.pricing_service_code)?.pricing_service_code ?? pricing.services[0].code;
        serviceName = pack.name;
        unitPrice = Number(pack.fixed_monthly_price);
      } else {
        serviceCode = pack.pricing_service_code!;
        const service = pricing.services.find((item) => item.code === serviceCode)!;
        serviceName = `${service.name} · ${pack.name}`;
        unitPrice = Math.round(pricing.pricePerVisit(serviceCode, area, input.grassHeight) * pack.visits_per_month! * (1 - Number(pack.discount_percent) / 100));
      }
    }
    const total = input.mode === 'monthly' ? unitPrice * input.prepaidMonths : unitPrice;

    const booking = must(await sb().from('bookings').insert({
      customer_id: me.id, service_address_id: address.id, pricing_mode: input.mode,
      service_type_code: input.mode === 'single' ? serviceCode : null, monthly_package_code: packageCode, prepaid_months: input.mode === 'monthly' ? input.prepaidMonths : null,
      area_sq_wah: area, grass_height_level: input.grassHeight, first_appointment_date: input.date, unit_price: unitPrice, total_amount: total,
      price_breakdown: { serviceCode, area, grassHeight: input.grassHeight, unitPrice, prepaidMonths: input.prepaidMonths }, status: 'paid',
    }).select('id').single());
    must(await sb().from('payments').insert({ booking_id: booking.id, payer_id: me.id, type: 'booking', amount: total, qr_reference: `MOCKQR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: 'paid', paid_at: new Date().toISOString() }));
    if (input.photos.length) must(await sb().from('booking_photos').insert(input.photos.map((url, index) => ({ booking_id: booking.id, url, sort_order: index }))));
    const job = must(await sb().from('jobs').insert({
      booking_id: booking.id, customer_id: me.id, title: input.mode === 'single' ? 'งานจ่ายครั้งเดียว' : 'งานแพ็กเกจรายเดือน', is_monthly: input.mode === 'monthly',
      service_name: serviceName, service_type_code: serviceCode, area_sq_wah: area, grass_height_level: input.grassHeight, appointment_date: input.date,
      address_line: address.address_line, province: address.province, amphoe: address.amphoe, district: address.district, zipcode: address.zipcode, lat: address.lat, lng: address.lng,
      quote_amount: total, final_amount: total, platform_fee_percent: pricing.platformFeePercent,
    }).select('id').single());
    await notify(me.id, 'booking_paid', `ชำระเงิน ฿${money(total)} สำเร็จ · ส่งงาน “${serviceName}” เข้า Job Pool แล้ว รอช่างรับงาน`, job.id);
    return { ...ok(`ชำระเงิน ฿${money(total)} สำเร็จ · งานถูกส่งเข้า Job Pool แล้ว`), jobId: job.id as string };
  });
}

export async function cancelBooking(jobId: string, refund: { bankName: string; accountNumber: string }) {
  return guard(async () => {
    const me = await requireUser('customer');
    const job = must(await sb().from('jobs').select('id, booking_id, mechanic_id, status, appointment_date, final_amount, title, cancelled_at').eq('id', jobId).eq('customer_id', me.id).maybeSingle());
    if (!job || job.cancelled_at) return fail('ไม่พบการจองนี้');
    if (!['open', 'matched'].includes(job.status) || daysFromToday(job.appointment_date) < 2) return fail('ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมายอย่างน้อย 2 วัน และก่อนช่างถึงที่นัดหมาย');
    if (!refund.bankName) return fail('กรุณาเลือกธนาคารสำหรับรับเงินคืน');
    const account = digitsOf(refund.accountNumber);
    if (!/^\d{10,12}$/.test(account)) return fail('กรุณากรอกเลขบัญชี 10–12 หลัก');
    const amount = Number(job.final_amount);
    const accountName = `${me.first_name} ${me.last_name}`;
    const now = new Date().toISOString();
    must(await sb().from('jobs').update({ status: 'cancelled', cancelled_at: now, cancelled_by: 'customer' }).eq('id', jobId));
    must(await sb().from('bookings').update({ status: 'cancelled', cancelled_at: now }).eq('id', job.booking_id));
    must(await sb().from('quote_adjustments').update({ customer_decision: 'expired', decided_at: now }).eq('job_id', jobId).eq('customer_decision', 'pending'));
    must(await sb().from('refunds').insert({ booking_id: job.booking_id, job_id: jobId, customer_id: me.id, reason: 'customer_cancel', amount, bank_name: refund.bankName, bank_account_number_enc: hex(account), bank_account_last4: account.slice(-4), bank_account_name: accountName, status: 'requested' }));
    const note = `คืนเงิน ฿${money(amount)} เข้า ${refund.bankName} xxx-${account.slice(-4)} (${accountName})`;
    if (job.mechanic_id) await notify(job.mechanic_id, 'job_cancelled_by_customer', `ลูกค้ายกเลิกงาน “${job.title}” วันที่ ${job.appointment_date} แล้ว · งานถูกนำออกจากงานของคุณ`, jobId);
    await notify(me.id, 'refund_completed', `ยกเลิกการจ้างงานแล้ว · ${note}`, jobId);
    return ok(`ยกเลิกการจ้างงานแล้ว · ${note} (ตัวอย่างหน้าจอ)`);
  });
}

export async function saveCustomerAddresses(addresses: ServiceAddress[]) {
  return guard(async () => {
    const me = await requireUser('customer');
    if (!addresses.length) return fail('ต้องมีที่อยู่บริการอย่างน้อย 1 แห่ง');
    const current = must(await sb().from('service_addresses').select('id').eq('user_id', me.id).is('deleted_at', null)).map((row) => row.id as string);
    const now = new Date().toISOString();
    // ลบที่อยู่ที่ถูกเอาออก (soft delete เพราะงานเก่ายังอ้างถึง) และยกเลิกที่อยู่หลักเดิมก่อน
    const removed = current.filter((id) => !addresses.some((item) => item.id === id));
    if (removed.length) must(await sb().from('service_addresses').update({ deleted_at: now, is_default: false }).in('id', removed));
    must(await sb().from('service_addresses').update({ is_default: false }).eq('user_id', me.id));
    let defaultId: string | null = null;
    for (const address of addresses) {
      const row = addressRow(me.id, address.label, address.details, address.isDefault);
      const saved = current.includes(address.id)
        ? must(await sb().from('service_addresses').update(row).eq('id', address.id).eq('user_id', me.id).select('id').single())
        : must(await sb().from('service_addresses').insert(row).select('id').single());
      if (address.isDefault) defaultId = saved.id;
    }
    must(await sb().from('customer_profiles').update({ default_service_address_id: defaultId }).eq('user_id', me.id));
    return ok('บันทึกที่อยู่บริการแล้ว');
  });
}

export async function updateCustomerPhone(phone: string) {
  return guard(async () => {
    const me = await requireUser('customer');
    const digits = digitsOf(phone);
    if (!/^0\d{9}$/.test(digits)) return fail('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0');
    const { data: taken } = await sb().from('users').select('id').eq('phone', digits).neq('id', me.id).maybeSingle();
    if (taken) return fail('เบอร์นี้มีผู้ใช้คนอื่นใช้แล้ว');
    must(await sb().from('users').update({ phone: digits }).eq('id', me.id));
    return ok('บันทึกเบอร์โทรแล้ว · ใช้เบอร์ใหม่ในการเข้าสู่ระบบครั้งต่อไป');
  });
}

async function jobForCustomer(customerId: string, jobId: string) {
  return must(await sb().from('jobs').select('id, mechanic_id, booking_id, final_amount, quote_amount, title, status').eq('id', jobId).eq('customer_id', customerId).maybeSingle());
}

async function applyAdjustment(adjustment: { job_id: string; new_amount: number; new_area_sq_wah: number; new_grass_height_level: number; new_extra_charges: number }) {
  must(await sb().from('jobs').update({ final_amount: adjustment.new_amount, area_sq_wah: adjustment.new_area_sq_wah, grass_height_level: adjustment.new_grass_height_level, extra_charges: adjustment.new_extra_charges }).eq('id', adjustment.job_id));
}

export async function decideAdjustment(adjustmentId: string, accept: boolean) {
  return guard(async () => {
    const me = await requireUser('customer');
    const adjustment = must(await sb().from('quote_adjustments').select('*').eq('id', adjustmentId).maybeSingle());
    const job = adjustment && await jobForCustomer(me.id, adjustment.job_id);
    if (!adjustment || !job || adjustment.customer_decision !== 'pending') return fail('ไม่พบคำขอปรับราคาที่รอตอบ');
    if (Date.parse(adjustment.expires_at) <= Date.now()) {
      await expireAdjustmentsNow();
      return fail('คำขอปรับราคานี้หมดอายุแล้ว · ราคาคงเดิม');
    }
    const now = new Date().toISOString();
    if (!accept) {
      must(await sb().from('quote_adjustments').update({ customer_decision: 'rejected', decided_at: now }).eq('id', adjustmentId));
      if (job.mechanic_id) await notify(job.mechanic_id, 'adjustment_rejected', `ลูกค้าปฏิเสธคำขอปรับราคา · ราคายังเป็น ฿${money(Number(adjustment.old_amount))}`, job.id);
      return ok('ปฏิเสธคำขอปรับราคาแล้ว · แจ้งช่างเรียบร้อย');
    }
    const difference = Number(adjustment.new_amount) - Number(adjustment.old_amount);
    const settlement = difference > 0 ? 'awaiting_payment' : difference < 0 ? 'refunded' : 'no_change';
    must(await sb().from('quote_adjustments').update({ customer_decision: 'accepted', settlement, decided_at: now }).eq('id', adjustmentId));
    if (difference > 0) {
      if (job.mechanic_id) await notify(job.mechanic_id, 'adjustment_accepted', `ลูกค้ายอมรับคำขอปรับราคา ฿${money(Number(adjustment.new_amount))} · รอลูกค้าชำระส่วนต่าง`, job.id);
      return ok(`ยอมรับราคาใหม่แล้ว กรุณาชำระส่วนต่าง ฿${money(difference)} ผ่าน QR ก่อนช่างทำงานต่อ`);
    }
    await applyAdjustment(adjustment);
    if (difference < 0) must(await sb().from('refunds').insert({ booking_id: job.booking_id, job_id: job.id, quote_adjustment_id: adjustmentId, customer_id: me.id, reason: 'price_decrease', amount: -difference, status: 'requested' }));
    if (job.mechanic_id) await notify(job.mechanic_id, 'adjustment_accepted', `ลูกค้ายอมรับคำขอปรับราคา · ราคาใหม่ ฿${money(Number(adjustment.new_amount))}`, job.id);
    return ok(difference < 0 ? `ยอมรับราคาใหม่แล้ว · คืนเงิน ฿${money(-difference)} (ตัวอย่างหน้าจอ)` : 'ยอมรับราคาใหม่แล้ว');
  });
}

export async function payAdjustmentDifference(adjustmentId: string) {
  return guard(async () => {
    const me = await requireUser('customer');
    const adjustment = must(await sb().from('quote_adjustments').select('*').eq('id', adjustmentId).maybeSingle());
    const job = adjustment && await jobForCustomer(me.id, adjustment.job_id);
    if (!adjustment || !job || adjustment.settlement !== 'awaiting_payment') return fail('ไม่มีส่วนต่างที่ต้องชำระ');
    const difference = Number(adjustment.new_amount) - Number(adjustment.old_amount);
    must(await sb().from('payments').insert({ booking_id: job.booking_id, quote_adjustment_id: adjustmentId, payer_id: me.id, type: 'adjustment_difference', amount: difference, qr_reference: `MOCKQR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: 'paid', paid_at: new Date().toISOString() }));
    must(await sb().from('quote_adjustments').update({ settlement: 'paid_difference' }).eq('id', adjustmentId));
    await applyAdjustment(adjustment);
    if (job.mechanic_id) await notify(job.mechanic_id, 'adjustment_difference_paid', `ลูกค้าชำระส่วนต่างแล้ว · ราคาใหม่ ฿${money(Number(adjustment.new_amount))} ดำเนินงานต่อได้`, job.id);
    return ok(`ชำระส่วนต่าง ฿${money(difference)} สำเร็จ · ช่างดำเนินงานต่อได้`);
  });
}

// สำหรับทดสอบ: ทำให้คำขอปรับราคาหมดอายุทันที
export async function simulateAdjustmentExpiry(adjustmentId: string) {
  return guard(async () => {
    const me = await requireUser('customer');
    const adjustment = must(await sb().from('quote_adjustments').select('job_id').eq('id', adjustmentId).maybeSingle());
    if (!adjustment || !(await jobForCustomer(me.id, adjustment.job_id))) return fail('ไม่พบคำขอปรับราคา');
    must(await sb().from('quote_adjustments').update({ expires_at: new Date().toISOString() }).eq('id', adjustmentId).eq('customer_decision', 'pending'));
    await expireAdjustmentsNow();
    return ok('คำขอปรับราคาหมดอายุแล้ว · ราคาคงเดิม');
  });
}

export async function submitReview(jobId: string, input: ReviewInput) {
  return guard(async () => {
    const me = await requireUser('customer');
    const job = await jobForCustomer(me.id, jobId);
    if (!job || !job.mechanic_id || job.status !== 'completed') return fail('รีวิวได้หลังช่างทำงานเสร็จแล้วเท่านั้น');
    const problem = reviewProblem(input);
    if (problem) return fail(problem);
    const noShow = input.status === 'no_show';
    const rating = overallRating(input);
    const base = { job_id: jobId, customer_id: me.id, mechanic_id: job.mechanic_id, rating, comment: input.comment.trim() || null };
    let { error } = await sb().from('reviews').insert({
      ...base,
      status: input.status,
      cleanliness_rating: noShow ? null : input.topics.cleanliness,
      punctuality_rating: noShow ? null : input.topics.punctuality,
      service_rating: noShow ? null : input.topics.service,
      issues: input.issues.slice(0, 10).map((issue) => issue.slice(0, 60)),
    });
    // ยังไม่ได้รัน migration 20261020000000_review_topics.sql → บันทึกเฉพาะคะแนนรวมไปก่อน
    if (error?.code === 'PGRST204') ({ error } = await sb().from('reviews').insert(base));
    if (error) return fail(error.code === '23505' ? 'รีวิวงานนี้ไปแล้ว' : error.message);
    must(await sb().from('jobs').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', jobId));
    const statusLabel = reviewStatuses.find((status) => status.value === input.status)!.label;
    await notify(job.mechanic_id, 'review_received', `ลูกค้ารีวิว ${'★'.repeat(rating)} (${statusLabel}) งาน “${job.title}” · กดโอนเงินออกจาก Escrow ได้แล้ว`, jobId);
    return ok('ขอบคุณสำหรับรีวิว · งานเสร็จสมบูรณ์');
  });
}

// ---------------------------------------------------------------------------
// ช่าง
// ---------------------------------------------------------------------------
async function verifiedMechanic(me: UserRow) {
  const profile = must(await sb().from('mechanic_profiles').select('verification_status, bank_name, bank_account_last4, bank_account_name').eq('user_id', me.id).single());
  return profile;
}

export async function acceptJob(jobId: string) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const profile = await verifiedMechanic(me);
    if (profile.verification_status !== 'verified') return fail('บัญชีช่างยังไม่ผ่านการตรวจสอบจากแอดมิน จึงยังรับงานไม่ได้');
    const job = must(await sb().from('jobs').select('id, customer_id, appointment_date, service_name, title').eq('id', jobId).maybeSingle());
    if (!job) return fail('ไม่พบงานนี้');
    // กดรับพร้อมกันหลายคน: อัปเดตได้เฉพาะงานที่ยังว่าง · ดัชนี jobs_one_per_mechanic_per_day กันรับเกินวันละ 1 งาน
    const { data, error } = await sb().from('jobs').update({ mechanic_id: me.id, status: 'matched', accepted_at: new Date().toISOString() })
      .eq('id', jobId).eq('status', 'open').is('mechanic_id', null).is('cancelled_at', null).select('id');
    if (error) return fail(error.code === '23505' ? `คุณรับงานวันที่ ${job.appointment_date} ไว้แล้ว รับได้วันละ 1 งาน` : error.message);
    if (!data?.length) return fail('งานนี้มีช่างรับไปแล้ว หรือถูกยกเลิกแล้ว');
    await notify(job.customer_id, 'job_matched', `ช่าง${me.first_name} ${me.last_name} รับงาน “${job.service_name}” วันที่ ${job.appointment_date} แล้ว`, jobId);
    return ok(`รับงาน “${job.title}” แล้ว`);
  });
}

async function myJob(me: UserRow, jobId: string) {
  return must(await sb().from('jobs').select('id, customer_id, status, appointment_date, final_amount, title, service_name, is_monthly, completed_at, cancelled_at, platform_fee_percent').eq('id', jobId).eq('mechanic_id', me.id).maybeSingle());
}

async function hasOpenAdjustment(jobId: string) {
  const rows = must(await sb().from('quote_adjustments').select('id').eq('job_id', jobId).or('customer_decision.eq.pending,settlement.eq.awaiting_payment'));
  return rows.length > 0;
}

export async function cancelJobByMechanic(jobId: string) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const job = await myJob(me, jobId);
    if (!job || job.cancelled_at) return fail('ไม่พบงานนี้ในงานของคุณ');
    if (job.status !== 'matched' || daysFromToday(job.appointment_date) < 2) return fail('ยกเลิกไม่ได้ · ช่างต้องยกเลิกก่อนวันนัดหมายอย่างน้อย 2 วัน');
    must(await sb().from('jobs').update({ mechanic_id: null, status: 'open', accepted_at: null }).eq('id', jobId));
    must(await sb().from('quote_adjustments').update({ customer_decision: 'expired', decided_at: new Date().toISOString() }).eq('job_id', jobId).eq('customer_decision', 'pending'));
    await notify(job.customer_id, 'job_cancelled_by_mechanic', `ช่างยกเลิกงาน “${job.service_name}” วันที่ ${job.appointment_date} · งานกลับเข้า Job Pool เพื่อหาช่างใหม่`, jobId);
    return ok(`ยกเลิกงาน “${job.title}” แล้ว · งานกลับไปที่ Job Pool`);
  });
}

const nextStage = {
  matched: { status: 'arrived', stamp: 'arrived_at', type: 'mechanic_arrived', message: 'ช่างถึงที่นัดหมายแล้ว' },
  arrived: { status: 'working', stamp: 'started_at', type: 'work_started', message: 'ช่างเริ่มทำงานแล้ว' },
  working: { status: 'completed', stamp: 'completed_at', type: 'work_completed_review_request', message: 'ช่างทำงานเสร็จแล้ว และขอให้คุณช่วยรีวิว' },
} as const;

export async function advanceWorkStage(jobId: string) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const job = await myJob(me, jobId);
    if (!job || job.cancelled_at) return fail('ไม่พบงานนี้ในงานของคุณ');
    const step = nextStage[job.status as keyof typeof nextStage];
    if (!step) return fail('งานนี้เสร็จแล้ว');
    // ราคาสูงขึ้นและลูกค้ายังไม่ชำระส่วนต่าง → ห้ามทำงานต่อ (PRD 5.3)
    if (await hasOpenAdjustment(jobId)) return fail('รอลูกค้าตอบคำขอปรับราคา/ชำระส่วนต่างก่อน');
    const now = new Date();
    must(await sb().from('jobs').update({ status: step.status, [step.stamp]: now.toISOString() }).eq('id', jobId).eq('status', job.status));
    if (step.status === 'completed') {
      // เงินเข้า Escrow: ช่างโอนได้เมื่อลูกค้ารีวิว หรือครบ 2 วัน
      const pricing = await loadPricing();
      const gross = Number(job.final_amount);
      const net = Math.round(gross * (1 - Number(job.platform_fee_percent) / 100));
      must(await sb().from('job_settlements').insert({ job_id: jobId, mechanic_id: me.id, gross_amount: gross, platform_fee: gross - net, net_amount: net, release_available_at: new Date(now.getTime() + pricing.escrowReleaseDays * 86400000).toISOString() }));
      const profile = must(await sb().from('mechanic_profiles').select('completed_jobs_count').eq('user_id', me.id).single());
      must(await sb().from('mechanic_profiles').update({ completed_jobs_count: Number(profile.completed_jobs_count) + 1 }).eq('user_id', me.id));
    }
    await notify(job.customer_id, step.type, step.message, jobId);
    return ok(`แจ้งลูกค้าแล้ว: “${step.message}”`);
  });
}

export async function requestAdjustment(jobId: string, request: { newAmount: number; newArea: number; newGrassHeight: number; newExtraCharges: number; reasons: string[]; note: string }) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const job = await myJob(me, jobId);
    if (!job || job.cancelled_at) return fail('ไม่พบงานนี้ในงานของคุณ');
    if (job.is_monthly) return fail('งานแพ็กเกจรายเดือนไม่สามารถขอปรับราคาได้');
    if (await hasOpenAdjustment(jobId)) return fail('มีคำขอปรับราคาที่รอลูกค้าตอบอยู่แล้ว');
    const pricing = await loadPricing();
    // ตรวจราคาใหม่จากตารางราคาในฐานข้อมูล (ไม่เชื่อตัวเลขจากเบราว์เซอร์)
    const jobRow = must(await sb().from('jobs').select('service_type_code, extra_charges').eq('id', jobId).single());
    const debris = Math.max(0, Number(request.newExtraCharges) - Number(jobRow.extra_charges));
    const expected = pricing.pricePerVisit(jobRow.service_type_code, request.newArea, request.newGrassHeight) + Number(jobRow.extra_charges) + debris;
    if (Math.round(expected) !== Math.round(request.newAmount)) return fail('ราคาใหม่ไม่ตรงกับตารางราคา กรุณาลองใหม่');
    if (request.newAmount === Number(job.final_amount)) return fail('ราคาใหม่เท่ากับราคาเดิม');
    must(await sb().from('quote_adjustments').insert({
      job_id: jobId, requested_by: me.id, old_amount: job.final_amount, new_amount: request.newAmount, new_area_sq_wah: request.newArea, new_grass_height_level: request.newGrassHeight,
      debris_hours: Math.round(debris / 200), new_extra_charges: request.newExtraCharges, reasons: request.reasons, note: request.note || null,
      expires_at: new Date(Date.now() + pricing.adjustmentExpiryMinutes * 60000).toISOString(),
    }));
    await notify(job.customer_id, 'adjustment_requested', `ช่างขอปรับราคางาน “${job.service_name}” เป็น ฿${money(request.newAmount)} · กรุณาตอบภายใน 1 ชั่วโมง`, jobId);
    return ok(`ส่งคำขอปรับราคา “${job.title}” ให้ลูกค้ายืนยันแล้ว · ราคายังไม่เปลี่ยนจนกว่าลูกค้าจะตอบรับ`);
  });
}

export async function saveInspection(jobId: string, beforeUrl: string, afterUrl: string): Promise<Result & { inspection?: Inspection }> {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const job = must(await sb().from('jobs').select('id, area_sq_wah, grass_height_level').eq('id', jobId).eq('mechanic_id', me.id).maybeSingle());
    if (!job) return fail('ไม่พบงานนี้ในงานของคุณ');
    if (![beforeUrl, afterUrl].every((url) => url.startsWith('data:image/') && url.length < 600000)) return fail('รูปไม่ถูกต้อง');
    const [before, after] = must(await sb().from('inspection_photos').insert([
      { job_id: jobId, kind: 'before', url: beforeUrl, uploaded_by: me.id },
      { job_id: jobId, kind: 'after', url: afterUrl, uploaded_by: me.id },
    ]).select('id, kind').order('kind', { ascending: false }));
    // จำลองผลวิเคราะห์ AI (ผลคงที่ต่องาน เพื่อทดสอบซ้ำได้) — เปลี่ยนเป็น AI จริงได้ภายหลัง
    const seed = [...jobId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const result = {
      completeness_percent: 92 + (seed % 7),
      estimated_area_sq_wah: Math.max(1, Math.round(Number(job.area_sq_wah) * (1 + ((seed % 21) - 5) / 100))),
      detected_grass_height_level: Math.min(2, Number(job.grass_height_level) + (seed % 2)),
      estimated_debris_hours: seed % 3 === 0 ? 0 : 1,
    };
    const beforeId = before.kind === 'before' ? before.id : after.id;
    const afterId = before.kind === 'before' ? after.id : before.id;
    const saved = must(await sb().from('ai_inspections').insert({ job_id: jobId, before_photo_id: beforeId, after_photo_id: afterId, ...result, model_version: 'mock-1', raw_result: result }).select('created_at').single());
    return {
      ...ok('บันทึกผลตรวจงานแล้ว'),
      inspection: { jobId, beforeUrl, afterUrl, completeness: result.completeness_percent, estimatedArea: result.estimated_area_sq_wah, grassHeight: result.detected_grass_height_level, debrisHours: result.estimated_debris_hours, createdAt: saved.created_at },
    };
  });
}

export async function releasePayout(jobId: string) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const settlement = must(await sb().from('job_settlements').select('*').eq('job_id', jobId).eq('mechanic_id', me.id).maybeSingle());
    if (!settlement || settlement.status !== 'held') return fail('ไม่มีเงินที่โอนได้สำหรับงานนี้');
    const { data: review } = await sb().from('reviews').select('id').eq('job_id', jobId).maybeSingle();
    if (!review && Date.parse(settlement.release_available_at) > Date.now()) return fail('ยังโอนเงินไม่ได้ · ต้องรอลูกค้ารีวิว หรือครบ 2 วันหลังทำงานเสร็จ');
    const profile = await verifiedMechanic(me);
    const now = new Date().toISOString();
    must(await sb().from('job_settlements').update({ status: 'released', released_at: now }).eq('job_id', jobId).eq('status', 'held'));
    must(await sb().from('payouts').insert({ mechanic_id: me.id, job_id: jobId, amount: settlement.net_amount, bank_name: profile.bank_name, bank_account_last4: profile.bank_account_last4, bank_account_name: profile.bank_account_name, status: 'completed', transfer_reference: `MOCKTRF-${Date.now()}`, transferred_at: now }));
    return ok(`โอนเงิน ฿${money(Number(settlement.net_amount))} เข้า ${profile.bank_name} xxx-${profile.bank_account_last4} เรียบร้อย (ตัวอย่างหน้าจอ)`);
  });
}

// สำหรับทดสอบ: เลื่อนเวลาทำงานเสร็จย้อนหลัง 2 วัน เพื่อดูเงื่อนไขโอนเงิน
export async function simulateEscrowWait(jobId: string) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    const job = await myJob(me, jobId);
    if (!job?.completed_at) return fail('ไม่พบงานที่ทำเสร็จ');
    const shift = (iso: string) => new Date(Date.parse(iso) - 2 * 86400000).toISOString();
    must(await sb().from('jobs').update({ completed_at: shift(job.completed_at) }).eq('id', jobId));
    const settlement = must(await sb().from('job_settlements').select('release_available_at').eq('job_id', jobId).single());
    must(await sb().from('job_settlements').update({ release_available_at: shift(settlement.release_available_at) }).eq('job_id', jobId));
    return ok('จำลองเวลาผ่านไป 2 วันแล้ว');
  });
}

export async function updateMechanicBase(base: AddressDetails) {
  return guard(async () => {
    const me = await requireUser('mechanic');
    if (!base.addressLine.trim() || !base.province || !base.amphoe) return fail('กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ');
    if (!base.location) return fail('กรุณาปักหมุดตำแหน่ง เพื่อใช้คำนวณระยะทางไปยังงาน');
    must(await sb().from('mechanic_profiles').update({ base_address_line: base.addressLine.trim(), base_province: base.province, base_amphoe: base.amphoe, base_district: base.district || null, base_lat: base.location.lat, base_lng: base.location.lng }).eq('user_id', me.id));
    return ok('บันทึกที่อยู่ฐานแล้ว');
  });
}

// ---------------------------------------------------------------------------
// แอดมิน
// ---------------------------------------------------------------------------
export async function reviewMechanic(mechanicId: string, status: 'verified' | 'rejected', reason?: string) {
  return guard(async () => {
    const admin = await requireUser('admin');
    if (status === 'rejected' && !reason?.trim()) return fail('กรุณาระบุเหตุผลที่ไม่อนุมัติ');
    const user = must(await sb().from('users').select('first_name, last_name').eq('id', mechanicId).eq('role', 'mechanic').maybeSingle());
    if (!user) return fail('ไม่พบใบสมัคร');
    must(await sb().from('mechanic_profiles').update({ verification_status: status, reject_reason: status === 'rejected' ? reason!.trim() : null, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq('user_id', mechanicId));
    must(await sb().from('admin_audit_logs').insert({ admin_id: admin.id, action: status === 'verified' ? 'mechanic.approve' : 'mechanic.reject', target_type: 'mechanic', target_id: mechanicId, details: { reason: reason ?? null } }));
    await notify(mechanicId, status === 'verified' ? 'verification_approved' : 'verification_rejected', status === 'verified' ? 'แอดมินอนุมัติบัญชีของคุณแล้ว · เริ่มรับงานได้' : `ใบสมัครไม่ผ่านการอนุมัติ · ${reason!.trim()}`);
    return ok(`${status === 'verified' ? 'อนุมัติ' : 'ไม่อนุมัติ'}ใบสมัครของ ${user.first_name} ${user.last_name} แล้ว`);
  });
}

// ล้างข้อมูลการใช้งานทั้งหมด (งาน การจอง การเงิน แจ้งเตือน) แต่คงบัญชีผู้ใช้ไว้
export async function resetActivityData() {
  return guard(async () => {
    await requireUser('admin');
    const tables: [string, string][] = [
      ['payouts', 'id'], ['job_settlements', 'job_id'], ['refunds', 'id'], ['payments', 'id'], ['reviews', 'id'], ['quote_adjustments', 'id'],
      ['ai_inspections', 'id'], ['inspection_photos', 'id'], ['notifications', 'id'], ['job_status_history', 'id'], ['jobs', 'id'],
      ['subscription_cycles', 'id'], ['booking_photos', 'id'], ['bookings', 'id'],
    ];
    for (const [table, key] of tables) must(await sb().from(table).delete().not(key, 'is', null));
    must(await sb().from('mechanic_profiles').update({ rating_average: 0, rating_count: 0, completed_jobs_count: 0 }).not('user_id', 'is', null));
    return ok('ล้างข้อมูลการใช้งานแล้ว (บัญชีผู้ใช้ยังอยู่)');
  });
}

// ---------------------------------------------------------------------------
// ใช้ร่วมกัน
// ---------------------------------------------------------------------------
export async function markNotificationsRead(role: Role) {
  return guard(async () => {
    const me = await requireUser(role);
    must(await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me.id).is('read_at', null));
    return ok('');
  });
}

// คำขอปรับราคาที่ลูกค้าไม่ตอบภายใน 1 ชั่วโมง → หมดอายุ ราคาคงเดิม และแจ้งช่าง
async function expireAdjustmentsNow() {
  const expired = must(await sb().from('quote_adjustments').update({ customer_decision: 'expired', decided_at: new Date().toISOString() })
    .eq('customer_decision', 'pending').lte('expires_at', new Date().toISOString()).select('job_id, old_amount'));
  for (const item of expired) {
    const job = must(await sb().from('jobs').select('mechanic_id').eq('id', item.job_id).single());
    if (job.mechanic_id) await notify(job.mechanic_id, 'adjustment_expired', `คำขอปรับราคาหมดอายุ · ลูกค้าไม่ตอบภายใน 1 ชั่วโมง ราคายังเป็น ฿${money(Number(item.old_amount))}`, item.job_id);
  }
}

// หน้าแรก (ไม่ต้องล็อกอิน): การจองล่าสุดจริงในระบบ แสดงเฉพาะเขต/อำเภอ บริการ และเวลา (ไม่มีข้อมูลส่วนตัว)
export async function latestBookingActivity(): Promise<{ amphoe: string; province: string; service: string; createdAt: string } | null> {
  try {
    const { data } = await sb().from('jobs').select('amphoe, province, service_name, created_at').is('cancelled_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data ? { amphoe: data.amphoe, province: data.province, service: data.service_name, createdAt: data.created_at } : null;
  } catch {
    return null;
  }
}
