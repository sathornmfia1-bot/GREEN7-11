'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BottomSheet, MobileStickyBar, mobileCtaClass } from './mobile';
import { fixedHeightLabel, grassHeightLabels, isOvergrown, isPruningOnly, pricePerVisit, pricingOptions, usesFixedHeight } from './pricing';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);
// มือถือ: ปุ่ม − / + ปรับพื้นที่ทีละ 10 ตารางวา
const areaStep = 10;

// ประเมินราคาเบื้องต้นในหน้าแรก (ราคาจริงคำนวณอีกครั้งจากตารางราคาในฐานข้อมูลตอนจอง)
// คอม: ฟอร์มแถวเดียวแบบเดิม · มือถือ: ช่องเรียงลงพร้อมป้ายชื่อ ปุ่ม "ดูราคาของฉัน" ติดด้านล่าง และผลราคาเปิดเป็น bottom sheet
export function PriceEstimator() {
  const [service, setService] = useState(pricingOptions[0].name);
  const [area, setArea] = useState('120');
  const [grassHeight, setGrassHeight] = useState(0);
  const [shown, setShown] = useState(false);
  // แต่งกิ่งอย่างเดียว / ตัดสวนรกร้าง: ไม่คิดตามความสูงหญ้า
  const fixedHeight = usesFixedHeight(service);
  const price = pricePerVisit(service, area, fixedHeight ? 0 : grassHeight);
  const stepArea = (delta: number) => { setArea(String(Math.max(1, (Number(area) || 0) + delta))); setShown(false); };
  const labelClass = 'max-sm:mb-1 max-sm:block max-sm:px-1 max-sm:text-[13px] max-sm:font-semibold max-sm:text-slate-600 sm:sr-only';

  return (
    <div className="max-w-3xl">
      <p className="font-display text-sm font-semibold text-accent-500 max-sm:hidden">ดูราคาของคุณได้ทันที ↘</p>
      <form
        id="estimate-form"
        onSubmit={(event) => { event.preventDefault(); setShown(true); }}
        className="mt-2 flex flex-col gap-2 rounded-3xl border-2 border-accent-500 bg-white p-2 max-sm:gap-3 max-sm:p-4 sm:inline-flex sm:flex-row sm:items-center sm:rounded-full"
      >
        <div>
          <label className={labelClass} htmlFor="estimate-service">บริการ</label>
          <select id="estimate-service" value={service} onChange={(event) => { setService(event.target.value); setShown(false); }} className="w-full min-w-0 rounded-full bg-transparent px-4 py-2.5 text-sm text-slate-700 focus:outline-none max-sm:h-[52px] max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:text-base sm:w-auto sm:flex-none sm:pr-2">
            {pricingOptions.map((option) => <option key={option.name}>{option.name}</option>)}
          </select>
        </div>
        <div className="max-sm:grid max-sm:grid-cols-1 max-sm:gap-3 sm:contents">
          <div>
            <label className={labelClass} htmlFor="estimate-area">พื้นที่ (ตร.ว.)</label>
            <div className="flex items-center gap-1 border-slate-200 px-4 max-sm:h-[52px] max-sm:justify-between max-sm:rounded-2xl max-sm:border max-sm:px-1 sm:border-l">
              <button type="button" onClick={() => stepArea(-areaStep)} aria-label={`ลดพื้นที่ ${areaStep} ตารางวา`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-brand-700 sm:hidden">−</button>
              <input id="estimate-area" type="number" inputMode="numeric" min="1" value={area} onChange={(event) => { setArea(event.target.value); setShown(false); }} className="w-16 bg-transparent py-2.5 text-sm text-slate-700 focus:outline-none max-sm:w-full max-sm:min-w-0 max-sm:text-center max-sm:text-lg max-sm:font-semibold" />
              <span className="text-sm text-slate-500 max-sm:hidden">ตารางวา</span>
              <button type="button" onClick={() => stepArea(areaStep)} aria-label={`เพิ่มพื้นที่ ${areaStep} ตารางวา`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-brand-700 sm:hidden">+</button>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="estimate-height">{fixedHeight && isPruningOnly(service) ? 'ความสูงพุ่มไม้' : 'ความสูงหญ้า'}</label>
            {/* ตัดสวนรกร้าง: แสดง "มากกว่า 12"" ในช่องที่เปลี่ยนไม่ได้ */}
            <select id="estimate-height" value={fixedHeight ? 0 : grassHeight} disabled={isOvergrown(service)} onChange={(event) => { setGrassHeight(Number(event.target.value)); setShown(false); }} className="w-full rounded-full bg-transparent px-4 py-2.5 text-sm text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500 max-sm:h-[52px] max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:text-base max-sm:disabled:bg-slate-100 sm:w-auto sm:rounded-none sm:border-l sm:border-slate-200">
              {fixedHeight
                ? <option value={0}>{fixedHeightLabel(service)}</option>
                : grassHeightLabels.map((label, index) => <option key={label} value={index}>หญ้าสูง{label}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-cta shrink-0 max-sm:hidden">ดูราคา</button>
      </form>
      <p className="mt-2 text-xs text-slate-500">🔒 ไม่ต้องสมัครก่อนดูราคา</p>

      {/* คอม: ผลราคาแสดงใต้ฟอร์ม */}
      {shown && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 max-sm:hidden">
          <div>
            <p className="text-sm text-slate-600">ราคาโดยประมาณ · {service}</p>
            <p className="font-display text-3xl font-semibold text-brand-700">฿{money(price)}</p>
          </div>
          <Link href="/login/customer?next=/customer" className="btn-green">จองเลย →</Link>
        </div>
      )}

      {/* มือถือ: ปุ่มหลักติดด้านล่าง → ผลราคาใน bottom sheet */}
      <MobileStickyBar>
        <button type="submit" form="estimate-form" className={`${mobileCtaClass} bg-accent-700 hover:bg-accent-600`}>ดูราคาของฉัน</button>
        <Link href="/login/customer" className="mx-auto mt-1 flex min-h-[44px] w-fit items-center px-4 text-sm font-semibold text-brand-700">เข้าสู่ระบบ</Link>
      </MobileStickyBar>
      <div className="sm:hidden">
        <BottomSheet
          open={shown}
          onClose={() => setShown(false)}
          title="ราคาโดยประมาณ"
          footer={<Link href="/login/customer?next=/customer" className={`${mobileCtaClass} bg-brand-700 hover:bg-brand-800`}>จองเลย</Link>}
        >
          <div role="status">
            <p className="text-sm text-slate-600">{service} · {money(Number(area) || 0)} ตร.ว.</p>
            <p className="mt-1 font-display text-4xl font-semibold text-brand-700">฿{money(price)}</p>
            <p className="mt-2 text-xs text-slate-500">ราคาจริงยืนยันอีกครั้งตอนจอง</p>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
