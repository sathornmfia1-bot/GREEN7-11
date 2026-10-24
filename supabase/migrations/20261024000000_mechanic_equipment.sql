-- เครื่องมือที่ช่างตัดหญ้าใช้ (เลือกได้มากกว่า 1 อย่างตอนสมัคร)
--   brush_cutter_2t : เครื่องตัดหญ้าสะพายบ่า 2 จังหวะ
--   brush_cutter_4t : เครื่องตัดหญ้าสะพายบ่า 4 จังหวะ
--   battery_cutter  : เครื่องตัดหญ้าแบตเตอรี่
--   riding_mower    : รถตัดหญ้าแบบนั่งขับ
--   leaf_blower     : เครื่องเป่าใบไม้
alter table mechanic_profiles
  add column if not exists equipment text[] not null default '{}'
  check (equipment <@ array['brush_cutter_2t', 'brush_cutter_4t', 'battery_cutter', 'riding_mower', 'leaf_blower']::text[]);
