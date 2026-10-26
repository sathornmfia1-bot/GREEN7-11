export const baseAreaWa = 100;
export const grassHeightMultipliers = [1, 1.5, 2];
export const grassHeightLabels = ['น้อยกว่า 6"', 'มากกว่า 6"', 'มากกว่า 12"'];
// ค่าเคลียร์เศษวัสดุเพิ่มหน้างาน (PRD 4.2.5)
export const debrisRatePerHour = 200;

export const pricingOptions = [
  { name: 'ตัดหญ้าอย่างเดียว ไม่ขนทิ้ง', basePrice: 800, extraPerWa: 2 },
  { name: 'ตัดหญ้าอย่างเดียว ขนทิ้ง', basePrice: 1000, extraPerWa: 3 },
  { name: 'ตัดหญ้าและแต่งกิ่ง ไม่ขนทิ้ง', basePrice: 1000, extraPerWa: 3 },
  { name: 'ตัดหญ้าและแต่งกิ่ง ขนทิ้ง', basePrice: 1200, extraPerWa: 4 },
  { name: 'แต่งกิ่งอย่างเดียว ไม่ขนทิ้ง', basePrice: 1000, extraPerWa: 3 },
  { name: 'แต่งกิ่งอย่างเดียว ขนทิ้ง', basePrice: 1200, extraPerWa: 4 },
  { name: 'ตัดสวนรกร้าง ไม่ขนทิ้ง', basePrice: 1500, extraPerWa: 5 },
  { name: 'ตัดสวนรกร้าง ขนทิ้ง', basePrice: 2000, extraPerWa: 6 },
];

// บริการแต่งกิ่งอย่างเดียวไม่เกี่ยวกับความสูงหญ้า: ใช้เกณฑ์พุ่มไม้สูงน้อยกว่า 2 เมตร (ตัวคูณ × 1.0 = ระดับ 0)
export const shrubHeightLabel = 'พุ่มไม้สูงน้อยกว่า 2 เมตร';
export const isPruningOnly = (serviceName: string) => serviceName.startsWith('แต่งกิ่งอย่างเดียว');
// ตัดสวนรกร้าง: หญ้าสูงอยู่แล้ว แสดงเป็น "มากกว่า 12"" ในช่องที่เปลี่ยนไม่ได้ · ราคาไม่คิดตัวคูณความสูงหญ้า (ระดับ 0)
export const overgrownHeightLabel = 'มากกว่า 12"';
export const isOvergrown = (serviceName: string) => serviceName.startsWith('ตัดสวนรกร้าง');

// บริการที่ไม่ถามความสูงหญ้า (ใช้ระดับ 0 = ตัวคูณ × 1.0 เสมอ)
export const usesFixedHeight = (serviceName: string) => isPruningOnly(serviceName) || isOvergrown(serviceName);
export const fixedHeightLabel = (serviceName: string) => (isOvergrown(serviceName) ? overgrownHeightLabel : shrubHeightLabel);

// ข้อความความสูงสำหรับแสดงในรายละเอียดงาน
export function heightText(serviceName: string, grassHeight: number) {
  // "หญ้ามากกว่า 6"" → "หญ้าสูงกว่า 6"" · "หญ้าน้อยกว่า 6"" → "หญ้าต่ำกว่า 6""
  if (isOvergrown(serviceName)) return 'หญ้าสูงกว่า 12"';
  return usesFixedHeight(serviceName) ? fixedHeightLabel(serviceName) : `หญ้า${grassHeightLabels[grassHeight].replace('มากกว่า', 'สูงกว่า').replace('น้อยกว่า', 'ต่ำกว่า')}`;
}

// แพ็กเกจรายเดือน (1–3 ครั้งต่อเดือน) คิดราคาต่อครั้งเหมือนจ่ายครั้งเดียว ด้วยบริการนี้
export const monthlyPackageService = 'ตัดหญ้าและแต่งกิ่ง ขนทิ้ง';

export function pricePerVisit(serviceName: string, area: string | number, grassHeight: number) {
  const option = pricingOptions.find((item) => item.name === serviceName) ?? pricingOptions[0];
  const areaValue = Math.max(Number(area) || 0, 0);
  return Math.round((option.basePrice + Math.max(areaValue - baseAreaWa, 0) * option.extraPerWa) * grassHeightMultipliers[grassHeight]);
}

// ส่วนลดแพ็กเกจรายเดือนตามจำนวนครั้งต่อเดือน
export const monthlyDiscounts: Record<number, number> = { 1: 0.1, 2: 0.15, 3: 0.2 };

export function monthlyPackagePrice(frequency: number, area: string | number, grassHeight: number) {
  const fullPrice = pricePerVisit(monthlyPackageService, area, grassHeight) * frequency;
  return { fullPrice, price: Math.round(fullPrice * (1 - (monthlyDiscounts[frequency] ?? 0))) };
}

// ค่า Platform ที่หักจากราคาลูกค้า ก่อนแสดงเป็นรายได้สุทธิของช่าง
export const platformFeePercent = 15;

export function netPayout(price: number) {
  return Math.round(price * (1 - platformFeePercent / 100));
}
