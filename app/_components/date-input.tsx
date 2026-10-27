'use client';

import { useRef } from 'react';

// แปลง yyyy-mm-dd (ค่าจาก input type="date", ปี ค.ศ.) เป็น วว/ดด/ปปปป (ปี พ.ศ.)
export function formatThaiDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return year && month && day ? `${day}/${month}/${Number(year) + 543}` : '';
}

export function isoDateFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// จำนวนวันจากวันนี้ถึงวันที่กำหนด (วันนี้ = 0, พรุ่งนี้ = 1, เมื่อวาน = -1)
export function daysFromToday(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function todayIsoDate() {
  return isoDateFromToday(0);
}

// แสดงวันที่แบบ "วันนี้" / "พรุ่งนี้" / วว/ดด/ปปปป
export function formatRelativeThaiDate(isoDate: string) {
  if (isoDate === isoDateFromToday(0)) return 'วันนี้';
  if (isoDate === isoDateFromToday(1)) return 'พรุ่งนี้';
  return formatThaiDate(isoDate);
}

// ช่องวันที่ที่แสดงผลเป็น วว/ดด/ปปปป เสมอ ไม่ขึ้นกับภาษาของเบราว์เซอร์ แต่ยังใช้ปฏิทินของเบราว์เซอร์ในการเลือก
export function DateInput({ id, value, onChange, min, max, className = '' }: { id?: string; value: string; onChange: (isoDate: string) => void; min?: string; max?: string; className?: string }) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        readOnly
        value={formatThaiDate(value)}
        placeholder="วว/ดด/ปปปป"
        onClick={openPicker}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } }}
        className={`cursor-pointer pr-10 ${className}`}
      />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</span>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-full opacity-0"
      />
    </div>
  );
}

// วันที่ย้อนหลังจากวันที่กำหนด n วัน (yyyy-mm-dd)
export function isoDateBefore(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
