'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnChart } from '../../_components/column-chart';
import { formatThaiDate, isoDateFromToday } from '../../_components/date-input';
import { bucketize, completedJobHistory, currentWorkerId, jobsInPeriod, periodOptions, summarize, type Period } from '../../_components/earnings';
import { PeriodFilter, StatTile } from '../../_components/stat-tile';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

const myHistory = completedJobHistory.filter((job) => job.workerId === currentWorkerId);

export default function WorkerEarningsReport() {
  const [period, setPeriod] = useState<Period>(30);
  const jobs = jobsInPeriod(myHistory, period);
  const summary = summarize(jobs);
  // ช่วงก่อนหน้าที่ยาวเท่ากัน (ข้อมูลตัวอย่างย้อนหลัง 90 วัน จึงเทียบได้เฉพาะ 7 และ 30 วัน)
  const previous = summarize(myHistory.filter((job) => job.date >= isoDateFromToday(-(period * 2 - 1)) && job.date < isoDateFromToday(-(period - 1))));
  const change = period < 90 && previous.net > 0 ? Math.round(((summary.net - previous.net) / previous.net) * 100) : null;
  const sortedJobs = [...jobs].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">← กลับหน้าหลัก</Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">LawnFlow · ช่างตัดหญ้า</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">รายงานรายรับของฉัน</h1>
          <p className="mt-1 text-sm text-slate-600">รายรับสุทธิที่คุณได้รับ · นับจากวันที่ทำงานเสร็จ</p>
        </div>
        <PeriodFilter value={period} options={periodOptions} onChange={setPeriod} />
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุปรายรับ">
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
        <div className="overflow-x-auto">
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
          {!sortedJobs.length && <p className="p-6 text-center text-sm text-slate-600">ไม่มีงานในช่วงเวลานี้</p>}
        </div>
      </section>
      <p className="mt-4 text-xs text-slate-500">ข้อมูลตัวอย่างสำหรับสาธิต · งานที่ทำเสร็จในหน้าหลักยังไม่ถูกบันทึกลงรายงานนี้</p>
    </main>
  );
}
