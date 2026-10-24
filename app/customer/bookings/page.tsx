'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAddress } from '../../_components/address';
import { formatThaiDate, isoDateFromToday } from '../../_components/date-input';
import { thaiBanks } from '../../_components/form-ui';
import { AdjustmentDecision } from '../../_components/inspection';
import { PhotoGallery } from '../../_components/photo-gallery';
import { ReviewForm, ReviewSummary } from '../../_components/review';
import type { ReviewInput } from '../../_lib/review';
import type { Job } from '../../_lib/types';
import { heightText } from '../../_components/pricing';
import { useCustomer, useData, useRun } from '../../_components/role-shell';
import { WorkerCard } from '../../_components/worker-card';
import { cancelBooking, decideAdjustment, payAdjustmentDifference, simulateAdjustmentExpiry, submitReview } from '../../_server/actions';
import { canCustomerCancel, customerCancelDaysBefore, customerCancelDeadline, customerStepIndex, customerSteps, jobWhen, money, workStageLabels } from '../../_lib/rules';

function BookingCard({ job }: { job: Job }) {
  const db = useData();
  const customer = useCustomer();
  const run = useRun();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundBank, setRefundBank] = useState('');
  const [refundAccount, setRefundAccount] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

  const review = db.reviews.find((item) => item.jobId === job.id);
  const mechanic = job.mechanicId ? db.mechanics.find((item) => item.id === job.mechanicId) : undefined;
  const adjustments = db.adjustments.filter((item) => item.jobId === job.id && (item.customerDecision === 'pending' || item.settlement === 'awaiting_payment'));
  const step = customerStepIndex(job, Boolean(review));
  const stage = job.workStage ?? 'matched';

  async function confirmCancel() {
    const result = await run(cancelBooking(job.id, { bankName: refundBank, accountNumber: refundAccount }));
    if (!result.ok) {
      setCancelError(result.message);
      return;
    }
    setCancelOpen(false);
  }

  async function sendReview(input: ReviewInput) {
    const result = await run(submitReview(job.id, input));
    if (result.ok) setReviewOpen(false);
    return result.ok;
  }

  if (job.cancelledAt) {
    return (
      <article className="card p-4 opacity-80 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-semibold text-slate-900">{job.service}</p><p className="text-sm text-slate-500">{formatThaiDate(job.date)} · ฿{money(job.price)}</p></div>
          <span className="badge bg-slate-200 text-slate-700">ยกเลิกแล้ว</span>
        </div>
        {job.refundNote && <p className="mt-2 text-sm text-slate-600">{job.refundNote}</p>}
      </article>
    );
  }

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">📅 {jobWhen(job)}{[isoDateFromToday(0), isoDateFromToday(1)].includes(job.date) && ` · ${formatThaiDate(job.date)}`}</p>
          <p className="mt-1 font-semibold text-slate-900">{job.service} <span className="text-slate-600">{money(job.area)} ตารางวา · {heightText(job.service, job.grassHeight)}</span></p>
          <p className="mt-0.5 text-sm text-slate-600">{formatAddress(job.address)}</p>
        </div>
        <div className="shrink-0 text-right"><p className="text-lg font-bold text-brand-700">฿{money(job.price)}</p>{job.priceNote && <p className="text-xs text-slate-500">{job.priceNote}</p>}</div>
      </div>

      <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="สถานะงาน">
        {customerSteps.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} className="text-center">
            <div className={`h-1.5 rounded-full ${index <= step ? 'bg-brand-500' : 'bg-slate-200'}`} />
            <p className={`mt-1 text-[11px] leading-tight sm:text-xs ${index === step ? 'font-semibold text-brand-700' : 'text-slate-500'}`}>{label}</p>
          </li>
        ))}
      </ol>

      {mechanic && <div className="mt-4"><WorkerCard name={`${mechanic.firstName} ${mechanic.lastName}`} photo={mechanic.photoDataUrl} rating={mechanic.ratingAverage} reviewCount={mechanic.ratingCount} completedJobs={mechanic.completedJobsCount} status={workStageLabels[stage]} equipment={mechanic.equipment} /></div>}

      {adjustments.map((adjustment) => (
        <div key={adjustment.id} className="mt-4">
          <AdjustmentDecision
            job={job}
            adjustment={adjustment}
            onDecide={(accept) => { run(decideAdjustment(adjustment.id, accept)); }}
            onPayDifference={() => { run(payAdjustmentDifference(adjustment.id)); }}
            onSimulateExpiry={() => { run(simulateAdjustmentExpiry(adjustment.id)); }}
          />
        </div>
      ))}

      {stage === 'done' && job.mechanicId && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          {Boolean(job.completionPhotos?.length) && (
            <div className="mb-4 border-b border-amber-200 pb-4">
              <p className="mb-2 font-semibold text-slate-800">📸 รูปงานที่เสร็จแล้วจากช่าง ({job.completionPhotos!.length} รูป){!review && ' · ดูรูปก่อนรีวิวได้'}</p>
              <PhotoGallery photos={job.completionPhotos!} label="รูปงานที่เสร็จแล้ว" />
            </div>
          )}
          {review ? (
            <ReviewSummary review={review} title="รีวิวแล้ว" />
          ) : reviewOpen ? (
            <ReviewForm onSubmit={sendReview} onCancel={() => setReviewOpen(false)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-amber-900">ช่างทำงานเสร็จแล้ว ช่วยรีวิวให้หน่อย</span><button type="button" onClick={() => setReviewOpen(true)} className="rounded-lg bg-amber-500 px-3 py-2 font-semibold text-white hover:bg-amber-600">⭐ รีวิวช่าง</button></div>
          )}
        </div>
      )}

      {stage === 'matched' && (cancelOpen ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="font-semibold text-rose-900">ยกเลิกการจ้างงาน</p>
          <p className="mt-1 text-sm text-rose-800">คืนเงิน <span className="font-bold">฿{money(job.price)}</span> เข้าบัญชีที่ระบุ</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">ธนาคาร<select value={refundBank} onChange={(event) => { setRefundBank(event.target.value); setCancelError(''); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"><option value="">เลือกธนาคาร</option>{thaiBanks.map((bank) => <option key={bank}>{bank}</option>)}</select></label>
            <label className="block text-sm font-medium text-slate-700">เลขที่บัญชี<input value={refundAccount} onChange={(event) => { setRefundAccount(event.target.value); setCancelError(''); }} inputMode="numeric" placeholder="xxx-x-xxxxx-x" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" /></label>
            <label className="block text-sm font-medium text-slate-700">ชื่อบัญชี<input value={`${customer.firstName} ${customer.lastName}`} readOnly aria-readonly="true" className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700" /><span className="mt-0.5 block text-xs font-normal text-slate-500">ใช้ชื่อ-นามสกุลตามที่ลงทะเบียน</span></label>
          </div>
          {cancelError && <p role="alert" className="mt-2 text-sm text-rose-700">{cancelError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={confirmCancel} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">ยืนยันยกเลิกและขอเงินคืน</button>
            <button type="button" onClick={() => { setCancelOpen(false); setCancelError(''); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">ไม่ยกเลิก</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">{canCustomerCancel(job) ? `ยกเลิกได้ถึงวันที่ ${formatThaiDate(customerCancelDeadline(job))}` : `ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมาย ${customerCancelDaysBefore} วัน`}</span>
          <button type="button" onClick={() => { setCancelOpen(true); setCancelError(''); }} disabled={!canCustomerCancel(job)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent">ยกเลิกการจ้างงาน</button>
        </div>
      ))}
    </article>
  );
}

export default function CustomerBookingsPage() {
  const db = useData();
  const customer = useCustomer();
  const mine = db.jobs.filter((job) => job.customerId === customer.id);
  // เรียงตามวันนัดหมายจากน้อยไปมาก · วันเดียวกันเรียงตามเวลานัด แล้วตามเวลาที่จอง
  const byDate = (a: Job, b: Job) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || (a.bookedAt ?? '').localeCompare(b.bookedAt ?? '');
  const active = mine.filter((job) => !job.cancelledAt).sort(byDate);
  const cancelled = mine.filter((job) => job.cancelledAt).sort(byDate);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">การจองของฉัน</h1>
        <Link href="/customer" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ จองบริการ</Link>
      </div>
      {active.length ? (
        <div className="mt-4 grid max-w-3xl grid-cols-1 gap-4">{active.map((job) => <BookingCard key={job.id} job={job} />)}</div>
      ) : (
        <p className="card mt-4 p-6 text-center text-sm text-slate-600">ยังไม่มีการจอง · <Link href="/customer" className="font-semibold text-brand-700 underline">จองบริการดูแลสวน</Link></p>
      )}
      {cancelled.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-700">ยกเลิกแล้ว</h2>
          <div className="mt-3 grid max-w-3xl grid-cols-1 gap-3">{cancelled.map((job) => <BookingCard key={job.id} job={job} />)}</div>
        </section>
      )}
    </div>
  );
}
