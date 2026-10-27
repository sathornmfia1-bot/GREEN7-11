'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAddress } from '../../_components/address';
import { DateInput, formatThaiDate, isoDateFromToday } from '../../_components/date-input';
import { thaiBanks } from '../../_components/form-ui';
import { AdjustmentDecision } from '../../_components/inspection';
import { Accordion, BottomSheet, MobileStickyBar, mobileCtaClass } from '../../_components/mobile';
import { PhotoGallery } from '../../_components/photo-gallery';
import { ReviewForm, ReviewSummary } from '../../_components/review';
import type { ReviewInput } from '../../_lib/review';
import type { Job } from '../../_lib/types';
import { heightText } from '../../_components/pricing';
import { useCustomer, useData, useRun } from '../../_components/role-shell';
import { WorkerCard } from '../../_components/worker-card';
import { cancelBooking, decideAdjustment, payAdjustmentDifference, rescheduleVisit, simulateAdjustmentExpiry, submitReview } from '../../_server/actions';
import { addDays, daysBetween, minVisitGapDays, rescheduleLeadDays, rescheduleProblem } from '../../_lib/visits';
import { canCustomerCancel, customerCancelDaysBefore, customerCancelDeadline, customerStepIndex, customerSteps, jobWhen, money, workStageLabels } from '../../_lib/rules';

// แพ็กเกจรายเดือน: ตารางนัดทั้งหมดของการจองนี้ · เลื่อนนัดได้ก่อนวันนัด 1 วัน ภายในรอบเดือนเดียวกัน
function VisitSchedule({ job }: { job: Job }) {
  const db = useData();
  const run = useRun();
  const [editing, setEditing] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState('');
  const visits = (db.visits ?? []).filter((visit) => visit.bookingId === job.bookingId && visit.status !== 'cancelled').sort((a, b) => a.visitNo - b.visitNo);
  if (!visits.length) return null;
  const today = isoDateFromToday(0);

  async function save(visitId: string) {
    const result = await run(rescheduleVisit(visitId, newDate));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(null);
  }

  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50 text-sm" open={visits.length <= 4}>
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center justify-between gap-x-2 px-4 py-2 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        <span>📅 ตารางนัด {visits.length} นัด <span aria-hidden="true" className="inline-block text-slate-400 transition-transform group-open:rotate-180">▾</span></span>
        <span className="text-xs font-normal text-slate-500">เลื่อนได้ก่อนวันนัด 1 วัน · ห่างกันอย่างน้อย {minVisitGapDays} วัน</span>
      </summary>
      <ol className="divide-y divide-slate-200 border-t border-slate-200">
        {visits.map((visit) => {
          const visitJob = visit.jobId ? db.jobs.find((item) => item.id === visit.jobId) : undefined;
          const stage = visitJob?.workStage;
          const started = Boolean(visitJob?.mechanicId) && stage !== undefined && stage !== 'matched';
          const status = started ? (stage === 'done' ? 'เสร็จแล้ว' : 'กำลังทำงาน') : visitJob?.mechanicId ? 'มีช่างรับแล้ว' : visitJob ? 'รอช่างรับงาน' : 'รอถึงกำหนด';
          const canMove = !started && daysBetween(today, visit.date) >= rescheduleLeadDays;
          const others = visits.filter((item) => item.id !== visit.id).map((item) => item.date);
          const earliest = addDays(today, rescheduleLeadDays) > visit.cycleStart ? addDays(today, rescheduleLeadDays) : visit.cycleStart;
          const isEditing = editing === visit.id;
          return (
            <li key={visit.id} className={`px-4 py-2.5 ${visit.jobId === job.id ? 'bg-brand-50' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-14 shrink-0 text-slate-500">นัดที่ {visit.visitNo}</span>
                <span className="font-semibold text-slate-900">{formatThaiDate(visit.date)}</span>
                <span className="text-xs text-slate-500">{status}</span>
                {canMove && !isEditing && <button type="button" onClick={() => { setEditing(visit.id); setNewDate(visit.date); setError(''); }} className="ml-auto min-h-[36px] rounded-full border border-brand-600 bg-white px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50">เลื่อนนัด</button>}
              </div>
              {isEditing && (
                <div className="mt-2 rounded-lg border border-brand-200 bg-white p-3">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor={`visit-${visit.id}`}>วันนัดใหม่ (ภายในรอบ {formatThaiDate(visit.cycleStart)} – {formatThaiDate(visit.cycleEnd)})</label>
                  <div className="mt-1"><DateInput id={`visit-${visit.id}`} value={newDate} onChange={(value) => { setNewDate(value); setError(rescheduleProblem(visit, value, others, today) ?? ''); }} min={earliest} max={visit.cycleEnd} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500" /></div>
                  {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => save(visit.id)} disabled={newDate === visit.date || Boolean(rescheduleProblem(visit, newDate, others, today))} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">บันทึกวันใหม่</button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">ไม่เลื่อน</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

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

      {job.isMonthly && <div className="mt-4"><VisitSchedule job={job} /></div>}

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

      {stage === 'matched' && !job.isMonthly && (cancelOpen ? (
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

// ---------------------------------------------------------------------------
// มือถือ: รายการแบบย่อ (แตะเพื่อดูรายละเอียด) + หน้ารายละเอียดที่มีปุ่มหลักด้านล่าง
// ---------------------------------------------------------------------------

type MobileTab = 'ongoing' | 'done' | 'cancelled';

function statusOf(job: Job, reviewed: boolean) {
  if (job.cancelledAt) return { text: 'ยกเลิกแล้ว', className: 'bg-slate-200 text-slate-700' };
  const step = customerStepIndex(job, reviewed);
  const className = step >= 4 ? 'bg-emerald-100 text-emerald-800' : step === 3 ? 'bg-amber-100 text-amber-800' : step === 0 ? 'bg-sky-100 text-sky-800' : 'bg-brand-100 text-brand-800';
  return { text: customerSteps[step], className };
}

function MobileBookingRow({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const db = useData();
  const reviewed = db.reviews.some((item) => item.jobId === job.id);
  const mechanic = job.mechanicId ? db.mechanics.find((item) => item.id === job.mechanicId) : undefined;
  const status = statusOf(job, reviewed);
  return (
    <li>
      <button type="button" onClick={onOpen} className="card flex w-full items-center gap-3 p-4 text-left active:bg-slate-50">
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500">{jobWhen(job)}{[isoDateFromToday(0), isoDateFromToday(1)].includes(job.date) && ` · ${formatThaiDate(job.date)}`}</span>
          <span className="mt-0.5 block truncate font-semibold text-slate-900">{job.service}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className={`badge ${status.className}`}>{status.text}</span>
            {mechanic && <span aria-label={`ช่าง ${mechanic.firstName}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{mechanic.firstName.charAt(0)}</span>}
          </span>
        </span>
        <span className="shrink-0 font-display text-lg font-semibold text-brand-700">฿{money(job.price)}</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </button>
    </li>
  );
}

function MobileBookingDetail({ job, onBack }: { job: Job; onBack: () => void }) {
  const db = useData();
  const customer = useCustomer();
  const run = useRun();
  const [sheet, setSheet] = useState<'review' | 'cancel' | null>(null);
  const [refundBank, setRefundBank] = useState('');
  const [refundAccount, setRefundAccount] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [busy, setBusy] = useState(false);

  const review = db.reviews.find((item) => item.jobId === job.id);
  const mechanic = job.mechanicId ? db.mechanics.find((item) => item.id === job.mechanicId) : undefined;
  const adjustments = db.adjustments.filter((item) => item.jobId === job.id && (item.customerDecision === 'pending' || item.settlement === 'awaiting_payment'));
  const step = customerStepIndex(job, Boolean(review));
  const stage = job.workStage ?? 'matched';
  const canReview = stage === 'done' && Boolean(job.mechanicId) && !review && !job.cancelledAt;
  const canCancel = stage === 'matched' && !job.cancelledAt && !job.isMonthly && canCustomerCancel(job);

  async function confirmCancel() {
    setBusy(true);
    const result = await run(cancelBooking(job.id, { bankName: refundBank, accountNumber: refundAccount }));
    setBusy(false);
    if (!result.ok) {
      setCancelError(result.message);
      return;
    }
    setSheet(null);
  }

  async function sendReview(input: ReviewInput) {
    const result = await run(submitReview(job.id, input));
    if (result.ok) setSheet(null);
    return result.ok;
  }

  return (
    <div className={canReview || canCancel ? 'pb-24' : ''}>
      <div className="-mx-4 -mt-6 mb-4 border-b border-slate-200 bg-white px-2 pb-4 pt-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onBack} aria-label="กลับไปรายการจอง" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold text-slate-900">{job.service}</h1>
            <p className="text-sm text-slate-600">{formatThaiDate(job.date)} · ฿{money(job.price)}</p>
          </div>
        </div>
        {job.cancelledAt ? (
          <p className="mx-2 mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">ยกเลิกแล้ว{job.refundNote && ` · ${job.refundNote}`}</p>
        ) : (
          <div className="mx-2 mt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-brand-800">{customerSteps[step]}</span>
              <span className="text-xs text-slate-500">{step + 1}/{customerSteps.length}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="สถานะงาน" aria-valuemin={1} aria-valuemax={customerSteps.length} aria-valuenow={step + 1}>
              <div className="h-full rounded-full bg-brand-700" style={{ width: `${((step + 1) / customerSteps.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {mechanic && <WorkerCard name={`${mechanic.firstName} ${mechanic.lastName}`} photo={mechanic.photoDataUrl} rating={mechanic.ratingAverage} reviewCount={mechanic.ratingCount} completedJobs={mechanic.completedJobsCount} status={workStageLabels[stage]} equipment={mechanic.equipment} />}

        {adjustments.map((adjustment) => (
          <AdjustmentDecision
            key={adjustment.id}
            job={job}
            adjustment={adjustment}
            onDecide={(accept) => { run(decideAdjustment(adjustment.id, accept)); }}
            onPayDifference={() => { run(payAdjustmentDifference(adjustment.id)); }}
            onSimulateExpiry={() => { run(simulateAdjustmentExpiry(adjustment.id)); }}
          />
        ))}

        {Boolean(job.completionPhotos?.length) && (
          <section aria-label="รูปงานที่เสร็จแล้ว">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold text-slate-900">รูปงานที่เสร็จแล้ว</h2>
              <span className="text-xs text-slate-500">{job.completionPhotos!.length} รูป · ปัดดู</span>
            </div>
            <PhotoGallery photos={job.completionPhotos!} label="รูปงานที่เสร็จแล้ว" />
          </section>
        )}

        {review && <div className="card p-4"><ReviewSummary review={review} title="รีวิวแล้ว" /></div>}

        {job.isMonthly && !job.cancelledAt && <VisitSchedule job={job} />}

        <div className="card overflow-hidden">
          <Accordion title="รายละเอียดงานและที่อยู่">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">บริการ</dt><dd className="text-slate-900">{job.service} · {money(job.area)} ตารางวา · {heightText(job.service, job.grassHeight)}</dd></div>
              <div><dt className="text-slate-500">วันนัดหมาย</dt><dd className="text-slate-900">{jobWhen(job)}</dd></div>
              <div><dt className="text-slate-500">ที่อยู่</dt><dd className="text-slate-900">{formatAddress(job.address)}</dd></div>
            </dl>
          </Accordion>
          <Accordion title="การชำระเงิน · Escrow">
            <p className="text-sm text-slate-600">ชำระแล้ว <span className="font-semibold text-slate-900">฿{money(job.price)}</span>{job.priceNote && ` (${job.priceNote})`} · เงินพักไว้ในระบบ และโอนให้ช่างเมื่อคุณรีวิว หรือครบ 2 วันหลังทำงานเสร็จ</p>
          </Accordion>
          {stage === 'matched' && !job.cancelledAt && !job.isMonthly && (
            <Accordion title="การยกเลิก">
              <p className="text-sm text-slate-600">{canCustomerCancel(job) ? `ยกเลิกได้ถึงวันที่ ${formatThaiDate(customerCancelDeadline(job))} · รับเงินคืนเต็มจำนวน` : `ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมาย ${customerCancelDaysBefore} วัน`}</p>
            </Accordion>
          )}
        </div>
      </div>

      {canReview && (
        <MobileStickyBar aboveNav>
          <button type="button" onClick={() => setSheet('review')} className={`${mobileCtaClass} bg-accent-700 hover:bg-accent-600`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" /></svg>
            รีวิวช่าง
          </button>
        </MobileStickyBar>
      )}
      {canCancel && (
        <MobileStickyBar aboveNav>
          <button type="button" onClick={() => { setSheet('cancel'); setCancelError(''); }} className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-rose-200 font-display text-lg font-semibold text-rose-700 active:bg-rose-50">ยกเลิกการจอง</button>
        </MobileStickyBar>
      )}

      <BottomSheet open={sheet === 'review'} onClose={() => setSheet(null)} title={mechanic ? `รีวิวช่าง${mechanic.firstName}` : 'รีวิวช่าง'}>
        <ReviewForm onSubmit={sendReview} onCancel={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet
        open={sheet === 'cancel'}
        onClose={() => setSheet(null)}
        title="ยกเลิกการจอง"
        footer={<button type="button" onClick={confirmCancel} disabled={busy} className={`${mobileCtaClass} bg-rose-700 hover:bg-rose-800`}>{busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกและขอเงินคืน'}</button>}
      >
        <p className="text-sm text-slate-600">คืนเงิน <span className="font-bold text-slate-900">฿{money(job.price)}</span> เข้าบัญชีของคุณ</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">ธนาคาร<select value={refundBank} onChange={(event) => { setRefundBank(event.target.value); setCancelError(''); }} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 focus:border-brand-500 focus:outline-none"><option value="">เลือกธนาคาร</option>{thaiBanks.map((bank) => <option key={bank}>{bank}</option>)}</select></label>
          <label className="block text-sm font-medium text-slate-700">เลขที่บัญชี<input value={refundAccount} onChange={(event) => { setRefundAccount(event.target.value); setCancelError(''); }} inputMode="numeric" placeholder="xxx-x-xxxxx-x" className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 focus:border-brand-500 focus:outline-none" /></label>
          <p className="text-xs text-slate-500">ชื่อบัญชี: {customer.firstName} {customer.lastName} (ตามที่ลงทะเบียน)</p>
        </div>
        {cancelError && <p role="alert" className="mt-3 text-sm text-rose-700">{cancelError}</p>}
      </BottomSheet>
    </div>
  );
}

function MobileBookings({ active, cancelled }: { active: Job[]; cancelled: Job[] }) {
  const db = useData();
  const [tab, setTab] = useState<MobileTab>('ongoing');
  const [openId, setOpenId] = useState<string | null>(null);
  const reviewed = (job: Job) => db.reviews.some((item) => item.jobId === job.id);
  const finished = (job: Job) => job.workStage === 'done' && reviewed(job);
  const lists: Record<MobileTab, Job[]> = {
    ongoing: active.filter((job) => !finished(job)),
    done: active.filter(finished),
    cancelled,
  };
  const opened = openId ? [...active, ...cancelled].find((job) => job.id === openId) : undefined;

  if (opened) return <MobileBookingDetail job={opened} onBack={() => setOpenId(null)} />;

  const tabs: { id: MobileTab; label: string }[] = [
    { id: 'ongoing', label: 'กำลังดำเนินการ' },
    { id: 'done', label: 'เสร็จแล้ว' },
    { id: 'cancelled', label: 'ยกเลิก' },
  ];
  const list = lists[tab];

  return (
    <div className="pb-20">
      <h1 className="font-display text-2xl font-semibold text-slate-900">การจองของฉัน</h1>
      <div role="tablist" aria-label="สถานะการจอง" className="-mx-4 mt-2 flex border-b border-slate-200 px-2">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`h-12 flex-1 border-b-[3px] px-1 text-sm ${tab === item.id ? 'border-brand-700 font-semibold text-brand-800' : 'border-transparent text-slate-500'}`}>
            {item.label}{lists[item.id].length > 0 && ` (${lists[item.id].length})`}
          </button>
        ))}
      </div>
      {list.length ? (
        <ul className="mt-4 space-y-3">{list.map((job) => <MobileBookingRow key={job.id} job={job} onOpen={() => setOpenId(job.id)} />)}</ul>
      ) : (
        <p className="card mt-4 p-6 text-center text-sm text-slate-600">{tab === 'ongoing' ? 'ยังไม่มีการจองที่กำลังดำเนินการ' : tab === 'done' ? 'ยังไม่มีงานที่เสร็จแล้ว' : 'ไม่มีการจองที่ยกเลิก'}</p>
      )}
      {/* ปุ่มลอยมุมขวาล่าง (เหนือแถบเมนู) */}
      <Link href="/customer" aria-label="จองบริการใหม่" className="fixed right-4 z-30 flex h-14 items-center gap-1 rounded-full bg-brand-700 px-5 font-display font-semibold text-white shadow-lift" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <span aria-hidden="true" className="text-2xl leading-none">+</span> จอง
      </Link>
    </div>
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
    <>
    <div className="sm:hidden">
      <MobileBookings active={active} cancelled={cancelled} />
    </div>
    <div className="max-sm:hidden">
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
    </>
  );
}
