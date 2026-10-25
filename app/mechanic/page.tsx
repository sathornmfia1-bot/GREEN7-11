'use client';

import { distanceKm, formatAddress, formatDistance, mapQuery } from '../_components/address';
import { formatThaiDate } from '../_components/date-input';
import { heightText, netPayout, platformFeePercent } from '../_components/pricing';
import { useData, useMechanic, useRun } from '../_components/role-shell';
import { acceptJob } from '../_server/actions';
import { jobAreaBlockReason, jobWhen, maxJobArea, maxTeamSize, money } from '../_lib/rules';
import { VerificationBanner } from './_components/verification-banner';

// ช่าง: งานใหม่ใน Job Pool (งานที่ยังไม่มีช่างรับ) — ไม่แสดงเบอร์โทรลูกค้าจนกว่าจะรับงาน
export default function MechanicJobPoolPage() {
  const db = useData();
  const mechanic = useMechanic();
  const run = useRun();
  const base = mechanic.baseAddress.location ?? null;
  const bookedDates = new Set(db.jobs.filter((job) => job.mechanicId === mechanic.id && !job.cancelledAt).map((job) => job.date));
  const canAccept = mechanic.status === 'verified';

  const pool = db.jobs
    .filter((job) => !job.mechanicId && !job.cancelledAt)
    .map((job) => ({ job, distance: base && job.address.location ? distanceKm(base, job.address.location) : null }))
    // เรียงตามวันนัดหมาย แล้วตามเวลา · วันเวลาเท่ากัน งานที่ใกล้กว่ามาก่อน
    .sort((a, b) => a.job.date.localeCompare(b.job.date) || (a.job.time ?? '').localeCompare(b.job.time ?? '') || (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return (
    <div>
      <VerificationBanner mechanic={mechanic} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">งานใหม่ใน Job Pool</h1>
        <span className="badge bg-brand-100 text-brand-700">{pool.length} งาน</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">ราคาที่แสดงเป็นราคาสุทธิ หลังหักค่า Platform {platformFeePercent}% · ทีมคุณ {Math.min(maxTeamSize, Math.max(1, mechanic.teamSize ?? 1))} คน รับงานได้ไม่เกิน {money(maxJobArea(mechanic.teamSize))} ตร.ว.</p>

      <div className="mt-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {pool.length ? pool.map(({ job, distance }) => {
          const busy = bookedDates.has(job.date);
          // พื้นที่เกินกำลังทีม (คนละ 400 ตร.ว.) → รับงานไม่ได้
          const tooLarge = jobAreaBlockReason(job.area, mechanic.teamSize);
          return (
            <article key={job.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2 text-xs">
                <span className="font-medium text-slate-600">📅 {jobWhen(job)} · {job.title}</span>
                <span className="badge shrink-0 bg-amber-100 text-amber-700">{job.status}</span>
              </div>
              <div className="px-4 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">{job.service} <span className="whitespace-nowrap text-slate-600">{money(job.area)} ตารางวา</span> <span className="whitespace-nowrap text-slate-600">· {heightText(job.service, job.grassHeight)}</span></p>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold leading-tight text-brand-700">฿{money(netPayout(job.price))}</p>
                    {job.priceNote && <p className="text-xs text-slate-500">{job.priceNote}</p>}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  <li className="flex gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-center">👤</span><span><span className="sr-only">ลูกค้า: </span>{job.firstName} {job.lastName}</span></li>
                  <li className="flex gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-center">📍</span><span><span className="sr-only">ที่อยู่บริการ: </span>{formatAddress(job.address)}</span></li>
                  <li className="flex gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-center">🚗</span><span><span className="sr-only">ระยะทาง: </span>
                    {distance !== null
                      ? <><span className="font-semibold text-slate-900">ห่าง {formatDistance(distance)}</span> <span className="text-xs text-slate-500">(เส้นตรง)</span> <a href={`https://www.google.com/maps/dir/?api=1&origin=${base!.lat},${base!.lng}&destination=${encodeURIComponent(mapQuery(job.address))}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-medium text-brand-700 hover:underline">ดูเส้นทาง ↗</a></>
                      : <span className="text-slate-500">ลูกค้ายังไม่ได้ปักหมุดตำแหน่ง</span>}
                  </span></li>
                </ul>
                {job.photos && job.photos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`รูปสนามหญ้า ${job.photos.length} รูป`}>
                    {job.photos.map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={index} src={url} alt={`รูปสนามหญ้า ${index + 1}`} className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover" />
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                {!canAccept && <span className="text-xs text-amber-700">{mechanic.status === 'rejected' ? 'ใบสมัครไม่ผ่านการอนุมัติ' : 'รอแอดมินอนุมัติบัญชีก่อนรับงาน'}</span>}
                {busy && <span className="text-xs text-rose-700">คุณมีงานวันที่ {formatThaiDate(job.date)} แล้ว · รับได้วันละ 1 งาน</span>}
                {tooLarge && <span className="text-xs text-rose-700">{tooLarge}</span>}
                <button type="button" onClick={() => { run(acceptJob(job.id)); }} disabled={!canAccept || busy || Boolean(tooLarge)} className="rounded-full bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? 'ไม่ว่าง' : tooLarge ? 'เกินกำลังทีม' : 'รับงาน'}</button>
              </div>
            </article>
          );
        }) : <p className="card p-6 text-center text-sm text-slate-600 lg:col-span-2">ไม่มีงานใหม่ใน Job Pool</p>}
      </div>
    </div>
  );
}
