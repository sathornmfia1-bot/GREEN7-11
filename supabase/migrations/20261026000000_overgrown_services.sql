-- ประเภทบริการใหม่: ตัดสวนรกร้าง (ราคาไม่คิดตัวคูณความสูงหญ้า — แอปส่งระดับ 0 = × 1.0 เสมอ)
--   overgrown_haul    : ตัดสวนรกร้าง ขนทิ้ง      ฿2,000 (ไม่เกิน 100 ตร.ว.) + ตร.ว.ละ ฿6
--   overgrown_no_haul : ตัดสวนรกร้าง ไม่ขนทิ้ง   ฿1,500 (ไม่เกิน 100 ตร.ว.) + ตร.ว.ละ ฿5
-- ชื่อต้องตรงกับ pricingOptions ใน app/_components/pricing.ts (เซิร์ฟเวอร์จับคู่ด้วยชื่อ)
insert into service_types (code, name, base_price, extra_per_wa, sort_order) values
  ('overgrown_haul',    'ตัดสวนรกร้าง ขนทิ้ง',    2000, 6, 7),
  ('overgrown_no_haul', 'ตัดสวนรกร้าง ไม่ขนทิ้ง', 1500, 5, 8)
on conflict (code) do update
  set name = excluded.name, base_price = excluded.base_price, extra_per_wa = excluded.extra_per_wa,
      sort_order = excluded.sort_order, is_active = true;
