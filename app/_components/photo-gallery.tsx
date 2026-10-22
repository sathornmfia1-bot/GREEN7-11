'use client';

import { useEffect, useState } from 'react';

// แถบรูปย่อ + กดดูเต็มจอ (เลื่อนรูปก่อนหน้า/ถัดไป ปิดด้วย Esc หรือแตะพื้นหลัง)
export function PhotoGallery({ photos, label }: { photos: string[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
      if (event.key === 'ArrowRight') setOpen((index) => (index === null ? null : (index + 1) % photos.length));
      if (event.key === 'ArrowLeft') setOpen((index) => (index === null ? null : (index - 1 + photos.length) % photos.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos.length]);

  if (!photos.length) return null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label={label}>
        {photos.map((url, index) => (
          <li key={index}>
            <button type="button" onClick={() => setOpen(index)} className="block aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL จากฐานข้อมูล */}
              <img src={url} alt={`${label} รูปที่ ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={`${label} รูปที่ ${open + 1} จาก ${photos.length}`} className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm">{open + 1} / {photos.length}</span>
            <button type="button" onClick={() => setOpen(null)} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">✕ ปิด</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL จากฐานข้อมูล */}
            <img src={photos[open]} alt={`${label} รูปที่ ${open + 1}`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
            {photos.length > 1 && (
              <>
                <button type="button" aria-label="รูปก่อนหน้า" onClick={(event) => { event.stopPropagation(); setOpen((open - 1 + photos.length) % photos.length); }} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">‹</button>
                <button type="button" aria-label="รูปถัดไป" onClick={(event) => { event.stopPropagation(); setOpen((open + 1) % photos.length); }} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">›</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
