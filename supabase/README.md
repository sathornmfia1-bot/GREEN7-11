# เชื่อมต่อ Supabase

## 1. สร้างฐานข้อมูล
1. สร้างโปรเจกต์ที่ https://supabase.com/dashboard (เลือก Region: Southeast Asia (Singapore))
2. เปิด **SQL Editor** → วางเนื้อหาไฟล์ `migrations/20261017000000_init.sql` ทั้งไฟล์ → **Run**
   - สร้างตารางทั้งหมดตาม `../database.md`, เปิด Row Level Security และใส่ข้อมูลตั้งต้น (ตารางราคา, ค่าตั้งระบบ)
   - หรือใช้ Supabase CLI: `supabase link --project-ref <ref>` แล้ว `supabase db push`

## 2. ตั้งค่าหน้าเว็บ
1. คัดลอก `.env.local.example` (ที่ root ของโปรเจกต์) เป็น `.env.local`
2. ใส่ค่าจาก **Project Settings → API**
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon / publishable key
3. รีสตาร์ท `npm run dev` (ตัวแปร env อ่านตอนเริ่ม server เท่านั้น)
4. เปิด `/admin` → แท็บภาพรวม → การ์ด **ฐานข้อมูล Supabase** ต้องขึ้น "✓ เชื่อมต่อสำเร็จ"

## 3. ความต่างจาก database.md
- ตาราง `users` อ้างอิง `auth.users` ของ Supabase Auth — รหัสผ่านและ OTP ให้ Supabase Auth จัดการ จึงไม่มีคอลัมน์ `password_hash` และตาราง `otp_codes`
- เพิ่มฟังก์ชัน `accept_job(job_id)` สำหรับช่างกดรับงาน (ตรวจการอนุมัติ, VIP 30 วินาที, วันละ 1 งาน, กันรับซ้ำ)
- เพิ่ม view `mechanic_public_cards` ให้ลูกค้าเห็นรูป/เรทติ้งช่างโดยไม่เห็นข้อมูลธนาคาร
- การเปลี่ยนสถานะงานและรายการเงิน (ชำระ / คืนเงิน / Escrow / โอน) ไม่เปิดให้เขียนจากเบราว์เซอร์ ต้องทำผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์

## 4. ขั้นตอนถัดไป
1. **ระบบล็อกอิน** — Supabase Auth (OTP ทางโทรศัพท์ต้องตั้ง SMS provider เช่น Twilio ใน Authentication → Providers → Phone)
2. **ลงทะเบียนลูกค้า/ช่าง** — บันทึกลง `users`, `customer_profiles`, `mechanic_profiles`, `service_addresses` และอัปโหลดรูปไป Supabase Storage
3. **ตารางราคา** — อ่านจาก `service_types`, `grass_height_levels`, `monthly_packages`, `platform_settings` แทนค่าในโค้ด
4. **การจอง/Job Pool/ตรวจงาน/แจ้งเตือน** — บันทึกลง `bookings`, `jobs`, `quote_adjustments`, `notifications` (ใช้ Realtime สำหรับแจ้งเตือน)
5. **การเงิน** — เชื่อม payment gateway (PromptPay QR) ผ่าน Edge Function ใช้ service role key
