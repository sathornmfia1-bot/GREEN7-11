import { isoDateFromToday } from './date-input';
import { netPayout } from './pricing';

// งานที่ทำเสร็จแล้ว ใช้สำหรับรายงานรายรับ (แปลงจากงานจริงในฐานข้อมูล)
export type CompletedJob = {
  id: string;
  date: string; // วันที่ทำงานเสร็จ (yyyy-mm-dd)
  workerId: string;
  workerName: string;
  customerName: string;
  service: string;
  area: number;
  grassHeight: number;
  price: number; // ราคาที่ลูกค้าจ่าย
  platformFee: number;
  net: number; // ช่างได้รับ
  reviewed: boolean;
  rating?: number; // คะแนนรีวิว 1–5 (เฉพาะงานที่ลูกค้ารีวิว)
  payoutReleased: boolean;
};


export type Period = 7 | 30 | 90;
export const periodOptions: { days: Period; label: string }[] = [
  { days: 7, label: '7 วันล่าสุด' },
  { days: 30, label: '30 วันล่าสุด' },
  { days: 90, label: '90 วันล่าสุด' },
];

export function jobsInPeriod(jobs: CompletedJob[], days: Period) {
  const from = isoDateFromToday(-(days - 1));
  return jobs.filter((job) => job.date >= from);
}

export function summarize(jobs: CompletedJob[]) {
  return jobs.reduce((total, job) => ({
    count: total.count + 1,
    gross: total.gross + job.price,
    platformFee: total.platformFee + job.platformFee,
    net: total.net + job.net,
    released: total.released + (job.payoutReleased ? job.net : 0),
    held: total.held + (job.payoutReleased ? 0 : job.net),
  }), { count: 0, gross: 0, platformFee: 0, net: 0, released: 0, held: 0 });
}

export type Bucket = { key: string; label: string; detail: string; value: number; count: number };

// 7 วัน → รายวัน, 30/90 วัน → รายสัปดาห์ (เรียงจากเก่าไปใหม่)
export function bucketize(jobs: CompletedJob[], days: Period, valueOf: (job: CompletedJob) => number): Bucket[] {
  const size = days === 7 ? 1 : 7;
  const count = Math.ceil(days / size);
  const buckets: Bucket[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const end = isoDateFromToday(-index * size);
    const start = isoDateFromToday(-(index * size + size - 1));
    const inBucket = jobs.filter((job) => job.date >= start && job.date <= end);
    const [, startMonth, startDay] = start.split('-');
    const [, endMonth, endDay] = end.split('-');
    buckets.push({
      key: start,
      label: `${Number(startDay)}/${Number(startMonth)}`,
      detail: size === 1 ? `${Number(startDay)}/${Number(startMonth)}` : `${Number(startDay)}/${Number(startMonth)} – ${Number(endDay)}/${Number(endMonth)}`,
      value: inBucket.reduce((sum, job) => sum + valueOf(job), 0),
      count: inBucket.length,
    });
  }
  return buckets;
}

export function groupBy<T extends string>(jobs: CompletedJob[], keyOf: (job: CompletedJob) => T) {
  const groups = new Map<T, CompletedJob[]>();
  jobs.forEach((job) => groups.set(keyOf(job), [...(groups.get(keyOf(job)) ?? []), job]));
  return [...groups.entries()].map(([key, items]) => ({ key, ...summarize(items) }));
}


// แปลงงานที่ทำเสร็จจริงในระบบ (ฐานข้อมูลจำลอง) เป็นแถวรายงาน
export function toCompletedJobs(
  jobs: { id: string; mechanicId?: string; workStage?: string; completedAt?: string; cancelledAt?: string; service: string; area: number; grassHeight: number; price: number; firstName: string; lastName: string; payoutReleasedAt?: string }[],
  reviews: { jobId: string; rating: number }[],
  workerName: (mechanicId: string) => string,
): CompletedJob[] {
  return jobs
    .filter((job) => job.mechanicId && job.workStage === 'done' && job.completedAt && !job.cancelledAt)
    .map((job) => {
      const at = new Date(job.completedAt!);
      const review = reviews.find((item) => item.jobId === job.id);
      const net = netPayout(job.price);
      return {
        id: job.id,
        date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`,
        workerId: job.mechanicId!,
        workerName: workerName(job.mechanicId!),
        customerName: `${job.firstName} ${job.lastName}`,
        service: job.service,
        area: job.area,
        grassHeight: job.grassHeight,
        price: job.price,
        platformFee: job.price - net,
        net,
        reviewed: Boolean(review),
        rating: review?.rating,
        payoutReleased: Boolean(job.payoutReleasedAt),
      };
    });
}
