-- แพ็กเกจรายเดือนใหม่ 2 แพ็กเกจ · ลูกค้าเลือกจำนวนครั้ง 1–4 ครั้งต่อเดือนเอง
--   care_basic : ตัดหญ้า แต่งกิ่ง ขนทิ้ง ใส่ปุ๋ย รดน้ำ                 ฿1,200 (ไม่เกิน 100 ตร.ว.) + ตร.ว.ละ ฿6
--   care_full  : ตัดหญ้า แต่งกิ่ง ขนทิ้ง ใส่ปุ๋ย รดน้ำ พรวนดิน พ่นยา  ฿1,800 (ไม่เกิน 100 ตร.ว.) + ตร.ว.ละ ฿7
-- ราคาต่อเดือน = ราคาต่อครั้ง × จำนวนครั้ง ไม่มีส่วนลด และไม่คิดตัวคูณความสูงหญ้า
-- แพ็กเกจเดิม (1–3 ครั้ง ลด 10–20% และหยุดวันอาทิตย์) ปิดไว้ ไม่ลบ เพราะการจองเก่ายังอ้างอิงอยู่
-- code / ราคาต้องตรงกับ monthlyPackages ใน app/_components/pricing.ts
alter table monthly_packages
  add column if not exists base_price   numeric(12,2),
  add column if not exists base_area_wa integer not null default 100,
  add column if not exists extra_per_wa numeric(12,2),
  add column if not exists is_active    boolean not null default true;

update monthly_packages set is_active = false where code in ('monthly_1', 'monthly_2', 'monthly_3', 'monthly_no_sunday');

insert into monthly_packages (code, name, visits_per_month, pricing_service_code, discount_percent, fixed_monthly_price, base_price, extra_per_wa, sort_order, is_active) values
  ('care_basic', 'ตัดหญ้า แต่งกิ่ง ขนทิ้ง ใส่ปุ๋ย รดน้ำ',                1, null, 0, null, 1200, 6, 5, true),
  ('care_full',  'ตัดหญ้า แต่งกิ่ง ขนทิ้ง ใส่ปุ๋ย รดน้ำ พรวนดิน พ่นยา', 1, null, 0, null, 1800, 7, 6, true)
on conflict (code) do update
  set name = excluded.name, base_price = excluded.base_price, extra_per_wa = excluded.extra_per_wa,
      sort_order = excluded.sort_order, is_active = true;
