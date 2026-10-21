'use client';

import { useState } from 'react';
import Link from 'next/link';
import { grassHeightLabels, isPruningOnly, pricePerVisit, pricingOptions, shrubHeightLabel } from './pricing';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

// ประเมินราคาเบื้องต้นในหน้าแรก (ราคาจริงคำนวณอีกครั้งจากตารางราคาในฐานข้อมูลตอนจอง)
export function PriceEstimator() {
  const [service, setService] = useState(pricingOptions[0].name);
  const [area, setArea] = useState('120');
  const [grassHeight, setGrassHeight] = useState(0);
  const [shown, setShown] = useState(false);
  const pruningOnly = isPruningOnly(service);
  const price = pricePerVisit(service, area, pruningOnly ? 0 : grassHeight);

  return (
    <div className="max-w-3xl">
      <p className="font-display text-sm font-semibold text-accent-500">ดูราคาของคุณได้ทันที ↘</p>
      <form
        onSubmit={(event) => { event.preventDefault(); setShown(true); }}
        className="mt-2 flex flex-col gap-2 rounded-3xl sm:inline-flex border-2 border-accent-500 bg-white p-2 sm:flex-row sm:items-center sm:rounded-full"
      >
        <label className="sr-only" htmlFor="estimate-service">ประเภทบริการ</label>
        <select id="estimate-service" value={service} onChange={(event) => { setService(event.target.value); setShown(false); }} className="w-full min-w-0 rounded-full bg-transparent px-4 py-2.5 text-sm text-slate-700 focus:outline-none sm:w-auto sm:flex-none sm:pr-2">
          {pricingOptions.map((option) => <option key={option.name}>{option.name}</option>)}
        </select>
        <div className="flex items-center gap-1 border-slate-200 px-4 sm:border-l">
          <label className="sr-only" htmlFor="estimate-area">พื้นที่ (ตารางวา)</label>
          <input id="estimate-area" type="number" min="1" value={area} onChange={(event) => { setArea(event.target.value); setShown(false); }} className="w-16 bg-transparent py-2.5 text-sm text-slate-700 focus:outline-none" />
          <span className="text-sm text-slate-500">ตารางวา</span>
        </div>
        <label className="sr-only" htmlFor="estimate-height">{pruningOnly ? 'ความสูงพุ่มไม้' : 'ความสูงหญ้า'}</label>
        <select id="estimate-height" value={pruningOnly ? 0 : grassHeight} onChange={(event) => { setGrassHeight(Number(event.target.value)); setShown(false); }} className="rounded-full bg-transparent px-4 py-2.5 text-sm text-slate-700 focus:outline-none sm:border-l sm:border-slate-200 sm:rounded-none">
          {pruningOnly
            ? <option value={0}>{shrubHeightLabel}</option>
            : grassHeightLabels.map((label, index) => <option key={label} value={index}>หญ้าสูง{label}</option>)}
        </select>
        <button type="submit" className="btn-cta shrink-0">ดูราคา</button>
      </form>
      <p className="mt-2 text-xs text-slate-500">🔒 ไม่ต้องสมัครก่อนดูราคา</p>

      {shown && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4">
          <div>
            <p className="text-sm text-slate-600">ราคาโดยประมาณ · {service}</p>
            <p className="font-display text-3xl font-semibold text-brand-700">฿{money(price)}</p>
          </div>
          <Link href="/login/customer?next=/customer" className="btn-green">จองเลย →</Link>
        </div>
      )}
    </div>
  );
}
