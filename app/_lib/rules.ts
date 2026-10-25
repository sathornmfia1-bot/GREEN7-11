import { daysFromToday, formatRelativeThaiDate, formatThaiDate, isoDateBefore } from '../_components/date-input';
import type { Job, WorkStage } from '../_components/jobs';

// กฎธุรกิจที่ใช้ร่วมกันทุก role (PRD ข้อ 5)
export const escrowReleaseDays = 2;
export const customerCancelDaysBefore = 2;
export const mechanicCancelDaysBefore = 2;
export const adjustmentExpiryMinutes = 60;
export const maxLawnPhotos = 10;

export const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

// 0812345678 → 081-234-5678
export function formatPhone(digits: string) {
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

export function formatTime(iso: string) {
  return iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
}

export function formatLocalDateTime(time: number | string) {
  const at = new Date(time);
  const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return `${formatThaiDate(iso)} ${at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
}

export function jobWhen(job: Job) {
  return [formatRelativeThaiDate(job.date), job.time].filter(Boolean).join(' ');
}

// ขั้นตอนที่ช่างกด และข้อความแจ้งเตือนที่ส่งถึงลูกค้า
export const workStageActions: Record<Exclude<WorkStage, 'done'>, { next: WorkStage; label: string; message: string }> = {
  matched: { next: 'arrived', label: '📍 ถึงที่นัดหมายแล้ว', message: 'ช่างถึงที่นัดหมายแล้ว' },
  arrived: { next: 'working', label: '▶️ เริ่มทำงาน', message: 'ช่างเริ่มทำงานแล้ว' },
  working: { next: 'done', label: '✅ ทำงานเสร็จแล้ว', message: 'ช่างทำงานเสร็จแล้ว และขอให้คุณช่วยรีวิว' },
};

// ขอปรับราคา: ได้เฉพาะหลังช่างกด "ถึงที่นัดหมายแล้ว" (ถึงหน้างาน/กำลังทำงาน) · งานละ 1 ครั้ง · งานรายเดือนขอไม่ได้
export const maxAdjustmentsPerJob = 1;

export function adjustmentBlockReason(stage: WorkStage, isMonthly: boolean, previousRequests: number): string | null {
  if (isMonthly) return 'งานแพ็กเกจรายเดือนไม่สามารถขอปรับราคาได้';
  if (previousRequests >= maxAdjustmentsPerJob) return `ขอปรับราคาได้ ${maxAdjustmentsPerJob} ครั้งต่องาน · งานนี้ใช้สิทธิ์แล้ว`;
  if (stage === 'matched') return 'ขอปรับราคาได้หลังกด “📍 ถึงที่นัดหมายแล้ว” เท่านั้น';
  if (stage === 'done') return 'งานเสร็จแล้ว ไม่สามารถขอปรับราคาได้';
  return null;
}

// กำลังรับงานตามจำนวนสมาชิก: คนละไม่เกิน 400 ตร.ว. (ทำคนเดียว = รับงานได้ไม่เกิน 400 ตร.ว.) · สมาชิกได้สูงสุด 5 คน
export const maxTeamSize = 5;
export const areaPerMember = 400;

export function maxJobArea(teamSize: number | undefined) {
  const members = Math.min(maxTeamSize, Math.max(1, Math.round(teamSize ?? 1)));
  return members * areaPerMember;
}

export function jobAreaBlockReason(area: number, teamSize: number | undefined): string | null {
  const limit = maxJobArea(teamSize);
  if (area <= limit) return null;
  const members = limit / areaPerMember;
  return `งานนี้ ${area.toLocaleString('th-TH')} ตร.ว. เกินกำลังทีมคุณ (${members} คน รับได้ไม่เกิน ${limit.toLocaleString('th-TH')} ตร.ว.)`;
}

// รูปงานที่เสร็จแล้วที่ช่างต้องแนบตอนกด "ทำงานเสร็จแล้ว"
export const minCompletionPhotos = 5;
export const maxCompletionPhotos = 10;

export const workStageLabels: Record<WorkStage, string> = { matched: 'จับคู่ช่างแล้ว', arrived: 'ถึงที่นัดหมายแล้ว', working: 'กำลังทำงาน', done: 'ทำงานเสร็จแล้ว' };

export const customerSteps = ['รอช่างรับ', 'จับคู่ช่างแล้ว', 'กำลังทำงาน', 'รอตรวจรับ', 'เสร็จสมบูรณ์'];

// สถานะงานที่ลูกค้าเห็นบน step tracker
export function customerStepIndex(job: Job, reviewed: boolean) {
  if (!job.mechanicId) return 0;
  const stage = job.workStage ?? 'matched';
  if (stage === 'matched') return 1;
  if (stage === 'arrived' || stage === 'working') return 2;
  return reviewed ? 4 : 3;
}

export function canMechanicCancel(job: Job) {
  return (job.workStage ?? 'matched') === 'matched' && daysFromToday(job.date) >= mechanicCancelDaysBefore;
}

export function mechanicCancelDeadline(job: Job) {
  return isoDateBefore(job.date, mechanicCancelDaysBefore);
}

export function canCustomerCancel(job: Job) {
  return !job.cancelledAt && (job.workStage ?? 'matched') === 'matched' && daysFromToday(job.date) >= customerCancelDaysBefore;
}

export function customerCancelDeadline(job: Job) {
  return isoDateBefore(job.date, customerCancelDaysBefore);
}

export function payoutAvailableAt(job: Job) {
  return job.completedAt ? new Date(job.completedAt).getTime() + escrowReleaseDays * 86400000 : Infinity;
}

export function canReleasePayout(job: Job, reviewed: boolean) {
  if (job.workStage !== 'done' || job.payoutReleasedAt) return false;
  return reviewed || Date.now() >= payoutAvailableAt(job);
}
