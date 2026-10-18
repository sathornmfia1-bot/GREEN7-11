'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatAddress } from '../../_components/address';
import { loadCustomerProfile, type CustomerProfile } from '../../_components/customer-profile';
import { formatRelativeThaiDate, formatThaiDate, isoDateFromToday } from '../../_components/date-input';
import { sampleJobs } from '../../_components/jobs';
import { grassHeightLabels, netPayout, platformFeePercent } from '../../_components/pricing';
import { ColumnChart } from '../../_components/column-chart';
import { bucketize, completedJobHistory, groupBy, jobsInPeriod, periodOptions, summarize, type Period } from '../../_components/earnings';
import { PeriodFilter, StatTile } from '../../_components/stat-tile';
import { checkSupabase, type HealthReport } from '../../_lib/supabase-health';
import { loadWorkerProfile, updateWorkerProfileStatus, type WorkerProfile, type WorkerStatus } from '../../_components/worker-profile';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

type Tab = 'overview' | 'revenue' | 'workers' | 'jobs' | 'customers';
type Application = { id: string; source: 'local' | 'sample'; profile: WorkerProfile };

// ใบสมัครตัวอย่าง (ตัวอย่างหน้าจอ) — ใบสมัครจริงจากหน้า /register-worker ในเบราว์เซอร์นี้จะแสดงรวมด้วย
const sampleApplications: Application[] = [
  {
    id: 'sample-1',
    source: 'sample',
    profile: {
      firstName: 'ประเสริฐ', lastName: 'ขยันดี', phone: '0891234567', bankName: 'ธนาคารกสิกรไทย', accountNumber: '1234567890', accountName: 'ประเสริฐ ขยันดี', serviceRadiusKm: 20,
      baseAddress: { addressLine: '55 ถนนติวานนท์', province: 'นนทบุรี', amphoe: 'ปากเกร็ด', district: 'บ้านใหม่', location: { lat: 13.9012, lng: 100.5143 } },
      idCardFileName: 'idcard-prasert.jpg', status: 'pending_verification', submittedAt: `${isoDateFromToday(-1)}T09:15:00`,
    },
  },
  {
    id: 'sample-2',
    source: 'sample',
    profile: {
      firstName: 'วิไล', lastName: 'สวนสวย', phone: '0812223333', bankName: 'ธนาคารไทยพาณิชย์', accountNumber: '9876543210', accountName: 'วิไล สวนสวย', serviceRadiusKm: 10,
      baseAddress: { addressLine: '210 ซอยลาดพร้าว 71', province: 'กรุงเทพมหานคร', amphoe: 'วังทองหลาง', district: 'สะพานสอง' },
      idCardFileName: 'idcard-wilai.jpg', status: 'verified', submittedAt: `${isoDateFromToday(-6)}T14:40:00`, reviewedAt: `${isoDateFromToday(-5)}T10:00:00`,
    },
  },
];

const sampleCustomers: Pick<CustomerProfile, 'firstName' | 'lastName' | 'phone' | 'email' | 'addressLabel' | 'address' | 'createdAt'>[] = [
  { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', email: 'somchai@example.com', addressLabel: 'บ้าน', address: { addressLine: '1', province: 'กรุงเทพมหานคร', amphoe: 'คลองสาน', district: 'คลองต้นไทร' }, createdAt: `${isoDateFromToday(-20)}T08:00:00` },
  ...sampleJobs.map((job) => ({ firstName: job.firstName, lastName: job.lastName, phone: '-', email: '-', addressLabel: 'บ้าน', address: job.address, createdAt: `${isoDateFromToday(-10)}T08:00:00` })),
];

const workerStatusStyles: Record<WorkerStatus, { label: string; icon: string; className: string }> = {
  pending_verification: { label: 'รอตรวจสอบ', icon: '⏳', className: 'bg-amber-100 text-amber-800' },
  verified: { label: 'อนุมัติแล้ว', icon: '✓', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'ไม่อนุมัติ', icon: '✕', className: 'bg-rose-100 text-rose-800' },
};

function maskAccount(accountNumber: string) {
  return accountNumber.length > 4 ? `xxx-x-x${accountNumber.slice(-4, -1)}-${accountNumber.slice(-1)}` : accountNumber;
}

function formatDateTime(iso: string) {
  const [date, time] = iso.split('T');
  return `${formatThaiDate(date)}${time ? ` ${time.slice(0, 5)}` : ''}`;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [applications, setApplications] = useState<Application[]>(sampleApplications);
  const [customers, setCustomers] = useState(sampleCustomers);
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | 'all'>('pending_verification');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [dbHealth, setDbHealth] = useState<HealthReport | null>(null);

  function runDbCheck() {
    setDbHealth(null);
    checkSupabase().then(setDbHealth).catch((error: Error) => setDbHealth({ status: 'error', message: error.message }));
  }

  useEffect(runDbCheck, []);
  const [revenuePeriod, setRevenuePeriod] = useState<Period>(30);
  const revenueJobs = jobsInPeriod(completedJobHistory, revenuePeriod);
  const revenue = summarize(revenueJobs);
  const revenueByWorker = groupBy(revenueJobs, (job) => job.workerName).sort((a, b) => b.net - a.net);
  const revenueByService = groupBy(revenueJobs, (job) => job.service).sort((a, b) => b.platformFee - a.platformFee);

  useEffect(() => {
    const worker = loadWorkerProfile();
    if (worker) setApplications((current) => [{ id: 'local', source: 'local', profile: worker }, ...current.filter((item) => item.id !== 'local')]);
    const customer = loadCustomerProfile();
    if (customer) setCustomers((current) => [customer, ...current]);
  }, []);

  const pendingCount = applications.filter((item) => item.profile.status === 'pending_verification').length;
  const totalJobValue = sampleJobs.reduce((sum, job) => sum + job.price, 0);
  const platformRevenue = sampleJobs.reduce((sum, job) => sum + (job.price - netPayout(job.price)), 0);
  const visibleApplications = applications.filter((item) => statusFilter === 'all' || item.profile.status === statusFilter);
  const query = jobQuery.trim();
  const visibleJobs = [...sampleJobs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((job) => !query || [job.title, job.service, job.firstName, job.lastName, formatAddress(job.address)].some((text) => text.includes(query)));

  function review(application: Application, status: WorkerStatus, reason?: string) {
    const reviewedAt = new Date().toISOString();
    if (application.source === 'local') updateWorkerProfileStatus(status, reason);
    setApplications((current) => current.map((item) => item.id === application.id ? { ...item, profile: { ...item.profile, status, rejectReason: reason, reviewedAt } } : item));
    setRejectingId(null);
    setRejectReason('');
    setNotice(`${status === 'verified' ? 'อนุมัติ' : 'ไม่อนุมัติ'}ใบสมัครของ ${application.profile.firstName} ${application.profile.lastName} แล้ว`);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'ภาพรวม' },
    { id: 'revenue', label: 'รายงานรายรับ' },
    { id: 'workers', label: 'ตรวจสอบบัญชีช่าง', count: pendingCount },
    { id: 'jobs', label: 'คลังงาน', count: sampleJobs.length },
    { id: 'customers', label: 'ลูกค้า', count: customers.length },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">LawnFlow · Admin</p>
          <h1 className="text-xl font-bold text-slate-900">ระบบจัดการแอดมิน</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">← กลับหน้าหลัก</Link>
      </header>

      <nav className="mb-6 flex gap-2 overflow-x-auto" role="tablist" aria-label="เมนูแอดมิน">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${tab === item.id ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
            {item.label}
            {item.count !== undefined && <span className={`rounded-full px-2 py-0.5 text-xs ${tab === item.id ? 'bg-white/20 text-white' : item.id === 'workers' && item.count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{item.count}</span>}
          </button>
        ))}
      </nav>

      {notice && (
        <div role="status" className="mb-6 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="ml-4 font-bold">ปิด</button>
        </div>
      )}

      {tab === 'overview' && (
        <section aria-label="ภาพรวมระบบ">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="งานใน Job Pool" value={`${sampleJobs.length} งาน`} hint={`วันนี้ ${sampleJobs.filter((job) => job.date === isoDateFromToday(0)).length} งาน`} />
            <StatTile label="มูลค่างานรวม" value={`฿${money(totalJobValue)}`} hint="ราคาที่ลูกค้าจ่าย" />
            <StatTile label={`รายได้ Platform (${platformFeePercent}%)`} value={`฿${money(platformRevenue)}`} hint={`ช่างได้รับสุทธิ ฿${money(totalJobValue - platformRevenue)}`} />
            <StatTile label="ช่างรอตรวจสอบ" value={`${pendingCount} คน`} hint={`ช่างทั้งหมด ${applications.length} คน · ลูกค้า ${customers.length} คน`} />
          </div>
          <div className="card mt-6 p-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">ฐานข้อมูล Supabase</h2>
              <button type="button" onClick={runDbCheck} className="text-sm font-medium text-brand-700 hover:underline">↻ ตรวจอีกครั้ง</button>
            </div>
            {!dbHealth ? (
              <p className="mt-2 text-sm text-slate-500">กำลังตรวจการเชื่อมต่อ...</p>
            ) : dbHealth.status === 'not_configured' ? (
              <p className="mt-2 text-sm text-slate-600">⚪ ยังไม่ได้ตั้งค่า · คัดลอก <code className="rounded bg-slate-100 px-1">.env.local.example</code> เป็น <code className="rounded bg-slate-100 px-1">.env.local</code> แล้วใส่ URL และ anon key ของโปรเจกต์ จากนั้นรีสตาร์ท <code className="rounded bg-slate-100 px-1">npm run dev</code> · ระหว่างนี้หน้าเว็บใช้ข้อมูลตัวอย่าง</p>
            ) : dbHealth.status === 'error' ? (
              <p className="mt-2 text-sm text-rose-700">✕ เชื่อมต่อไม่สำเร็จ: {dbHealth.message}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-emerald-700">✓ เชื่อมต่อสำเร็จ</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {dbHealth.checks.map((check) => (
                    <li key={check.label} className="flex gap-2"><span aria-hidden="true" className={check.ok ? 'text-emerald-600' : 'text-amber-600'}>{check.ok ? '✓' : '⚠'}</span><span className="text-slate-700"><span className="font-medium">{check.label}</span> · {check.detail}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {pendingCount > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <span className="text-amber-800">⏳ มีใบสมัครช่างรอตรวจสอบ {pendingCount} รายการ · ช่างยังรับงานไม่ได้จนกว่าจะอนุมัติ</span>
              <button type="button" onClick={() => { setTab('workers'); setStatusFilter('pending_verification'); }} className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700">ไปตรวจสอบ</button>
            </div>
          )}
        </section>
      )}

      {tab === 'revenue' && (
        <section aria-label="รายงานรายรับ Platform">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">รายรับจากงานที่ทำเสร็จ · ค่า Platform {platformFeePercent}% ของราคาที่ลูกค้าจ่าย</p>
            <PeriodFilter value={revenuePeriod} options={periodOptions} onChange={setRevenuePeriod} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile emphasis label="รายได้ Platform" value={`฿${money(revenue.platformFee)}`} hint={`จาก ${revenue.count} งาน`} />
            <StatTile label="มูลค่างานรวม (GMV)" value={`฿${money(revenue.gross)}`} hint="ราคาที่ลูกค้าจ่ายทั้งหมด" />
            <StatTile label="จ่ายให้ช่างแล้ว" value={`฿${money(revenue.released)}`} hint="ช่างกดโอนออกจาก Escrow แล้ว" />
            <StatTile label="เงินพักใน Escrow" value={`฿${money(revenue.held)}`} hint="ส่วนของช่างที่ยังไม่โอน" />
          </div>
          <div className="mt-6">
            <ColumnChart title={revenuePeriod === 7 ? 'รายได้ Platform รายวัน' : 'รายได้ Platform รายสัปดาห์'} buckets={bucketize(revenueJobs, revenuePeriod, (job) => job.platformFee)} valueLabel="รายได้ Platform" />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <h2 className="border-b border-slate-200 p-4 font-semibold text-slate-900">รายรับแยกตามช่าง</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">ช่าง</th><th className="px-4 py-3 text-right font-medium">งาน</th><th className="px-4 py-3 text-right font-medium">ช่างได้รับ</th><th className="px-4 py-3 text-right font-medium">รอโอน</th><th className="px-4 py-3 text-right font-medium">ค่า Platform</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenueByWorker.map((row) => <tr key={row.key}><td className="px-4 py-3 text-slate-900">{row.key}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.count}</td><td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">฿{money(row.net)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">฿{money(row.held)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">฿{money(row.platformFee)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card overflow-hidden">
              <h2 className="border-b border-slate-200 p-4 font-semibold text-slate-900">รายรับแยกตามประเภทบริการ</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">บริการ</th><th className="px-4 py-3 text-right font-medium">งาน</th><th className="px-4 py-3 text-right font-medium">GMV</th><th className="px-4 py-3 text-right font-medium">ค่า Platform</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenueByService.map((row) => <tr key={row.key}><td className="px-4 py-3 text-slate-900">{row.key}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.count}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">฿{money(row.gross)}</td><td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">฿{money(row.platformFee)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">ข้อมูลตัวอย่างย้อนหลัง 90 วันสำหรับสาธิต</p>
        </section>
      )}

      {tab === 'workers' && (
        <section aria-label="ตรวจสอบบัญชีช่าง">
          <div className="mb-4 flex flex-wrap gap-2">
            {(['pending_verification', 'verified', 'rejected', 'all'] as const).map((status) => (
              <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${statusFilter === status ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                {status === 'all' ? 'ทั้งหมด' : workerStatusStyles[status].label} ({status === 'all' ? applications.length : applications.filter((item) => item.profile.status === status).length})
              </button>
            ))}
          </div>
          {visibleApplications.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleApplications.map((application) => {
                const { profile } = application;
                const style = workerStatusStyles[profile.status];
                return (
                  <article key={application.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{profile.firstName} {profile.lastName}</h2>
                        <p className="text-xs text-slate-500">สมัครเมื่อ {formatDateTime(profile.submittedAt)}{application.source === 'local' && ' · สมัครจากเบราว์เซอร์นี้'}</p>
                      </div>
                      <span className={`badge shrink-0 ${style.className}`}><span aria-hidden="true" className="mr-1">{style.icon}</span>{style.label}</span>
                    </div>
                    <dl className="mt-4 space-y-1.5 text-sm">
                      <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">เบอร์โทร</dt><dd className="text-slate-900">{profile.phone} <span className="text-emerald-700">✓ ยืนยัน OTP</span></dd></div>
                      <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">บัญชีรับเงิน</dt><dd className="text-slate-900">{profile.bankName} · {maskAccount(profile.accountNumber)} · {profile.accountName}</dd></div>
                      <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">ที่อยู่ฐาน</dt><dd className="text-slate-900">{formatAddress(profile.baseAddress)}{profile.baseAddress.location ? ' 📍' : ''}</dd></div>
                      <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">รัศมีให้บริการ</dt><dd className="text-slate-900">{profile.serviceRadiusKm} กม.</dd></div>
                      <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">บัตรประชาชน</dt><dd className="text-slate-900">🪪 {profile.idCardFileName}</dd></div>
                      {profile.status === 'rejected' && profile.rejectReason && <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">เหตุผล</dt><dd className="text-rose-700">{profile.rejectReason}</dd></div>}
                      {profile.reviewedAt && profile.status !== 'pending_verification' && <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">ตรวจสอบเมื่อ</dt><dd className="text-slate-900">{formatDateTime(profile.reviewedAt)}</dd></div>}
                    </dl>
                    {profile.status === 'pending_verification' && (rejectingId === application.id ? (
                      <div className="mt-4 rounded-lg bg-rose-50 p-3">
                        <label className="block text-sm font-medium text-rose-900">เหตุผลที่ไม่อนุมัติ (แจ้งช่าง)
                          <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={2} placeholder="เช่น รูปบัตรประชาชนไม่ชัด กรุณาส่งใหม่" className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-slate-900 focus:border-rose-400 focus:outline-none" />
                        </label>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => review(application, 'rejected', rejectReason.trim())} disabled={!rejectReason.trim()} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300">ยืนยันไม่อนุมัติ</button>
                          <button type="button" onClick={() => setRejectingId(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => review(application, 'verified')} className="flex-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">✓ อนุมัติ</button>
                        <button type="button" onClick={() => { setRejectingId(application.id); setRejectReason(''); }} className="flex-1 rounded-lg border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">✕ ไม่อนุมัติ</button>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="card p-6 text-center text-sm text-slate-600">ไม่มีใบสมัครในสถานะนี้</p>
          )}
        </section>
      )}

      {tab === 'jobs' && (
        <section aria-label="คลังงาน" className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-bold text-slate-900">คลังงาน</h2>
            <input value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} placeholder="ค้นหาชื่องาน ลูกค้า บริการ หรือที่อยู่" aria-label="ค้นหางาน" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:w-80" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-4 py-3 font-medium">วันนัดหมาย</th><th className="px-4 py-3 font-medium">งาน / บริการ</th><th className="px-4 py-3 font-medium">ลูกค้า</th><th className="px-4 py-3 text-right font-medium">ลูกค้าจ่าย</th><th className="px-4 py-3 text-right font-medium">ช่างได้รับ</th><th className="px-4 py-3 font-medium">สถานะ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleJobs.map((job) => (
                  <tr key={job.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatRelativeThaiDate(job.date)}{job.time && ` ${job.time}`}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-900">{job.title}</p><p className="text-xs text-slate-500">{job.service} · {money(job.area)} ตารางวา · หญ้า{grassHeightLabels[job.grassHeight]}</p></td>
                    <td className="px-4 py-3"><p className="text-slate-900">{job.firstName} {job.lastName}</p><p className="text-xs text-slate-500">{job.address.amphoe}, {job.address.province}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-900">฿{money(job.price)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">฿{money(netPayout(job.price))}</td>
                    <td className="px-4 py-3"><span className="badge bg-amber-100 text-amber-800">{job.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleJobs.length && <p className="p-6 text-center text-sm text-slate-600">ไม่พบงานที่ค้นหา</p>}
          </div>
        </section>
      )}

      {tab === 'customers' && (
        <section aria-label="ลูกค้า" className="card overflow-hidden">
          <h2 className="border-b border-slate-200 p-4 text-lg font-bold text-slate-900">ลูกค้า</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-4 py-3 font-medium">ชื่อ-นามสกุล</th><th className="px-4 py-3 font-medium">ติดต่อ</th><th className="px-4 py-3 font-medium">ที่อยู่หลัก</th><th className="px-4 py-3 font-medium">สมัครเมื่อ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer, index) => (
                  <tr key={`${customer.firstName}-${customer.lastName}-${index}`} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{customer.firstName} {customer.lastName}</td>
                    <td className="px-4 py-3 text-slate-700"><p>{customer.phone}</p><p className="text-xs text-slate-500">{customer.email}</p></td>
                    <td className="px-4 py-3 text-slate-700"><span className="font-medium">{customer.addressLabel}</span> · {formatAddress(customer.address)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(customer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
