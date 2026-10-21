'use client';

import { useEffect, useState } from 'react';

export const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none';
export const labelClass = 'block text-sm font-medium text-slate-700';

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-rose-700">{message}</p> : null;
}

export function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm text-brand-700">{step}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function phoneDigitsOf(phone: string) {
  return phone.replace(/\D/g, '');
}

export function isValidThaiMobile(phone: string) {
  return /^0\d{9}$/.test(phoneDigitsOf(phone));
}

export const phoneErrorMessage = 'กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0';

const otpCooldownSeconds = 60;
const otpValidMinutes = 5;

// เบอร์โทร + OTP 6 หลัก (ตัวอย่างหน้าจอ: แสดงรหัสบนหน้าจอแทนการส่ง SMS จริง)
export function PhoneOtpField({
  phone,
  onPhoneChange,
  verified,
  onVerifiedChange,
  phoneError,
  otpError,
}: {
  phone: string;
  onPhoneChange: (phone: string) => void;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  phoneError?: string;
  otpError?: string;
}) {
  const [sentOtp, setSentOtp] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [otpInput, setOtpInput] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function sendOtp() {
    if (!isValidThaiMobile(phone)) {
      setLocalError(phoneErrorMessage);
      return;
    }
    if (cooldown > 0) return;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentOtp(code);
    setExpiresAt(Date.now() + otpValidMinutes * 60 * 1000);
    setOtpInput('');
    setCooldown(otpCooldownSeconds);
    setLocalError('');
    onVerifiedChange(false);
    setMessage(`ส่ง OTP ไปที่ ${phoneDigitsOf(phone)} แล้ว ใช้ได้ ${otpValidMinutes} นาที (ตัวอย่างหน้าจอ: รหัสคือ ${code})`);
  }

  function verifyOtp() {
    if (!sentOtp) return;
    if (Date.now() > expiresAt) {
      setLocalError('รหัส OTP หมดอายุ กรุณาขอรหัสใหม่');
      return;
    }
    if (otpInput !== sentOtp) {
      setLocalError('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่');
      return;
    }
    setLocalError('');
    setMessage('');
    onVerifiedChange(true);
  }

  function changePhone(value: string) {
    onPhoneChange(value);
    setLocalError('');
    if (verified || sentOtp) {
      onVerifiedChange(false);
      setSentOtp('');
      setOtpInput('');
      setMessage('');
    }
  }

  return (
    <div>
      <label className={labelClass}>เบอร์โทร <span className="text-rose-700">*</span>
        <div className="mt-1 flex gap-2">
          <input type="tel" inputMode="numeric" value={phone} onChange={(event) => changePhone(event.target.value)} placeholder="08x-xxx-xxxx" autoComplete="tel" className={`${inputClass} mt-0`} />
          <button type="button" onClick={sendOtp} disabled={cooldown > 0 || verified} className="shrink-0 rounded-full border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent">
            {verified ? 'ยืนยันแล้ว' : cooldown > 0 ? `ขอใหม่ใน ${cooldown} วิ` : sentOtp ? 'ขอ OTP ใหม่' : 'ส่ง OTP'}
          </button>
        </div>
      </label>
      {message && <p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
      {verified ? (
        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">✓ ยืนยันเบอร์โทรสำเร็จ</p>
      ) : sentOtp && (
        <div className="mt-3 flex gap-2">
          <input value={otpInput} onChange={(event) => setOtpInput(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="รหัส OTP 6 หลัก" aria-label="รหัส OTP" className={`${inputClass} mt-0 tracking-widest`} />
          <button type="button" onClick={verifyOtp} disabled={otpInput.length !== 6} className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:bg-slate-300">ยืนยัน</button>
        </div>
      )}
      <FieldError message={localError || phoneError || otpError} />
    </div>
  );
}

export const thaiBanks = ['ธนาคารกสิกรไทย', 'ธนาคารไทยพาณิชย์', 'ธนาคารกรุงเทพ', 'ธนาคารกรุงไทย', 'ธนาคารกรุงศรีอยุธยา', 'ธนาคารทหารไทยธนชาต', 'ธนาคารออมสิน', 'ธ.ก.ส.'];
