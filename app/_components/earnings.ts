import { isoDateFromToday } from './date-input';
import { netPayout, pricePerVisit, pricingOptions } from './pricing';

// งานที่ทำเสร็จแล้ว ใช้สำหรับรายงานรายรับ (ตัวอย่างหน้าจอ แทนข้อมูลจากเซิร์ฟเวอร์)
export type CompletedJob = {
  id: number;
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

// ช่างที่ใช้งานหน้านี้อยู่ (บัญชีตัวอย่าง)
export const currentWorkerId = 'me';

const workers = [
  { id: currentWorkerId, name: 'คุณ (บัญชีนี้)' },
  { id: 'w-prasert', name: 'ประเสริฐ ขยันดี' },
  { id: 'w-wilai', name: 'วิไล สวนสวย' },
];
const customerNames = ['นุช สายสวน', 'มานะ ตั้งใจ', 'ฐิติมา ร่มเย็น', 'สมศรี ใบไม้', 'สมชาย ใจดี', 'กมล ทองดี', 'อรุณ แสงทอง', 'พรทิพย์ ใจงาม'];

// สุ่มแบบกำหนดค่าเริ่มต้น เพื่อให้ตัวเลขรายงานเหมือนเดิมทุกครั้งที่เปิด
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function buildHistory(): CompletedJob[] {
  const random = seeded(42);
  const history: CompletedJob[] = [];
  let id = 1000;
  for (let daysAgo = 90; daysAgo >= 0; daysAgo -= 1) {
    const jobsToday = random() < 0.55 ? 1 + Math.floor(random() * 2) : 0;
    for (let index = 0; index < jobsToday; index += 1) {
      const worker = workers[Math.floor(random() * workers.length)];
      const service = pricingOptions[Math.floor(random() * pricingOptions.length)].name;
      const area = 60 + Math.round(random() * 24) * 10;
      const grassHeight = random() < 0.7 ? 0 : random() < 0.75 ? 1 : 2;
      const price = pricePerVisit(service, area, grassHeight);
      const net = netPayout(price);
      const reviewed = random() < 0.65;
      // ช่างโอนได้เมื่อรีวิวแล้ว หรือครบ 2 วัน — งานล่าสุดบางงานยังพักใน Escrow
      const payoutReleased = daysAgo > 3 ? random() < 0.95 : reviewed && random() < 0.5;
      history.push({
        id: id++,
        date: isoDateFromToday(-daysAgo),
        workerId: worker.id,
        workerName: worker.name,
        customerName: customerNames[Math.floor(random() * customerNames.length)],
        service,
        area,
        grassHeight,
        price,
        platformFee: price - net,
        net,
        reviewed,
        rating: reviewed ? (id % 9 === 0 ? 3 : id % 4 === 0 ? 4 : 5) : undefined,
        payoutReleased,
      });
    }
  }
  return history;
}

export const completedJobHistory = buildHistory();

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

// เรทติ้งของช่าง: ค่าเฉลี่ยจากรีวิวในประวัติ + รีวิวใหม่ที่ได้รับ
export function workerRating(workerId: string, extraRatings: number[] = []) {
  const workerJobs = completedJobHistory.filter((job) => job.workerId === workerId);
  const ratings = [...workerJobs.flatMap((job) => (job.rating ? [job.rating] : [])), ...extraRatings];
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
  return { average: Math.round(average * 10) / 10, reviewCount: ratings.length, completedJobs: workerJobs.length + extraRatings.length };
}
