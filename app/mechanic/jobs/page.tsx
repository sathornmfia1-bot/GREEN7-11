'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAddress, mapQuery } from '../../_components/address';
import { formatThaiDate, isoDateFromToday } from '../../_components/date-input';
import { InspectionPanel } from '../../_components/inspection';
import { CallButton, telHref } from '../../_components/call-button';
import { Accordion, SlideToConfirm, mobileCtaClass } from '../../_components/mobile';
import { PhotoGallery } from '../../_components/photo-gallery';
import { ReviewSummary } from '../../_components/review';
import { CompletionPhotoForm } from '../_components/completion-photos';
import type { Job } from '../../_lib/types';
import { heightText, netPayout } from '../../_components/pricing';
import { useData, useMechanic, useRun } from '../../_components/role-shell';
import { advanceWorkStage, cancelJobByMechanic, releasePayout, requestAdjustment, saveInspection, simulateEscrowWait } from '../../_server/actions';
import {
  adjustmentBlockReason, canMechanicCancel, canReleasePayout, escrowReleaseDays, formatLocalDateTime, jobWhen, mechanicCancelDaysBefore,
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
      <div className="border-b border-slate-100 pb-3">
        <p className="text-xs text-slate-500">📅 {jobWhen(job)} · {job.title}</p>
        {/* บรรทัดที่สอง: บริการ (ซ้าย) และรายรับช่าง (ขวา) อยู่แถวเดียวกัน */}
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="min-w-0 font-semibold text-slate-900">{job.service} <span className="text-slate-600">{money(job.area)} ตารางวา · {heightText(job.service, job.grassHeight)}</span></p>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold leading-snug text-brand-700">฿{money(netPayout(job.price))}</p>
            {job.priceNote && <p className="text-xs text-slate-500">{job.priceNote}</p>}
          </div>
        </div>
        <span className="mt-1 inline-block badge bg-brand-100 text-brand-700">{workStageLabels[stage]}</span>
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

// ---------------------------------------------------------------------------
// มือถือ: การ์ดงานแบบกระชับ · ปุ่มนำทาง/โทร 48 dp · เลื่อนเพื่อยืนยันแต่ละขั้น · รายละเอียดยุบไว้
// ---------------------------------------------------------------------------

const slideLabels = { matched: 'แจ้งว่าถึงแล้ว', arrived: 'เริ่มทำงาน', working: 'ทำงานเสร็จ' } as const;

function MobileJobCard({ job }: { job: Job }) {
  const db = useData();
  const mechanic = useMechanic();
  const run = useRun();
  const [advancing, setAdvancing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const stage = job.workStage ?? 'matched';
  // "ขอปรับราคา" → เปิดหัวข้อตรวจงาน/ปรับราคา แล้วเลื่อนไปที่หัวข้อนั้น
  const openInspection = () => {
    const section = document.getElementById(`inspect-${job.id}`) as HTMLDetailsElement | null;
    if (!section) return;
    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const adjustments = db.adjustments.filter((item) => item.jobId === job.id);
  const blocked = adjustments.some((item) => item.customerDecision === 'pending' || item.settlement === 'awaiting_payment');
  const review = db.reviews.find((item) => item.jobId === job.id);
  const canAdjust = !adjustmentBlockReason(stage, Boolean(job.isMonthly), adjustments.length);
  const releasable = stage === 'done' && canReleasePayout(job, Boolean(review));
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(job.address))}&travelmode=driving`;

  async function advance() {
    // ทำงานเสร็จ → เปิดหน้าส่งงาน (ต้องแนบรูปอย่างน้อย 5 รูป)
    if (stage === 'working') { setFinishing(true); return; }
    setAdvancing(true);
    try { await run(advanceWorkStage(job.id)); } finally { setAdvancing(false); }
  }

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{jobWhen(job)}</p>
          <p className="mt-0.5 font-semibold leading-snug text-slate-900">{job.service}</p>
          <p className="text-sm text-slate-600">{money(job.area)} ตร.ว. · {heightText(job.service, job.grassHeight)}</p>
        </div>
        <p className="shrink-0 font-display text-2xl font-bold text-brand-700">฿{money(netPayout(job.price))}</p>
      </div>
      <span className="mt-2 inline-block badge bg-brand-100 text-brand-800">{workStageLabels[stage]}</span>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{job.firstName} {job.lastName}</p>
          <p className="truncate text-sm text-slate-600">{job.address.province === 'กรุงเทพมหานคร' ? 'เขต' : 'อ.'}{job.address.amphoe}</p>
        </div>
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" aria-label="นำทาง" className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-700 text-brand-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8z" /></svg>
        </a>
        {job.phone && (
          <a href={telHref(job.phone)} aria-label="โทรหาลูกค้า" className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
          </a>
        )}
      </div>

      {stage === 'done' && review && <div className="mt-3 rounded-lg bg-amber-50 p-3"><ReviewSummary review={review} title="ลูกค้ารีวิว" /></div>}
      {stage === 'done' && Boolean(job.completionPhotos?.length) && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">รูปงานที่ส่ง · {job.completionPhotos!.length} รูป</p>
          <PhotoGallery photos={job.completionPhotos!} label="รูปงานที่เสร็จแล้ว" />
        </div>
      )}

      <div className="-mx-4 mt-3 border-t border-slate-100">
        <Accordion title="ที่อยู่เต็ม · เบอร์โทร">
          <p className="text-sm text-slate-700">{formatAddress(job.address)}</p>
          <div className="mt-3 text-sm"><CallButton phone={job.phone} /></div>
          {Boolean(job.photos?.length) && <div className="mt-3"><p className="mb-2 text-sm font-semibold text-slate-700">รูปสนามจากลูกค้า</p><PhotoGallery photos={job.photos!} label="รูปสนามหญ้า" /></div>}
        </Accordion>
        <Accordion id={`inspect-${job.id}`} title="ตรวจงานด้วย AI · ปรับราคา">
          <InspectionPanel
            job={job}
            adjustments={adjustments}
            inspection={db.inspections.find((item) => item.jobId === job.id)}
            onAnalyze={async (beforeUrl, afterUrl) => { await run(saveInspection(job.id, beforeUrl, afterUrl)); }}
            onRequestAdjustment={(request) => { run(requestAdjustment(job.id, request)); }}
          />
        </Accordion>
        {stage === 'done' && (
          <Accordion title={job.payoutReleasedAt ? 'เงินของคุณ · โอนแล้ว' : 'เงินของคุณ · Escrow'}>
            <p className="text-sm text-slate-600">
              {job.payoutReleasedAt
                ? `โอนเข้า ${mechanic.bankName} xxx-${mechanic.accountLast4} เมื่อ ${formatLocalDateTime(job.payoutReleasedAt)}`
                : review ? 'ลูกค้ารีวิวแล้ว · โอนเงินได้ทันที'
                  : releasable ? `ครบ ${escrowReleaseDays} วันหลังทำงานเสร็จ · โอนเงินได้แล้ว`
                    : `โอนได้เมื่อลูกค้ารีวิว หรือหลัง ${formatLocalDateTime(payoutAvailableAt(job))}`}
            </p>
            {!job.payoutReleasedAt && !releasable && <button type="button" onClick={() => { run(simulateEscrowWait(job.id)); }} className="mt-2 min-h-[44px] text-xs text-slate-500 underline">(ทดสอบ) จำลองเวลาผ่านไป {escrowReleaseDays} วัน</button>}
          </Accordion>
        )}
        {stage === 'matched' && (
          <Accordion title="ยกเลิกงาน">
            <p className="text-sm text-slate-600">{canMechanicCancel(job) ? `ยกเลิกได้ถึงวันที่ ${formatThaiDate(mechanicCancelDeadline(job))} · งานจะกลับไปที่ Job Pool` : `ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมาย ${mechanicCancelDaysBefore} วัน`}</p>
            {canMechanicCancel(job) && (confirmCancel
              ? <div className="mt-3 flex gap-2"><button type="button" onClick={() => { setConfirmCancel(false); run(cancelJobByMechanic(job.id)); }} className="h-12 flex-1 rounded-xl bg-rose-700 font-semibold text-white">ยืนยันยกเลิก</button><button type="button" onClick={() => setConfirmCancel(false)} className="h-12 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700">ไม่ยกเลิก</button></div>
              : <button type="button" onClick={() => setConfirmCancel(true)} className="mt-3 h-12 w-full rounded-xl border-2 border-rose-200 font-semibold text-rose-700">ยกเลิกงานนี้</button>)}
          </Accordion>
        )}
      </div>

      {/* ปุ่มหลักของขั้นงาน อยู่ล่างสุดของการ์ด ใกล้นิ้วโป้ง */}
      {stage !== 'done' && (
        <div className="mt-3 space-y-2">
          {canAdjust && <button type="button" onClick={openInspection} className="mx-auto block min-h-[44px] px-3 font-semibold text-brand-700 underline underline-offset-4">ขอปรับราคา (ได้ 1 ครั้ง)</button>}
          {blocked && <p className="text-center text-sm text-amber-700">รอลูกค้าตอบคำขอปรับราคา / ชำระส่วนต่างก่อน</p>}
          <SlideToConfirm label={slideLabels[stage]} onConfirm={advance} disabled={blocked} busy={advancing} />
        </div>
      )}
      {stage === 'done' && !job.payoutReleasedAt && (
        <button type="button" onClick={() => run(releasePayout(job.id))} disabled={!releasable} className={`${mobileCtaClass} mt-3 bg-brand-700 hover:bg-brand-800`}>💸 โอนเงิน ฿{money(netPayout(job.price))} เข้าบัญชี</button>
      )}

      {finishing && stage === 'working' && (
        <CompletionPhotoForm
          variant="screen"
          onCancel={() => setFinishing(false)}
          onSubmit={async (photos) => {
            const result = await run(advanceWorkStage(job.id, photos));
            if (result.ok) setFinishing(false);
            return result.ok;
          }}
        />
      )}
    </article>
  );
}

type JobTab = 'today' | 'upcoming' | 'done';

function MobileJobs({ jobs }: { jobs: Job[] }) {
  const [tab, setTab] = useState<JobTab>('today');
  const today = isoDateFromToday(0);
  const lists: Record<JobTab, Job[]> = {
    today: jobs.filter((job) => job.workStage !== 'done' && job.date <= today),
    upcoming: jobs.filter((job) => job.workStage !== 'done' && job.date > today),
    done: jobs.filter((job) => job.workStage === 'done'),
  };
  const tabs: { id: JobTab; label: string }[] = [{ id: 'today', label: 'วันนี้' }, { id: 'upcoming', label: 'ถัดไป' }, { id: 'done', label: 'เสร็จแล้ว' }];
  const list = lists[tab];
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-slate-900">งานของฉัน</h1>
      <div role="tablist" aria-label="ช่วงเวลางาน" className="-mx-4 mt-2 flex border-b border-slate-200 px-2">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`h-12 flex-1 border-b-[3px] px-1 text-[15px] ${tab === item.id ? 'border-brand-700 font-semibold text-brand-800' : 'border-transparent text-slate-500'}`}>
            {item.label} ({lists[item.id].length})
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="mt-4 space-y-4">{list.map((job) => <MobileJobCard key={job.id} job={job} />)}</div>
      ) : (
        <p className="card mt-4 p-6 text-center text-sm text-slate-600">{tab === 'done' ? 'ยังไม่มีงานที่เสร็จ' : 'ไม่มีงานในช่วงนี้'} · <Link href="/mechanic" className="font-semibold text-brand-700 underline">ดูงานใหม่</Link></p>
      )}
    </div>
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
    <>
    <div className="sm:hidden">
      <MobileJobs jobs={mine} />
    </div>
    <div className="max-sm:hidden">
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
    </>
  );
}
