'use client';

import { useEffect, useRef, useState } from 'react';

// ส่วนประกอบสำหรับหน้าจอมือถือ (กว้าง < 640px) — เวอร์ชันคอมไม่แสดง/ไม่เปลี่ยน
// ออกแบบให้ใช้มือเดียว: ปุ่มหลักอยู่ด้านล่าง ขนาดแตะได้อย่างน้อย 48 dp

// ความสูงแถบเมนูล่างของหน้าที่ล็อกอินแล้ว (role-shell) — แถบปุ่มหลักลอยอยู่เหนือแถบเมนูนี้
export const mobileNavHeight = '4rem';

// ช่องที่เปิดแป้นพิมพ์บนมือถือ (ไม่นับ checkbox/radio/ปุ่ม/รายการเลือก ที่ไม่เปิดแป้นพิมพ์)
function opensKeyboard(element: EventTarget | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden'].includes(element.type);
}

// แป้นพิมพ์เปิดอยู่หรือไม่ (มีช่องพิมพ์ที่โฟกัสอยู่) · ใช้ซ่อนแถบที่ติดด้านล่างจอระหว่างพิมพ์
// ตรวจ 2 ทาง: (1) มีช่องพิมพ์ที่โฟกัสอยู่ (2) พื้นที่จอที่มองเห็นหดลงมาก (แป้นพิมพ์ดันขึ้นมา — ใช้ได้แม้ตรวจโฟกัสพลาด เช่น ในเบราว์เซอร์ของ LINE)
export function useKeyboardOpen() {
  const [focused, setFocused] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  useEffect(() => {
    const update = () => setFocused(opensKeyboard(document.activeElement));
    // focusout เกิดก่อนโฟกัสย้ายไปช่องถัดไป → ตรวจใหม่หลังเหตุการณ์จบ
    const onFocusOut = () => window.setTimeout(update, 0);
    // แตะช่องพิมพ์ → รอแป้นพิมพ์ขึ้นเสร็จ แล้วเลื่อนช่องนั้นมากลางจอ ไม่ให้อยู่ใต้แป้นพิมพ์
    const onFocusIn = (event: FocusEvent) => {
      update();
      const target = event.target;
      if (opensKeyboard(target) && window.matchMedia('(max-width: 639px)').matches) {
        window.setTimeout(() => { if (document.activeElement === target) (target as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
      }
    };
    // ความสูงสูงสุดที่เคยเห็น = จอตอนไม่มีแป้นพิมพ์ · หดเกิน 25% ถือว่าแป้นพิมพ์เปิด
    const viewport = window.visualViewport;
    let tallest = viewport?.height ?? window.innerHeight;
    let width = window.innerWidth;
    const onResize = () => {
      const height = viewport?.height ?? window.innerHeight;
      // หมุนจอ (ความกว้างเปลี่ยน) → เริ่มนับความสูงใหม่ ไม่ให้เข้าใจผิดว่าแป้นพิมพ์เปิด
      if (window.innerWidth !== width) { width = window.innerWidth; tallest = height; }
      tallest = Math.max(tallest, height);
      setShrunk(height < tallest * 0.75);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', onResize);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return focused || shrunk;
}

// แถบปุ่มหลักติดด้านล่างจอ (มือถือเท่านั้น) · aboveNav = อยู่เหนือแถบเมนูล่าง
// ระหว่างพิมพ์ (แป้นพิมพ์เปิด) ซ่อนแถบนี้ ไม่ให้ลอยขึ้นมาบังช่องที่กำลังกรอก
export function MobileStickyBar({ children, aboveNav = false }: { children: React.ReactNode; aboveNav?: boolean }) {
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;
  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-slate-200 bg-white px-4 pt-3 shadow-[0_-4px_16px_rgba(16,24,40,0.06)] sm:hidden"
      style={aboveNav ? { bottom: `calc(${mobileNavHeight} + env(safe-area-inset-bottom))`, paddingBottom: '0.75rem' } : { bottom: 0, paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}

// ปุ่มหลักขนาดใหญ่ (สูง 56px) สำหรับแถบด้านล่าง
export const mobileCtaClass = 'flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-display text-lg font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500';

// แผ่นเลื่อนขึ้นจากด้านล่าง: แตะพื้นหลังหรือปัดลงเพื่อปิด
export function BottomSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // ล็อกการเลื่อนหน้าด้านหลังระหว่างเปิด
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92vh] flex-col rounded-t-3xl bg-white shadow-lift transition-transform"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        {/* แถบจับสำหรับปัดลงเพื่อปิด */}
        <div
          className="flex touch-none justify-center pb-1 pt-3"
          onPointerDown={(event) => { startY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={(event) => { if (startY.current !== null) setDragY(Math.max(0, event.clientY - startY.current)); }}
          onPointerUp={() => { if (dragY > 90) onClose(); setDragY(0); startY.current = null; }}
          onPointerCancel={() => { setDragY(0); startY.current = null; }}
        >
          <span aria-hidden="true" className="h-1.5 w-11 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between px-5">
          <h2 className="font-display text-xl font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="-mr-3 flex h-12 w-12 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>{footer}</div>}
      </section>
    </div>
  );
}

// หัวข้อยุบ/ขยาย (ใช้ <details> ของเบราว์เซอร์ · แตะทั้งแถวได้ สูง 52px)
export function Accordion({ title, children, defaultOpen = false, className = '', id }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; className?: string; id?: string }) {
  return (
    <details id={id} open={defaultOpen} className={`group scroll-mt-20 border-b border-slate-100 last:border-b-0 ${className}`}>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{title}</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

// เลื่อนเพื่อยืนยัน: กันกดพลาด (เช่น ระหว่างถือเครื่องตัดหญ้า/ใส่ถุงมือ) · คีย์บอร์ด: Enter/Space ยืนยันได้
export function SlideToConfirm({ label, onConfirm, disabled = false, busy = false }: { label: string; onConfirm: () => void; disabled?: boolean; busy?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const knob = 52;
  const max = () => Math.max(0, (track.current?.clientWidth ?? 0) - knob - 8);
  const progress = max() ? offset / max() : 0;

  function finish() {
    if (start.current === null) return;
    start.current = null;
    if (progress >= 0.85 && !disabled && !busy) {
      setOffset(max());
      onConfirm();
      window.setTimeout(() => setOffset(0), 600);
    } else {
      setOffset(0);
    }
  }

  return (
    <div
      ref={track}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || busy}
      aria-label={`${label} (เลื่อนไปทางขวา หรือกด Enter เพื่อยืนยัน)`}
      onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !disabled && !busy) { event.preventDefault(); onConfirm(); } }}
      className={`relative flex h-[60px] select-none items-center justify-center overflow-hidden rounded-full ${disabled ? 'bg-slate-200' : 'bg-brand-700'}`}
    >
      <span className={`pointer-events-none pl-10 font-display text-[17px] font-semibold ${disabled ? 'text-slate-500' : 'text-white'}`} style={{ opacity: 1 - progress }}>
        {busy ? 'กำลังบันทึก…' : `เลื่อนเพื่อ ${label} ›››`}
      </span>
      <span
        aria-hidden="true"
        className="absolute left-1 top-1 flex touch-none items-center justify-center rounded-full bg-white shadow-soft"
        style={{ width: knob, height: knob, transform: `translateX(${offset}px)`, transition: start.current === null ? 'transform 0.2s' : 'none' }}
        onPointerDown={(event) => { if (disabled || busy) return; start.current = event.clientX - offset; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (start.current !== null) setOffset(Math.min(max(), Math.max(0, event.clientX - start.current))); }}
        onPointerUp={finish}
        onPointerCancel={() => { start.current = null; setOffset(0); }}
      >
        <svg viewBox="0 0 24 24" className={`h-6 w-6 ${disabled ? 'text-slate-400' : 'text-brand-700'}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </span>
    </div>
  );
}
