-- เพิ่มเครื่องมือของช่างตัดหญ้า 4 อย่าง (ต่อจาก 20261024000000_mechanic_equipment.sql)
--   pruning_shears : กรรไกรตัดแต่งกิ่ง
--   hedge_shears   : กรรไกรด้ามยาว เล็มพุ่ม
--   pole_pruner    : กรรไกรกระตุกกิ่ง
--   hedge_trimmer  : เครื่องตัดแต่งพุ่มไฟฟ้า
-- ปรับเงื่อนไขค่าที่อนุญาตของคอลัมน์ equipment ให้รวมรายการใหม่
alter table mechanic_profiles drop constraint if exists mechanic_profiles_equipment_check;
alter table mechanic_profiles add constraint mechanic_profiles_equipment_check
  check (equipment <@ array[
    'brush_cutter_2t', 'brush_cutter_4t', 'battery_cutter', 'riding_mower', 'leaf_blower',
    'pruning_shears', 'hedge_shears', 'pole_pruner', 'hedge_trimmer'
  ]::text[]);
