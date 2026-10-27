// ตารางนัดของแพ็กเกจรายเดือน (ใช้ทั้งหน้าเว็บและเซิร์ฟเวอร์)
// ลูกค้าเลือกวันนัดแรก → ระบบเว้นระยะนัดที่เหลือเท่า ๆ กันในรอบ 30 วัน · รอบถัดไปเริ่มวันที่ 31 นับจากนัดแรก

export const cycleDays = 30;
// ระยะห่างระหว่างนัดตามจำนวนครั้งต่อเดือน (วัน)
export const visitIntervalDays: Record<number, number> = { 1: 30, 2: 15, 3: 10, 4: 7 };
// เลื่อนนัด: นัดต้องห่างกันอย่างน้อย 4 วัน · เลื่อนได้ก่อนวันนัดอย่างน้อย 1 วัน (24 ชม.)
export const minVisitGapDays = 4;
export const rescheduleLeadDays = 1;
// สร้างงานเข้า Job Pool ล่วงหน้า 7 วันก่อนนัด · นัดถัดไปเสนอให้ช่างคนเดิมก่อน 24 ชม.
export const releaseLeadDays = 7;
export const offerHours = 24;

export type PlannedVisit = { visitNo: number; cycleNo: number; date: string; cycleStart: string; cycleEnd: string };

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}

export function visitSchedule(firstDate: string, visitsPerMonth: number, months: number): PlannedVisit[] {
  const interval = visitIntervalDays[visitsPerMonth] ?? cycleDays;
  const visits: PlannedVisit[] = [];
  for (let cycle = 0; cycle < months; cycle += 1) {
    const cycleStart = addDays(firstDate, cycle * cycleDays);
    const cycleEnd = addDays(cycleStart, cycleDays - 1);
    for (let index = 0; index < visitsPerMonth; index += 1) {
      visits.push({ visitNo: visits.length + 1, cycleNo: cycle + 1, date: addDays(cycleStart, index * interval), cycleStart, cycleEnd });
    }
  }
  return visits;
}

// ตรวจวันที่ใหม่ของการเลื่อนนัด · today = วันนี้ (yyyy-mm-dd) · others = วันนัดอื่นของแพ็กเกจเดียวกัน
export function rescheduleProblem(visit: { date: string; cycleStart: string; cycleEnd: string }, newDate: string, others: string[], today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return 'กรุณาเลือกวันนัดใหม่';
  if (daysBetween(today, visit.date) < rescheduleLeadDays) return 'เลื่อนนัดได้ก่อนวันนัดอย่างน้อย 1 วัน';
  if (daysBetween(today, newDate) < rescheduleLeadDays) return 'วันนัดใหม่ต้องเป็นพรุ่งนี้เป็นต้นไป';
  if (newDate < visit.cycleStart || newDate > visit.cycleEnd) return 'เลื่อนได้ภายในรอบเดือนเดียวกันเท่านั้น';
  if (others.some((date) => Math.abs(daysBetween(date, newDate)) < minVisitGapDays)) return `แต่ละนัดต้องห่างกันอย่างน้อย ${minVisitGapDays} วัน`;
  return null;
}
