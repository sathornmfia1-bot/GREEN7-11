'use client';

import Link from 'next/link';
import type { MechanicAccount } from '../../_lib/types';

// ช่างที่ยังไม่ผ่านการตรวจสอบรับงานไม่ได้ (PRD 4.2.1)
export function VerificationBanner({ mechanic }: { mechanic: MechanicAccount }) {
  if (mechanic.status === 'verified') return null;
  return mechanic.status === 'pending_verification' ? (
    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">⏳ ใบสมัครของคุณรอแอดมินตรวจสอบ · ระหว่างนี้ดูงานได้แต่ยังรับงานไม่ได้</p>
  ) : (
    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      ✕ ใบสมัครไม่ผ่านการอนุมัติ{mechanic.rejectReason && ` · ${mechanic.rejectReason}`}
      <Link href="/mechanic/profile" className="ml-1 font-semibold underline">ดูโปรไฟล์</Link>
    </div>
  );
}
