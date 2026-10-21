// สร้างบัญชีทดสอบในฐานข้อมูล Supabase (ระบบล็อกอินยังเป็นแบบจำลอง: เบอร์โทร + OTP แสดงบนหน้าจอ)
// รัน: node scripts/seed-test-accounts.mjs   (รันซ้ำได้ บัญชีที่มีอยู่แล้วจะถูกข้าม)
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function api(path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const insert = (table, rows) => api(`/rest/v1/${table}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rows) });
const hex = (value) => `\\x${Buffer.from(value, 'utf8').toString('hex')}`;

const accounts = [
  { role: 'admin', first_name: 'ผู้ดูแล', last_name: 'ระบบ', phone: '0800000000' },
  {
    role: 'customer', first_name: 'สมชาย', last_name: 'ใจดี', phone: '0812345678', email: 'somchai@example.com',
    address: { label: 'บ้าน', address_line: '1 ถนนเจริญนคร', province: 'กรุงเทพมหานคร', amphoe: 'คลองสาน', district: 'คลองต้นไทร', zipcode: '10600', lat: 13.7266, lng: 100.5078 },
  },
  {
    role: 'customer', first_name: 'สมหญิง', last_name: 'รักสวน', phone: '0898887777', email: 'somying@example.com',
    address: { label: 'บ้าน', address_line: '45/7 หมู่บ้านพฤกษา ถนนรัตนาธิเบศร์', province: 'นนทบุรี', amphoe: 'เมืองนนทบุรี', district: 'บางกระสอ', zipcode: '11000', lat: 13.8612, lng: 100.5021 },
  },
  {
    role: 'mechanic', first_name: 'สมศักดิ์', last_name: 'ตัดเก่ง', phone: '0891112222', status: 'verified', bank: ['ธนาคารกสิกรไทย', '1112223334'], radius: 20,
    base: { address_line: '12 ถนนงามวงศ์วาน', province: 'นนทบุรี', amphoe: 'เมืองนนทบุรี', district: 'บางกระสอ', zipcode: '11000', lat: 13.8577, lng: 100.5236 },
  },
  {
    role: 'mechanic', first_name: 'อนันต์', last_name: 'มือดี', phone: '0894445555', status: 'verified', bank: ['ธนาคารกรุงเทพ', '4445556667'], radius: 30,
    base: { address_line: '9 ถนนแจ้งวัฒนะ', province: 'กรุงเทพมหานคร', amphoe: 'หลักสี่', district: 'ทุ่งสองห้อง', zipcode: '10210', lat: 13.8853, lng: 100.5672 },
  },
  {
    role: 'mechanic', first_name: 'วิไล', last_name: 'สวนสวย', phone: '0812223333', status: 'verified', bank: ['ธนาคารไทยพาณิชย์', '9876543210'], radius: 10,
    base: { address_line: '210 ซอยลาดพร้าว 71', province: 'กรุงเทพมหานคร', amphoe: 'วังทองหลาง', district: 'สะพานสอง', zipcode: '10310', lat: 13.7889, lng: 100.6084 },
  },
  {
    role: 'mechanic', first_name: 'ประเสริฐ', last_name: 'ขยันดี', phone: '0891234567', status: 'pending_verification', bank: ['ธนาคารกสิกรไทย', '1234567890'], radius: 20,
    base: { address_line: '55 ถนนติวานนท์', province: 'นนทบุรี', amphoe: 'ปากเกร็ด', district: 'บ้านใหม่', zipcode: '11120', lat: 13.9012, lng: 100.5143 },
  },
];

const authUsers = (await api('/auth/v1/admin/users?per_page=1000')).users ?? [];

for (const account of accounts) {
  const existing = await api(`/rest/v1/users?select=id&phone=eq.${account.phone}`);
  if (existing.length) {
    console.log(`ข้าม (มีอยู่แล้ว): ${account.first_name} ${account.last_name} ${account.phone}`);
    continue;
  }
  const e164 = `66${account.phone.slice(1)}`;
  let authUser = authUsers.find((user) => user.phone === e164);
  authUser ??= await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ phone: `+${e164}`, phone_confirm: true, user_metadata: { role: account.role, test_account: true } }) });

  await insert('users', [{ id: authUser.id, role: account.role, first_name: account.first_name, last_name: account.last_name, phone: account.phone, phone_verified: true, email: account.email ?? null }]);

  if (account.role === 'customer') {
    const [address] = await insert('service_addresses', [{ user_id: authUser.id, is_default: true, ...account.address }]);
    await insert('customer_profiles', [{ user_id: authUser.id, default_service_address_id: address.id }]);
  }
  if (account.role === 'mechanic') {
    const [bankName, accountNumber] = account.bank;
    const { base } = account;
    await insert('mechanic_profiles', [{
      user_id: authUser.id, photo_url: '', id_card_image_url: `idcard-${account.phone}.jpg`,
      bank_name: bankName, bank_account_number_enc: hex(accountNumber), bank_account_last4: accountNumber.slice(-4), bank_account_name: `${account.first_name} ${account.last_name}`,
      service_radius_km: account.radius,
      base_address_line: base.address_line, base_province: base.province, base_amphoe: base.amphoe, base_district: base.district, base_zipcode: base.zipcode, base_lat: base.lat, base_lng: base.lng,
      verification_status: account.status, reviewed_at: account.status === 'verified' ? new Date().toISOString() : null,
    }]);
  }
  console.log(`สร้างแล้ว: [${account.role}] ${account.first_name} ${account.last_name} ${account.phone}`);
}
