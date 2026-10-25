import { EquipmentArt } from './equipment-art';
import { cleanEquipment, equipmentLabel } from '../_lib/equipment';

// การ์ดข้อมูลช่างที่ลูกค้าเห็นหลังช่างกดรับงาน
export function WorkerCard({
  name,
  photo,
  rating,
  reviewCount,
  completedJobs,
  status,
  equipment = [],
}: {
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  status: string;
  // เครื่องมือที่ช่างใช้ (เลือกตอนสมัคร) · ว่าง = ไม่แสดงส่วนนี้
  equipment?: string[];
}) {
  const fullStars = Math.round(rating);
  const tools = cleanEquipment(equipment);
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-4">
    <div className="flex items-center gap-4">
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt={`รูปช่าง ${name}`} className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
        : <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{name.trim().charAt(0) || '👤'}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-brand-700">ช่างของคุณ · {status}</p>
        <p className="truncate text-lg font-bold text-slate-900">{name}</p>
        {reviewCount > 0 ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            <span aria-label={`เรทติ้ง ${rating} จาก 5`}><span className="text-amber-500" aria-hidden="true">{'★'.repeat(fullStars)}<span className="text-slate-300">{'★'.repeat(5 - fullStars)}</span></span> <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span></span>
            <span>({reviewCount} รีวิว)</span>
            <span>· ทำงานแล้ว {completedJobs} งาน</span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-600">ช่างใหม่ · ยังไม่มีรีวิว</p>
        )}
      </div>
    </div>
      {tools.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">เครื่องมือที่ใช้</p>
          {/* มือถือ: แถวเดียวเลื่อนซ้าย-ขวา · คอม: ตาราง */}
          <ul className="mt-2 grid grid-cols-2 gap-2 max-sm:-mx-4 max-sm:flex max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] sm:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool} className="flex items-center gap-2 rounded-lg bg-slate-50 p-1.5 pr-2 max-sm:shrink-0 max-sm:pr-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white"><EquipmentArt type={tool} className="h-10 w-10" /></span>
                <span className="text-xs font-medium leading-snug text-slate-700 max-sm:whitespace-nowrap">{equipmentLabel(tool)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
