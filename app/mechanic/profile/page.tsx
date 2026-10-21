'use client';

import { useState } from 'react';
import { AddressEditor, formatAddress, type AddressDetails } from '../../_components/address';
import { useMechanic, useRun } from '../../_components/role-shell';
import { updateMechanicBase } from '../../_server/actions';
import { formatPhone } from '../../_lib/rules';
import { VerificationBanner } from '../_components/verification-banner';

const statusLabels = {
  pending_verification: { text: '⏳ รอแอดมินตรวจสอบ', className: 'bg-amber-100 text-amber-800' },
  verified: { text: '✓ อนุมัติแล้ว · รับงานได้', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { text: '✕ ไม่ผ่านการอนุมัติ', className: 'bg-rose-100 text-rose-800' },
} as const;

export default function MechanicProfilePage() {
  const mechanic = useMechanic();
  const run = useRun();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AddressDetails>(mechanic.baseAddress);
  const stats = { average: mechanic.ratingAverage, reviewCount: mechanic.ratingCount, completedJobs: mechanic.completedJobsCount };

  async function saveBase() {
    const result = await run(updateMechanicBase(draft));
    if (result.ok) setEditing(false);
  }

  return (
    <div className="space-y-6">
      <VerificationBanner mechanic={mechanic} />
      <section className="card p-4 sm:p-6">
        <div className="flex items-center gap-4">
          {mechanic.photoDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={mechanic.photoDataUrl} alt="รูปโปรไฟล์" className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
            : <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700">{mechanic.firstName.charAt(0)}</span>}
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">{mechanic.firstName} {mechanic.lastName}</h1>
            <span className={`badge mt-1 ${statusLabels[mechanic.status].className}`}>{statusLabels[mechanic.status].text}</span>
            {stats.reviewCount > 0 && <p className="mt-1 text-sm text-slate-600"><span className="text-amber-500">★</span> {stats.average.toFixed(1)} ({stats.reviewCount} รีวิว) · ทำงานแล้ว {stats.completedJobs} งาน</p>}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">เบอร์โทร (ใช้เข้าสู่ระบบ)</dt><dd className="mt-0.5 font-medium text-slate-900">{formatPhone(mechanic.phone)}</dd></div>
          <div><dt className="text-slate-500">บัญชีรับเงิน</dt><dd className="mt-0.5 font-medium text-slate-900">{mechanic.bankName} xxx-{mechanic.accountLast4} · {mechanic.accountName}</dd></div>
          <div><dt className="text-slate-500">รัศมีให้บริการ</dt><dd className="mt-0.5 font-medium text-slate-900">{mechanic.serviceRadiusKm} กม.</dd></div>
          <div><dt className="text-slate-500">บัตรประชาชน</dt><dd className="mt-0.5 font-medium text-slate-900">👷 ส่งแล้ว</dd></div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">ชื่อ-นามสกุลและบัญชีรับเงินแก้ไขไม่ได้ · หากต้องการเปลี่ยน กรุณาติดต่อแอดมิน</p>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">ที่อยู่ปัจจุบัน (จุดฐาน)</h2>
        <p className="mt-1 text-sm text-slate-600">ใช้คำนวณระยะทางไปยังสถานที่บริการใน Job Pool · ต้องปักหมุดตำแหน่ง</p>
        {editing ? (
          <div className="mt-3">
            <AddressEditor details={draft} onChange={setDraft} />
            <div className="mt-3 flex gap-2"><button type="button" onClick={saveBase} className="rounded-full bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600">บันทึกที่อยู่ฐาน</button><button type="button" onClick={() => setEditing(false)} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">📍 {formatAddress(mechanic.baseAddress)}</p>
            <button type="button" onClick={() => { setDraft(mechanic.baseAddress); setEditing(true); }} className="mt-3 rounded-full border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">แก้ไขที่อยู่ฐาน</button>
          </div>
        )}
      </section>
    </div>
  );
}
