'use client';

import { useEffect, useState } from 'react';
import { latestBookingActivity } from '../_server/actions';

function timeAgo(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.round(hours / 24)} วันที่แล้ว`;
}

// ป้ายการจองล่าสุดจริงจากฐานข้อมูล (แสดงเฉพาะพื้นที่และบริการ) · ไม่มีการจอง = ไม่แสดง
export function RecentBooking() {
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof latestBookingActivity>>>(null);

  useEffect(() => {
    latestBookingActivity().then(setActivity).catch(() => setActivity(null));
  }, []);

  if (!activity) return null;
  return (
    <div className="flex max-w-xs items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-lift">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">📍</span>
      <div className="min-w-0 text-xs">
        <p className="truncate font-semibold text-slate-900">ลูกค้าใน{activity.amphoe} <span className="font-normal text-slate-500">({activity.province})</span></p>
        <p className="truncate text-slate-700">เพิ่งจอง{activity.service}</p>
        <p className="text-slate-500">{timeAgo(activity.createdAt)} · <span className="text-brand-600">✓ จองจริงในระบบ</span></p>
      </div>
    </div>
  );
}
