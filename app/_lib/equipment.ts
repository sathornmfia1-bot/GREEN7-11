// เครื่องมือที่ช่างตัดหญ้าใช้ (เลือกได้มากกว่า 1 อย่างตอนสมัคร) — ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์
export const equipmentOptions = [
  { value: 'brush_cutter_2t', label: 'เครื่องตัดหญ้าสะพายบ่า 2 จังหวะ' },
  { value: 'brush_cutter_4t', label: 'เครื่องตัดหญ้าสะพายบ่า 4 จังหวะ' },
  { value: 'battery_cutter', label: 'เครื่องตัดหญ้าแบตเตอรี่' },
  { value: 'riding_mower', label: 'รถตัดหญ้าแบบนั่งขับ' },
  { value: 'leaf_blower', label: 'เครื่องเป่าใบไม้' },
] as const;

export type Equipment = (typeof equipmentOptions)[number]['value'];

export const equipmentLabel = (value: string) => equipmentOptions.find((option) => option.value === value)?.label ?? value;

// เก็บเฉพาะค่าที่อยู่ในรายการ เรียงตามลำดับในรายการ และไม่ซ้ำ
export function cleanEquipment(values: unknown): Equipment[] {
  const picked = new Set(Array.isArray(values) ? values : []);
  return equipmentOptions.map((option) => option.value).filter((value) => picked.has(value));
}
