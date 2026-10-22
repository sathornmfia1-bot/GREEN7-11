'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAddress, mapQuery } from '../../_components/address';
import { formatThaiDate } from '../../_components/date-input';
import { InspectionPanel } from '../../_components/inspection';
import { CallButton } from '../../_components/call-button';
import { PhotoGallery } from '../../_components/photo-gallery';
import { ReviewSummary } from '../../_components/review';
import { CompletionPhotoForm } from '../_components/completion-photos';
import type { Job } from '../../_lib/types';
import { heightText, netPayout } from '../../_components/pricing';
import { useData, useMechanic, useRun } from '../../_components/role-shell';
import { advanceWorkStage, cancelJobByMechanic, releasePayout, requestAdjustment, saveInspection, simulateEscrowWait } from '../../_server/actions';
import {
  canMechanicCancel, canReleasePayout, escrowReleaseDays, formatLocalDateTime, jobWhen, mechanicCancelDaysBefore,
  mechanicCancelDeadline, money, payoutAvailableAt, workStageActions, workStageLabels,
} from '../../_lib/rules';

function MyJobCard({ job }: { job: Job }) {
  const db = useData();
  const mechanic = useMechanic();
  const run = useRun();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const stage = job.workStage ?? 'matched';
  const action = stage === 'done' ? null : workStageActions[stage];
  const adjustments = db.adjustments.filter((item) => item.jobId === job.id);
  const blocked = adjustments.some((item) => item.customerDecision === 'pending' || item.settlement === 'awaiting_payment');
  const review = db.reviews.find((item) => item.jobId === job.id);

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">📅 {jobWhen(job)} · {job.title}</p>
          <p className="mt-1 font-semibold text-slate-900">{job.service} <span className="text-slate-600">{money(job.area)} ตารางวา · {heightText(job.service, job.grassHeight)}</span></p>
          <span className="mt-1 inline-block badge bg-brand-100 text-brand-700">{workStageLabels[stage]}</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500">ลูกค้าจ่าย <span className="font-semibold text-slate-700">฿{money(job.price)}</span></p>
          <p className="text-xs text-slate-500">คุณได้รับ <span className="text-lg font-bold text-brand-700">฿{money(netPayout(job.price))}</span></p>
          {job.priceNote && <p className="text-xs text-slate-500">{job.priceNote}</p>}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-slate-700">
        <p>👤 {job.firstName} {job.lastName}</p>
        <p>📍 {formatAddress(job.address)}</p>
        <CallButton phone={job.phone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {stage === 'matched' && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(job.address))}&travelmode=driving`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-brand-600 bg-white px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">🧭 นำทางจากตำแหน่งปัจจุบัน</a>}
        {action && !finishing && <button type="button" onClick={async () => {
          // ทำงานเสร็จ → เปิดฟอร์มแนบรูปงานก่อน (ต้องมีอย่างน้อย 5 รูป)
          if (stage === 'working') { setFinishing(true); return; }
          setAdvancing(true);
          try { await run(advanceWorkStage(job.id)); } finally { setAdvancing(false); }
        }} disabled={blocked || advancing} aria-busy={advancing} className="rounded-full bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">{advancing ? 'กำลังบันทึก...' : action.label}</button>}
        {action && blocked && <span className="text-xs text-amber-700">รอลูกค้าตอบคำขอปรับราคา/ชำระส่วนต่างก่อน</span>}
        {finishing && stage === 'working' && (
          <CompletionPhotoForm
            onCancel={() => setFinishing(false)}
            onSubmit={async (photos) => {
              const result = await run(advanceWorkStage(job.id, photos));
              if (result.ok) setFinishing(false);
              return result.ok;
            }}
          />
        )}
        {stage === 'done' && (review ? <div className="w-full rounded-lg bg-amber-50 p-2"><ReviewSummary review={review} title="ลูกค้ารีวิว" /></div> : <span className="text-xs text-slate-600">แจ้งลูกค้าแล้ว · รอลูกค้ารีวิว</span>)}
      </div>

      {stage === 'done' && Boolean(job.completionPhotos?.length) && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">📸 รูปงานที่เสร็จแล้ว ({job.completionPhotos!.length} รูป)</p>
          <PhotoGallery photos={job.completionPhotos!} label="รูปงานที่เสร็จแล้ว" />
        </div>
      )}

      {stage === 'done' && (() => {
        const releasable = canReleasePayout(job, Boolean(review));
        return (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${job.payoutReleasedAt ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-700">🔒 Escrow · เงินของคุณ <span className="font-bold text-brand-700">฿{money(netPayout(job.price))}</span></span>
              {job.payoutReleasedAt
                ? <span className="badge bg-emerald-100 text-emerald-800">✓ โอนแล้ว</span>
                : <button type="button" onClick={() => run(releasePayout(job.id))} disabled={!releasable} className="rounded-full bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">💸 โอนเงินเข้าบัญชี</button>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {job.payoutReleasedAt
                ? `โอนเข้า ${mechanic.bankName} xxx-${mechanic.accountLast4} เมื่อ ${formatLocalDateTime(job.payoutReleasedAt)}`
                : review ? 'ลูกค้ารีวิวแล้ว · กดโอนเงินได้ทันที'
                  : releasable ? `ครบ ${escrowReleaseDays} วันหลังทำงานเสร็จ · กดโอนเงินได้แล้ว`
                    : `โอนได้เมื่อลูกค้ารีวิว หรือหลัง ${formatLocalDateTime(payoutAvailableAt(job))} (${escrowReleaseDays} วันหลังทำงานเสร็จ)`}
            </p>
            {!job.payoutReleasedAt && !releasable && <button type="button" onClick={() => { run(simulateEscrowWait(job.id)); }} className="mt-1 text-xs text-slate-400 underline hover:text-slate-600">(ทดสอบ) จำลองเวลาผ่านไป {escrowReleaseDays} วัน</button>}
          </div>
        );
      })()}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => setInspectionOpen(!inspectionOpen)} aria-expanded={inspectionOpen} className="text-sm font-semibold text-brand-700 hover:underline">{inspectionOpen ? '▾ ซ่อนการตรวจงาน' : '▸ ตรวจงานและปรับราคา'}</button>
        {inspectionOpen && (
          <div className="mt-3">
            <InspectionPanel
              job={job}
              adjustments={adjustments}
              inspection={db.inspections.find((item) => item.jobId === job.id)}
              onAnalyze={async (beforeUrl, afterUrl) => { await run(saveInspection(job.id, beforeUrl, afterUrl)); }}
              onRequestAdjustment={(request) => { run(requestAdjustment(job.id, request)); }}
            />
          </div>
        )}
      </div>

      {stage === 'matched' && (confirmCancel ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 p-3 text-sm">
          <span className="text-rose-800">ยืนยันยกเลิกงานนี้? งานจะกลับไปที่ Job Pool ให้ช่างคนอื่นรับ</span>
          <span className="flex gap-2"><button type="button" onClick={() => { setConfirmCancel(false); run(cancelJobByMechanic(job.id)); }} className="rounded-md bg-rose-700 px-3 py-1.5 font-semibold text-white hover:bg-rose-800">ยืนยันยกเลิก</button><button type="button" onClick={() => setConfirmCancel(false)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700">ไม่ยกเลิก</button></span>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-sm">
          <span className="text-xs text-slate-500">{canMechanicCancel(job) ? `ยกเลิกได้ถึงวันที่ ${formatThaiDate(mechanicCancelDeadline(job))}` : `ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมาย ${mechanicCancelDaysBefore} วัน`}</span>
          <button type="button" onClick={() => setConfirmCancel(true)} disabled={!canMechanicCancel(job)} className="rounded-md border border-rose-200 bg-white px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white">ยกเลิก</button>
        </div>
      ))}
    </article>
  );
}

export default function MechanicJobsPage() {
  const db = useData();
  const mechanic = useMechanic();
  // งานที่ช่างคนนี้รับไว้เท่านั้น เรียงตามวันนัดหมาย (เร็วสุดก่อน)
  const mine = db.jobs
    .filter((job) => job.mechanicId === mechanic.id && !job.cancelledAt)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  const cancelledByCustomer = db.jobs.filter((job) => job.mechanicId === mechanic.id && job.cancelledAt);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">งานของฉัน</h1>
        <span className="badge bg-brand-100 text-brand-700">{mine.length} งาน</span>
      </div>
      {mine.length ? (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{mine.map((job) => <MyJobCard key={job.id} job={job} />)}</div>
      ) : (
        <p className="card mt-4 p-6 text-center text-sm text-slate-600">ยังไม่มีงาน · <Link href="/mechanic" className="font-semibold text-brand-700 underline">ไปรับงานจาก Job Pool</Link></p>
      )}
      {cancelledByCustomer.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-700">ลูกค้ายกเลิกแล้ว</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {cancelledByCustomer.map((job) => <li key={job.id} className="rounded-lg bg-slate-100 p-3 text-slate-600">{job.service} · {formatThaiDate(job.date)} · {job.firstName} {job.lastName}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
