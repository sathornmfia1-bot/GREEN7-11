'use client';

import { useState } from 'react';
import { resizeImage } from '../../_lib/image';
import { maxCompletionPhotos, minCompletionPhotos } from '../../_lib/rules';

// ช่างกด "ทำงานเสร็จแล้ว" → แนบรูปงานที่เสร็จแล้วอย่างน้อย 5 รูป ก่อนยืนยัน
export function CompletionPhotoForm({ onSubmit, onCancel }: { onSubmit: (photos: string[]) => Promise<boolean>; onCancel: () => void }) {
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

  return (
    <div className="w-full rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="font-semibold text-slate-900">📸 แนบรูปงานที่เสร็จแล้ว</p>
      <p className="mt-1 text-sm text-slate-600">ถ่ายให้เห็นสนามทุกมุม ขอบสนาม และพื้นที่ที่เก็บกวาดแล้ว อย่างน้อย {minCompletionPhotos} รูป (สูงสุด {maxCompletionPhotos}) · ลูกค้าจะเห็นรูปเหล่านี้ตอนรีวิว</p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((url, index) => (
          <div key={index} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- รูปที่เพิ่งถ่าย (data URL) */}
            <img src={url} alt={`รูปงานที่เสร็จแล้ว ${index + 1}`} className="h-full w-full object-cover" />
            <button type="button" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => { setPhotos((current) => current.filter((_, i) => i !== index)); setError(''); }} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80">✕</button>
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
