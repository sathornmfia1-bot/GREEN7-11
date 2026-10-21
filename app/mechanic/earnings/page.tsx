'use client';

import { useState } from 'react';
import { ColumnChart } from '../../_components/column-chart';
import { formatThaiDate, isoDateFromToday } from '../../_components/date-input';
import { bucketize, jobsInPeriod, periodOptions, summarize, toCompletedJobs, type Period } from '../../_components/earnings';
import { useData, useMechanic } from '../../_components/role-shell';
import { PeriodFilter, StatTile } from '../../_components/stat-tile';
import { money } from '../../_lib/rules';

// ช่าง: รายรับของตัวเองเท่านั้น (งานที่ทำเสร็จจริงในฐานข้อมูล) · ไม่แสดงรายได้ Platform
export default function MechanicEarningsPage() {
  const db = useData();
  const mechanic = useMechanic();
  const myHistory = toCompletedJobs(db.jobs.filter((job) => job.mechanicId === mechanic.id), db.reviews, () => `${mechanic.firstName} ${mechanic.lastName}`);
  const [period, setPeriod] = useState<Period>(30);
  const jobs = jobsInPeriod(myHistory, period);
  const summary = summarize(jobs);
  // ช่วงก่อนหน้าที่ยาวเท่ากัน (ข้อมูลตัวอย่างย้อนหลัง 90 วัน จึงเทียบได้เฉพาะ 7 และ 30 วัน)
  const previous = summarize(myHistory.filter((job) => job.date >= isoDateFromToday(-(period * 2 - 1)) && job.date < isoDateFromToday(-(period - 1))));
  const change = period < 90 && previous.net > 0 ? Math.round(((summary.net - previous.net) / previous.net) * 100) : null;
  const sortedJobs = [...jobs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">รายงานรายรับของฉัน</h1>
          <p className="mt-1 text-sm text-slate-600">รายรับสุทธิที่คุณได้รับ · นับจากวันที่ทำงานเสร็จ</p>
        </div>
        <PeriodFilter value={period} options={periodOptions} onChange={setPeriod} />
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="สรุปรายรับ">
        <StatTile emphasis label="รายรับสุทธิ" value={`฿${money(summary.net)}`} hint={change === null ? `${summary.count} งาน` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% เทียบ ${period} วันก่อนหน้า`} />
        <StatTile label="โอนเข้าบัญชีแล้ว" value={`฿${money(summary.released)}`} hint="ถอนออกจาก Escrow แล้ว" />
        <StatTile label="รอโอน (Escrow)" value={`฿${money(summary.held)}`} hint="โอนได้เมื่อลูกค้ารีวิว หรือครบ 2 วัน" />
        <StatTile label="งานที่ทำเสร็จ" value={`${summary.count} งาน`} hint={summary.count ? `เฉลี่ย ฿${money(Math.round(summary.net / summary.count))}/งาน` : undefined} />
      </section>

      <section className="mt-6">
        <ColumnChart title={period === 7 ? 'รายรับสุทธิรายวัน' : 'รายรับสุทธิรายสัปดาห์'} buckets={bucketize(jobs, period, (job) => job.net)} valueLabel="รายรับสุทธิ" />
      </section>

      <section className="card mt-6 overflow-hidden" aria-label="รายการงาน">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">รายการงาน</h2>
        </div>
        {/* มือถือ: แสดงเป็นรายการการ์ด ให้เห็นยอดที่ได้รับโดยไม่ต้องเลื่อนตารางด้านข้าง */}
        <ul className="divide-y divide-slate-100 sm:hidden">
          {sortedJobs.map((job) => (
            <li key={job.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-slate-900">{job.service}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatThaiDate(job.date)} · {money(job.area)} ตารางวา · {job.customerName}{job.reviewed && <span className="ml-1 text-amber-600" title="ลูกค้ารีวิวแล้ว">★</span>}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-slate-900">฿{money(job.net)}</p>
                <p className="mt-0.5">{job.payoutReleased ? <span className="badge bg-emerald-100 text-emerald-800">✓ โอนแล้ว</span> : <span className="badge bg-amber-100 text-amber-800">🔒 Escrow</span>}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-3 font-medium">วันที่</th><th className="px-4 py-3 font-medium">บริการ</th><th className="px-4 py-3 font-medium">ลูกค้า</th><th className="px-4 py-3 text-right font-medium">คุณได้รับ</th><th className="px-4 py-3 font-medium">สถานะเงิน</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedJobs.map((job) => (
                <tr key={job.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatThaiDate(job.date)}</td>
                  <td className="px-4 py-3"><p className="text-slate-900">{job.service}</p><p className="text-xs text-slate-500">{money(job.area)} ตารางวา</p></td>
                  <td className="px-4 py-3 text-slate-700">{job.customerName}{job.reviewed && <span className="ml-1 text-xs text-amber-600" title="ลูกค้ารีวิวแล้ว">★</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-slate-900">฿{money(job.net)}</td>
                  <td className="px-4 py-3">{job.payoutReleased ? <span className="badge bg-emerald-100 text-emerald-800">✓ โอนแล้ว</span> : <span className="badge bg-amber-100 text-amber-800">🔒 Escrow</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!sortedJobs.length && <p className="p-6 text-center text-sm text-slate-600">ไม่มีงานในช่วงเวลานี้</p>}
      </section>
      <p className="mt-4 text-xs text-slate-500">นับจากงานที่คุณกด “ทำงานเสร็จแล้ว” ในระบบ</p>
    </div>
  );
}
