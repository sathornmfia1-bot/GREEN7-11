'use client';

import { useState } from 'react';
import { resizeImage } from '../../_lib/image';
import { maxCompletionPhotos, minCompletionPhotos } from '../../_lib/rules';
import { MobileStickyBar, mobileCtaClass } from '../../_components/mobile';

// ช่างกด "ทำงานเสร็จแล้ว" → แนบรูปงานที่เสร็จแล้วอย่างน้อย 5 รูป ก่อนยืนยัน
// variant "card" (คอม): กล่องในการ์ดงาน · "screen" (มือถือ): หน้าเต็มจอ เปิดกล้องได้ทันที ปุ่มยืนยันติดด้านล่าง
export function CompletionPhotoForm({ onSubmit, onCancel, variant = 'card' }: { onSubmit: (photos: string[]) => Promise<boolean>; onCancel: () => void; variant?: 'card' | 'screen' }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const remaining = Math.max(0, minCompletionPhotos - photos.length);
  const room = maxCompletionPhotos - photos.length;

  async function addFiles(files: FileList | null) {
    const images = [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    setError('');
    if (images.length > room) setError(`แนบได้สูงสุด ${maxCompletionPhotos} รูป · เลือกไว้เฉพาะ ${room} รูปแรก`);
    setLoading(true);
    // ย่อรูปเหลือด้านยาว 1024px ให้ลูกค้าเห็นรายละเอียดงาน และส่งได้เร็วบนมือถือ
    const resized = await Promise.all(images.slice(0, room).map((file) => resizeImage(file, 1024, 0.72).catch(() => null)));
    setLoading(false);
    const added = resized.filter((url): url is string => Boolean(url));
    if (added.length < Math.min(images.length, room)) setError('บางรูปอ่านไม่ได้ กรุณาถ่ายใหม่');
    setPhotos((current) => [...current, ...added].slice(0, maxCompletionPhotos));
  }

  async function submit() {
    if (photos.length < minCompletionPhotos) {
      setError(`กรุณาแนบรูปอีก ${remaining} รูป (อย่างน้อย ${minCompletionPhotos} รูป)`);
      return;
    }
    setSending(true);
    const sent = await onSubmit(photos);
    setSending(false);
    if (!sent) setError('ส่งไม่สำเร็จ กรุณาลองอีกครั้ง');
  }

  const removePhoto = (index: number) => { setPhotos((current) => current.filter((_, i) => i !== index)); setError(''); };

  if (variant === 'screen') {
    // ช่องรูปที่ยังว่าง (แสดงให้ครบ 5 ช่อง เพื่อให้เห็นว่าเหลืออีกกี่รูป)
    const emptySlots = Math.max(0, minCompletionPhotos - photos.length);
    return (
      <div role="dialog" aria-modal="true" aria-label="ส่งงาน แนบรูปงานที่เสร็จแล้ว" className="fixed inset-0 z-50 overflow-y-auto bg-white pb-32">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-1 border-b border-slate-200 bg-white px-2">
          <button type="button" onClick={onCancel} disabled={sending} aria-label="ปิด" className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <h2 className="font-display text-xl font-semibold text-slate-900">ส่งงาน</h2>
        </header>

        <section className="px-4 pt-5 text-center">
          <p aria-live="polite" className={`font-display text-5xl font-bold leading-none ${remaining ? 'text-amber-700' : 'text-brand-700'}`}>
            {photos.length} <span className="text-2xl text-slate-500">/ {minCompletionPhotos} รูป</span>
          </p>
          <p className="mt-2 text-[15px] text-slate-600">ถ่ายให้เห็นทุกมุม และพื้นที่ที่เก็บกวาดแล้ว</p>
          <div aria-hidden="true" className="mx-auto mt-3 grid w-56 grid-cols-5 gap-1">
            {Array.from({ length: minCompletionPhotos }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index < photos.length ? 'bg-brand-700' : 'bg-slate-200'}`} />)}
          </div>
        </section>

        <section aria-label="รูปงาน" className="mt-5 grid grid-cols-3 gap-2 px-4">
          {room > 0 && (
            <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-brand-700 text-sm font-semibold text-white ${loading ? 'opacity-60' : ''}`}>
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              {loading ? 'กำลังโหลด…' : 'ถ่ายรูป'}
              {/* capture: เปิดกล้องหลังทันทีบนมือถือ */}
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={loading} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
            </label>
          )}
          {photos.map((url, index) => (
            <div key={index} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปที่เพิ่งถ่าย (data URL) */}
              <img src={url} alt={`รูปงานที่เสร็จแล้ว ${index + 1}`} className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950/70 px-1.5 text-xs font-semibold text-white">{index + 1}</span>
              <button type="button" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => removePhoto(index)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/60 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
          {Array.from({ length: emptySlots }, (_, index) => (
            <div key={`empty-${index}`} aria-hidden="true" className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-xl font-semibold text-slate-400">{photos.length + index + 1}</div>
          ))}
        </section>
        <p className="mt-3 px-4 text-center text-sm text-slate-500">เลือกจากคลังรูปได้หลายรูป · แตะ ✕ เพื่อลบ</p>
        <div className="mt-2 px-4 text-center">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-semibold text-brand-700 underline">
            เลือกจากคลังรูป
            <input type="file" accept="image/*" multiple className="sr-only" disabled={loading || room <= 0} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
          </label>
        </div>
        {error && <p role="alert" className="mt-2 px-4 text-center text-sm text-rose-700">{error}</p>}

        <MobileStickyBar>
          <button type="button" onClick={submit} disabled={sending || loading || photos.length < minCompletionPhotos} className={`${mobileCtaClass} bg-brand-700 hover:bg-brand-800`}>
            {sending ? 'กำลังส่งรูป…' : remaining ? `ยืนยันทำงานเสร็จ · อีก ${remaining} รูป` : 'ยืนยันทำงานเสร็จ'}
          </button>
        </MobileStickyBar>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="font-semibold text-slate-900">📸 แนบรูปงานที่เสร็จแล้ว</p>
      <p className="mt-1 text-sm text-slate-600">ถ่ายให้เห็นสนามทุกมุม ขอบสนาม และพื้นที่ที่เก็บกวาดแล้ว อย่างน้อย {minCompletionPhotos} รูป (สูงสุด {maxCompletionPhotos}) · ลูกค้าจะเห็นรูปเหล่านี้ตอนรีวิว</p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((url, index) => (
          <div key={index} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- รูปที่เพิ่งถ่าย (data URL) */}
            <img src={url} alt={`รูปงานที่เสร็จแล้ว ${index + 1}`} className="h-full w-full object-cover" />
            <button type="button" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => removePhoto(index)} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80">✕</button>
          </div>
        ))}
        {room > 0 && (
          <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-300 bg-white text-center text-xs font-semibold text-brand-700 hover:border-brand-500 ${loading ? 'opacity-60' : ''}`}>
            <span aria-hidden="true" className="text-2xl">＋</span>
            {loading ? 'กำลังโหลด…' : 'ถ่าย/เลือกรูป'}
            <input type="file" accept="image/*" multiple className="sr-only" disabled={loading} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
          </label>
        )}
      </div>

      <p className={`mt-2 text-sm font-medium ${remaining ? 'text-amber-700' : 'text-brand-700'}`} aria-live="polite">
        {remaining ? `แนบแล้ว ${photos.length}/${minCompletionPhotos} รูป · ต้องแนบอีก ${remaining} รูป` : `✓ แนบครบแล้ว ${photos.length} รูป`}
      </p>
      {error && <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={sending || loading || photos.length < minCompletionPhotos} className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">
          {sending ? 'กำลังส่งรูป…' : '✅ ยืนยันทำงานเสร็จแล้ว'}
        </button>
        <button type="button" onClick={onCancel} disabled={sending} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button>
      </div>
    </div>
  );
}
