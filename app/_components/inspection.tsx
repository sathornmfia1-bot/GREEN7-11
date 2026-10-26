'use client';

import { useState } from 'react';
import { resizeImage } from '../_lib/image';
import { adjustmentBlockReason } from '../_lib/rules';
import type { Inspection, Job, QuoteAdjustment } from '../_lib/types';
import { debrisRatePerHour, fixedHeightLabel, grassHeightLabels, netPayout, pricePerVisit, usesFixedHeight } from './pricing';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

type Photo = { url: string };

function PhotoInput({ label, photo, onChange }: { label: string; photo: Photo | null; onChange: (photo: Photo) => void }) {
  return (
    <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-700 hover:border-brand-500">
      {label}
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt={label} className="mt-2 h-32 w-full rounded-lg object-cover" />
      ) : (
        <span className="mt-2 flex h-32 items-center justify-center rounded-lg bg-white text-xs font-normal text-slate-400">แตะเพื่อถ่าย/เลือกรูป</span>
      )}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file?.type.startsWith('image/')) resizeImage(file, 800).then((url) => onChange({ url })).catch(() => undefined);
      }} />
    </label>
  );
}

const decisionLabels: Record<QuoteAdjustment['customerDecision'], { text: string; className: string }> = {
  pending: { text: 'รอลูกค้ายืนยัน', className: 'bg-amber-100 text-amber-700' },
  accepted: { text: 'ลูกค้ายอมรับ', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: 'ลูกค้าปฏิเสธ', className: 'bg-rose-100 text-rose-700' },
  expired: { text: 'หมดอายุ · ลูกค้าไม่ตอบใน 1 ชม.', className: 'bg-slate-200 text-slate-700' },
};

function minutesLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

export function AdjustmentHistory({ adjustments }: { adjustments: QuoteAdjustment[] }) {
  if (!adjustments.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {adjustments.map((adjustment) => (
        <li key={adjustment.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><span className="text-slate-400 line-through">฿{money(adjustment.oldAmount)}</span> → <span className="font-semibold text-slate-900">฿{money(adjustment.newAmount)}</span></span>
            <span className={`badge ${decisionLabels[adjustment.customerDecision].className}`}>{decisionLabels[adjustment.customerDecision].text}{adjustment.settlement === 'awaiting_payment' ? ' · รอชำระส่วนต่าง' : adjustment.settlement === 'paid_difference' ? ' · ชำระส่วนต่างแล้ว' : adjustment.settlement === 'refunded' ? ' · คืนเงินแล้ว' : ''}</span>
          </div>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{adjustment.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {adjustment.note && <p className="mt-1 text-xs text-slate-500">หมายเหตุ: {adjustment.note}</p>}
        </li>
      ))}
    </ul>
  );
}

// ฝั่งช่าง: อัปโหลดภาพก่อน-หลัง → ตรวจด้วย AI → ขอปรับราคา
export function InspectionPanel({
  job,
  adjustments,
  inspection,
  onAnalyze,
  onRequestAdjustment,
}: {
  job: Job;
  adjustments: QuoteAdjustment[];
  // ผลตรวจงานล่าสุดที่บันทึกในฐานข้อมูล
  inspection?: Inspection;
  onAnalyze: (beforeUrl: string, afterUrl: string) => Promise<void>;
  onRequestAdjustment: (request: { newAmount: number; newArea: number; newGrassHeight: number; newExtraCharges: number; reasons: string[]; note: string }) => void;
}) {
  const [before, setBefore] = useState<Photo | null>(inspection?.beforeUrl ? { url: inspection.beforeUrl } : null);
  const [after, setAfter] = useState<Photo | null>(inspection?.afterUrl ? { url: inspection.afterUrl } : null);
  const [analyzing, setAnalyzing] = useState(false);
  const [changedPhotos, setChangedPhotos] = useState(false);
  const aiResult = inspection && !changedPhotos ? { estimatedArea: inspection.estimatedArea, grassHeight: inspection.grassHeight, debrisHours: inspection.debrisHours, completeness: inspection.completeness } : null;
  const aiStatus = analyzing ? 'analyzing' : aiResult ? 'done' : 'idle';
  const [formOpen, setFormOpen] = useState(false);
  const [actualArea, setActualArea] = useState(String(job.area));
  const [actualHeight, setActualHeight] = useState(job.grassHeight);
  const [debrisHours, setDebrisHours] = useState(0);
  const [note, setNote] = useState('');


  const pending = adjustments.some((adjustment) => adjustment.customerDecision === 'pending' || adjustment.settlement === 'awaiting_payment');
  const blockReason = adjustmentBlockReason(job.workStage ?? 'matched', Boolean(job.isMonthly), adjustments.length);
  const decided = adjustments.find((adjustment) => adjustment.customerDecision !== 'pending');
  const decisionText = decided && ({ accepted: 'ลูกค้ายอมรับราคาใหม่แล้ว', rejected: 'ลูกค้าปฏิเสธ ใช้ราคาเดิม', expired: 'ลูกค้าไม่ตอบภายในเวลา ใช้ราคาเดิม', pending: '' } as const)[decided.customerDecision];
  const areaValue = Math.max(Math.round(Number(actualArea) || 0), 0);
  const servicePrice = pricePerVisit(job.service, areaValue, actualHeight);
  const debrisPrice = debrisHours * debrisRatePerHour;
  const previousExtra = job.extraCharges ?? 0;
  const newAmount = servicePrice + previousExtra + debrisPrice;
  const difference = newAmount - job.price;

  const reasons = [
    areaValue !== job.area && `พื้นที่จริง ${money(areaValue)} ตารางวา (แจ้งไว้ ${money(job.area)} ตารางวา)`,
    actualHeight !== job.grassHeight && `ความสูงหญ้าจริง ${grassHeightLabels[actualHeight]} (แจ้งไว้ ${grassHeightLabels[job.grassHeight]})`,
    debrisHours > 0 && `เคลียร์เศษวัสดุเพิ่ม ${debrisHours} ชม. × ฿${debrisRatePerHour} = ฿${money(debrisPrice)}`,
  ].filter((reason): reason is string => Boolean(reason));

  async function analyze() {
    if (!before || !after) return;
    setAnalyzing(true);
    await onAnalyze(before.url, after.url);
    setChangedPhotos(false);
    setAnalyzing(false);
  }

  function applyAiResult() {
    if (!aiResult) return;
    setActualArea(String(aiResult.estimatedArea));
    setActualHeight(usesFixedHeight(job.service) ? 0 : aiResult.grassHeight);
    setDebrisHours(aiResult.debrisHours);
    setFormOpen(true);
  }

  function submit() {
    if (!reasons.length || difference === 0) return;
    onRequestAdjustment({ newAmount, newArea: areaValue, newGrassHeight: actualHeight, newExtraCharges: previousExtra + debrisPrice, reasons, note: note.trim() });
    setFormOpen(false);
    setNote('');
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">1. ภาพก่อน-หลังตัดหญ้า</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <PhotoInput label="ภาพก่อนทำงาน" photo={before} onChange={(photo) => { setBefore(photo); setChangedPhotos(true); }} />
          <PhotoInput label="ภาพหลังทำงาน" photo={after} onChange={(photo) => { setAfter(photo); setChangedPhotos(true); }} />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">2. ตรวจงานด้วย AI</p>
        {aiStatus === 'done' && aiResult ? (
          <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-slate-700" role="status">
            <p className="font-semibold text-emerald-700">✓ ผลวิเคราะห์ (จำลอง)</p>
            <ul className="mt-1 space-y-0.5">
              <li>ความเรียบร้อยของงาน: <span className="font-semibold">{aiResult.completeness}%</span> {aiResult.completeness >= 90 ? '· ผ่านเกณฑ์' : '· ควรตรวจซ้ำ'}</li>
              <li>พื้นที่โดยประมาณ: <span className="font-semibold">{money(aiResult.estimatedArea)} ตารางวา</span> (แจ้งไว้ {money(job.area)})</li>
              <li>ความสูงหญ้าก่อนตัด: <span className="font-semibold">{grassHeightLabels[aiResult.grassHeight]}</span> (แจ้งไว้ {grassHeightLabels[job.grassHeight]})</li>
              <li>เศษวัสดุที่ต้องเคลียร์: <span className="font-semibold">{aiResult.debrisHours ? `ประมาณ ${aiResult.debrisHours} ชม.` : 'ไม่พบ'}</span></li>
            </ul>
            {!blockReason && <button type="button" onClick={applyAiResult} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">ใช้ค่าจาก AI ในคำขอปรับราคา →</button>}
          </div>
        ) : (
          <button type="button" onClick={analyze} disabled={!before || !after || aiStatus === 'analyzing'} className="mt-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50">
            {aiStatus === 'analyzing' ? 'กำลังวิเคราะห์ภาพ...' : !before || !after ? 'แนบภาพก่อน-หลังเพื่อตรวจ' : '🤖 ตรวจภาพด้วย AI'}
          </button>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">3. ปรับราคาหน้างาน</p>
        {pending ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">ส่งคำขอปรับราคาแล้ว รอลูกค้าดำเนินการ · ราคายังคงเป็น ฿{money(job.price)} จนกว่าลูกค้าจะยืนยัน</p>
        ) : blockReason ? (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{blockReason}{decisionText && ` (${decisionText})`}</p>
        ) : !formOpen ? (
          <button type="button" onClick={() => { setActualArea(String(job.area)); setActualHeight(job.grassHeight); setDebrisHours(0); setFormOpen(true); }} className="mt-2 rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">ขอปรับราคา (ได้ 1 ครั้ง)</button>
        ) : (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">พื้นที่จริง (ตารางวา)<input type="number" min="1" value={actualArea} onChange={(event) => setActualArea(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" /></label>
              <label className="block text-sm font-medium text-slate-700">ความสูงหญ้าจริง
                {/* แต่งกิ่งอย่างเดียว / ตัดสวนรกร้าง: ราคาไม่คิดตามความสูงหญ้า จึงเปลี่ยนไม่ได้ */}
                {usesFixedHeight(job.service)
                  ? <select value={0} disabled className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"><option value={0}>{fixedHeightLabel(job.service)}</option></select>
                  : <select value={actualHeight} onChange={(event) => setActualHeight(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none">{grassHeightLabels.map((label, index) => <option key={label} value={index}>{label}</option>)}</select>}
              </label>
              <label className="block text-sm font-medium text-slate-700">เคลียร์เศษวัสดุ (ชม.)<input type="number" min="0" step="1" value={debrisHours} onChange={(event) => setDebrisHours(Math.max(0, Math.round(Number(event.target.value) || 0)))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" /><span className="mt-0.5 block text-xs font-normal text-slate-500">฿{debrisRatePerHour}/ชม.</span></label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">หมายเหตุถึงลูกค้า (ไม่บังคับ)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="เช่น มีกิ่งไม้ใหญ่หักหลังบ้าน" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" /></label>

            {/* สรุปราคา: ราคาเดิม/ใหม่ พร้อมรายรับช่าง (หลังหักค่าบริการแพลตฟอร์ม) และยอดที่ปรับ */}
            <dl className="mt-3 rounded-lg bg-white p-3 text-sm tabular-nums">
              <div className="flex justify-between"><dt className="text-slate-700">ราคาเดิม</dt><dd className="font-semibold text-slate-900">฿{money(job.price)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt className="pl-3">รายรับช่างตัดหญ้า</dt><dd>฿{money(netPayout(job.price))}</dd></div>

              <div className="mt-3 flex justify-between border-t border-slate-100 pt-3"><dt className="text-slate-700">ราคาใหม่</dt><dd className="font-semibold text-slate-900">฿{money(newAmount)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt className="pl-3">รายรับช่างตัดหญ้า</dt><dd className="font-semibold text-brand-700">฿{money(netPayout(newAmount))}</dd></div>

              <div className={`mt-3 flex justify-between border-t border-slate-100 pt-3 font-semibold ${difference > 0 ? 'text-rose-700' : difference < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                <dt>{difference < 0 ? 'ราคาปรับลด' : 'ราคาปรับเพิ่ม'}</dt>
                <dd>{difference > 0 ? '+ ' : difference < 0 ? '− ' : ''}฿{money(Math.abs(difference))}</dd>
              </div>
              {reasons.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={submit} disabled={!reasons.length || difference === 0} className="rounded-full bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">ส่งคำขอให้ลูกค้ายืนยัน</button>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button>
            </div>
            {(!reasons.length || difference === 0) && <p className="mt-2 text-xs text-slate-500">แก้ข้อมูลที่ต่างจากหน้างานจริงก่อนส่งคำขอ</p>}
          </div>
        )}
        <AdjustmentHistory adjustments={adjustments} />
      </div>
    </div>
  );
}

// ฝั่งลูกค้า: เห็นราคาเดิม/ราคาใหม่ แล้วเลือกยอมรับหรือปฏิเสธ
export function AdjustmentDecision({
  job,
  adjustment,
  onDecide,
  onPayDifference,
  onSimulateExpiry,
}: {
  job: Job;
  adjustment: QuoteAdjustment;
  onDecide: (accept: boolean) => void;
  onPayDifference: () => void;
  onSimulateExpiry?: () => void;
}) {
  const difference = adjustment.newAmount - adjustment.oldAmount;
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-700">ช่างขอปรับราคา · {job.title}</p>
        {adjustment.customerDecision === 'pending' && <span className="badge bg-amber-100 text-amber-800">⏱ ตอบภายใน {minutesLeft(adjustment.expiresAt)} นาที</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">ราคาเดิม</p><p className="text-lg font-semibold text-slate-500 line-through">฿{money(adjustment.oldAmount)}</p></div>
        <div className="rounded-lg bg-brand-50 p-3"><p className="text-xs text-slate-500">ราคาใหม่</p><p className="text-lg font-bold text-brand-700">฿{money(adjustment.newAmount)}</p></div>
      </div>
      <p className={`mt-2 text-center text-sm font-medium ${difference > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{difference > 0 ? `ชำระเพิ่ม ฿${money(difference)}` : `ได้รับเงินคืน ฿${money(-difference)}`}</p>
      <p className="mt-3 text-xs font-semibold text-slate-700">สาเหตุ</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{adjustment.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      {adjustment.note && <p className="mt-1 text-sm text-slate-600">หมายเหตุจากช่าง: {adjustment.note}</p>}
      {adjustment.settlement === 'awaiting_payment' ? (
        <button type="button" onClick={onPayDifference} className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600">จำลองสแกน QR ชำระส่วนต่าง ฿{money(difference)}</button>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onDecide(false)} className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700">ปฏิเสธ</button>
          <button type="button" onClick={() => onDecide(true)} className="rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">ยอมรับ</button>
        </div>
      )}
      {adjustment.customerDecision === 'pending' && <p className="mt-2 text-xs text-slate-500">ถ้าไม่ตอบภายใน 1 ชั่วโมง คำขอจะหมดอายุและราคาคงเดิม{onSimulateExpiry && <> · <button type="button" onClick={onSimulateExpiry} className="text-slate-400 underline hover:text-slate-600">(ทดสอบ) จำลองให้หมดอายุ</button></>}</p>}
    </div>
  );
}
