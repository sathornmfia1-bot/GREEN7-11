'use client';

import { useEffect, useState } from 'react';
import { formatPhone } from '../_lib/rules';

// เบอร์ไทย 0XXXXXXXXX → +66XXXXXXXXX (รูปแบบสากล แอปโทรศัพท์ทุกเครื่องรู้จัก)
export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return /^0\d{8,9}$/.test(digits) ? `tel:+66${digits.slice(1)}` : `tel:${digits}`;
}

// เปิดหน้านี้ในเบราว์เซอร์หลักของเครื่อง (LINE รองรับพารามิเตอร์ openExternalBrowser=1)
function externalBrowserUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('openExternalBrowser', '1');
  return url.toString();
}

// ปุ่มโทรหาลูกค้า + คัดลอกเบอร์
// เบราว์เซอร์ใน LINE (Android) มักไม่เปิดแอปโทรศัพท์จากลิงก์ tel: จึงมีทางเลือกเปิดใน Chrome และคัดลอกเบอร์
export function CallButton({ phone, label = 'โทรหาลูกค้า' }: { phone: string; label?: string }) {
  const [inLine, setInLine] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInLine(/\bLine\//i.test(navigator.userAgent));
  }, []);

  if (!phone) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      // เบราว์เซอร์บางตัวไม่อนุญาต clipboard API → ใช้วิธีเลือกข้อความแทน
      const field = document.createElement('textarea');
      field.value = phone;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>📞 <a href={telHref(phone)} className="font-semibold tabular-nums text-slate-900 underline decoration-slate-300 underline-offset-2">{formatPhone(phone)}</a></span>
        <a href={telHref(phone)} className="rounded-full bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600">{label}</a>
        <button type="button" onClick={copy} aria-live="polite" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-brand-500">
          {copied ? '✓ คัดลอกแล้ว' : 'คัดลอกเบอร์'}
        </button>
      </div>
      {inLine && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          ถ้ากดโทรแล้วไม่ขึ้นหน้าโทรศัพท์ (เบราว์เซอร์ใน LINE บางเครื่องไม่รองรับ) ให้กด “คัดลอกเบอร์” แล้ววางในแอปโทรศัพท์ หรือ{' '}
          <a href="#" onClick={(event) => { event.preventDefault(); window.location.href = externalBrowserUrl(); }} className="font-semibold underline">เปิดหน้านี้ใน Chrome</a>
        </p>
      )}
    </div>
  );
}
