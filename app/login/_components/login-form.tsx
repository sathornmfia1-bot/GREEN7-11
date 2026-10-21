'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '../../_components/brand';
import { listTestAccounts, loginWithPassword, requestPasswordReset, resetPassword } from '../../_server/actions';
import { formatPhone } from '../../_lib/rules';
import { getSessionUserId, roleLabels, roles, safeNextPath, setSession, type Role } from '../../_lib/session';

const minPasswordLength = 8;
const resendSeconds = 60;
const registerPath: Partial<Record<Role, string>> = { customer: '/register/customer', mechanic: '/register/mechanic' };

type TestAccount = { id: string; first_name: string; last_name: string; phone: string; status?: string };

const inputClass = 'mt-1.5 w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-3 text-base text-slate-900 focus:border-brand-500 focus:outline-none';
const labelClass = 'block text-base font-semibold text-slate-900';

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="m3 3 18 18" />}
    </svg>
  );
}

function PasswordInput({ value, onChange, autoComplete, label }: { value: string; onChange: (value: string) => void; autoComplete: string; label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className={labelClass}>
      {label}
      <span className="relative block">
        <input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className={`${inputClass} pr-12`} />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={visible} className="absolute inset-y-0 right-0 mt-1.5 flex w-12 items-center justify-center text-slate-700 hover:text-slate-900">
          <EyeIcon open={!visible} />
        </button>
      </span>
    </label>
  );
}

// เข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่าน · บัญชีที่ยังไม่มีรหัสผ่าน ตั้งได้จาก "ลืมหรือยังไม่เคยตั้งรหัสผ่าน?"
export default function LoginForm({ role, next }: { role: Role; next: string | null }) {
  const router = useRouter();
  const destination = safeNextPath(role, next);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  // ตั้งรหัสผ่านใหม่
  const [codeSent, setCodeSent] = useState<{ testCode?: string; minutes: number } | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);

  // ล็อกอินใน role นี้อยู่แล้ว → ไปหน้าของ role นี้เลย (หน้าปลายทางตรวจบัญชีกับฐานข้อมูลอีกครั้ง)
  useEffect(() => {
    if (getSessionUserId(role)) router.replace(destination);
  }, [role, router, destination]);

  useEffect(() => {
    listTestAccounts(role).then(setTestAccounts).catch(() => setTestAccounts([]));
  }, [role]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const digits = phone.replace(/\D/g, '');

  function clearMessages() {
    setError('');
    setNotRegistered(false);
  }

  function switchMode(next: 'login' | 'reset') {
    setMode(next);
    clearMessages();
    setCodeSent(null);
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    if (!/^0\d{9}$/.test(digits)) return setError('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0');
    if (!password) return setError('กรุณากรอกรหัสผ่าน');
    setBusy(true);
    const result = await loginWithPassword(role, digits, password).catch(() => ({ ok: false as const, reason: 'error' as const, message: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' }));
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setNotRegistered(result.reason === 'not_registered');
      return;
    }
    setSession(role, result.userId);
    router.replace(destination);
  }

  async function sendCode() {
    clearMessages();
    if (!/^0\d{9}$/.test(digits)) return setError('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0');
    setBusy(true);
    const result = await requestPasswordReset(role, digits);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setNotRegistered(result.message.includes('ยังไม่ได้ลงทะเบียน'));
      return;
    }
    setCodeSent({ testCode: 'testCode' in result ? result.testCode : undefined, minutes: ('validMinutes' in result && result.validMinutes) || 5 });
    setCode('');
    setCooldown(resendSeconds);
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    if (code.length !== 6) return setError('กรุณากรอกรหัสยืนยัน 6 หลัก');
    if (newPassword.length < minPasswordLength) return setError(`รหัสผ่านต้องมีอย่างน้อย ${minPasswordLength} ตัวอักษร`);
    if (newPassword !== confirmPassword) return setError('รหัสผ่านไม่ตรงกัน');
    setBusy(true);
    const result = await resetPassword(role, digits, code, newPassword);
    setBusy(false);
    if (!result.ok || !('userId' in result) || !result.userId) return setError(result.message);
    setSession(role, result.userId);
    router.replace(destination);
  }

  const errorBox = error && (
    <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
      {error}
      {notRegistered && registerPath[role] && <Link href={registerPath[role]!} className="mt-1 block font-semibold underline">ลงทะเบียน{roleLabels[role]} →</Link>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex justify-center bg-white px-4 py-6">
        <Logo size="lg" />
      </header>

      <main className="mx-auto max-w-md bg-white px-5 pb-10 pt-8 sm:mt-0 sm:rounded-b-2xl sm:px-8 sm:shadow-soft">
        <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{roleLabels[role]}</p>

        {mode === 'login' ? (
          <>
            <h1 className="mt-3 font-display text-4xl font-bold text-brand-500">ยินดีต้อนรับกลับ</h1>
            <p className="mt-3 text-lg leading-relaxed text-brand-600">กรอกข้อมูลด้านล่างเพื่อเข้าสู่ระบบ</p>

            <form onSubmit={login} noValidate className="mt-7 space-y-5">
              <label className={labelClass}>
                เบอร์โทร
                <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); clearMessages(); }} placeholder="08x-xxx-xxxx" className={inputClass} />
              </label>
              <PasswordInput label="รหัสผ่าน" value={password} onChange={(value) => { setPassword(value); clearMessages(); }} autoComplete="current-password" />

              <button type="button" onClick={() => switchMode('reset')} className="text-left text-lg font-bold text-brand-600 underline underline-offset-4 hover:text-brand-700">
                ลืมหรือยังไม่เคยตั้งรหัสผ่าน?
              </button>

              {errorBox}

              <button type="submit" disabled={busy} className="w-full rounded-2xl bg-brand-500 py-4 font-display text-xl font-bold text-white shadow-soft transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-70">
                {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-3xl font-bold text-brand-500">ตั้งรหัสผ่านใหม่</h1>
            <p className="mt-3 text-base leading-relaxed text-brand-600">กรอกเบอร์โทรที่ลงทะเบียนไว้ เราจะส่งรหัสยืนยัน 6 หลักไปให้ แล้วตั้งรหัสผ่านใหม่ได้ทันที</p>

            <form onSubmit={saveNewPassword} noValidate className="mt-7 space-y-5">
              <label className={labelClass}>
                เบอร์โทร
                <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setCodeSent(null); clearMessages(); }} placeholder="08x-xxx-xxxx" className={inputClass} />
              </label>

              {!codeSent ? (
                <>
                  {errorBox}
                  <button type="button" onClick={sendCode} disabled={busy} className="w-full rounded-2xl bg-brand-500 py-4 font-display text-xl font-bold text-white shadow-soft hover:bg-brand-600 disabled:cursor-wait disabled:opacity-70">
                    {busy ? 'กำลังส่ง…' : 'ส่งรหัสยืนยัน'}
                  </button>
                </>
              ) : (
                <>
                  <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    ส่งรหัสยืนยันไปที่ {formatPhone(digits)} แล้ว ใช้ได้ {codeSent.minutes} นาที
                    {codeSent.testCode && <span className="mt-1 block font-semibold">โหมดทดสอบ (ยังไม่ส่ง SMS จริง): รหัสคือ {codeSent.testCode}</span>}
                  </p>
                  <label className={labelClass}>
                    รหัสยืนยัน 6 หลัก
                    <input value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); clearMessages(); }} inputMode="numeric" autoComplete="one-time-code" className={`${inputClass} tracking-[0.4em]`} />
                  </label>
                  <PasswordInput label="รหัสผ่านใหม่" value={newPassword} onChange={(value) => { setNewPassword(value); clearMessages(); }} autoComplete="new-password" />
                  <p className="-mt-3 text-sm text-slate-500">อย่างน้อย {minPasswordLength} ตัวอักษร</p>
                  <PasswordInput label="ยืนยันรหัสผ่านใหม่" value={confirmPassword} onChange={(value) => { setConfirmPassword(value); clearMessages(); }} autoComplete="new-password" />
                  {errorBox}
                  <button type="submit" disabled={busy} className="w-full rounded-2xl bg-brand-500 py-4 font-display text-xl font-bold text-white shadow-soft hover:bg-brand-600 disabled:cursor-wait disabled:opacity-70">
                    {busy ? 'กำลังบันทึก…' : 'ตั้งรหัสผ่านและเข้าสู่ระบบ'}
                  </button>
                  <button type="button" onClick={sendCode} disabled={cooldown > 0 || busy} className="w-full text-center text-sm font-semibold text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline">
                    {cooldown > 0 ? `ส่งรหัสใหม่ได้ใน ${cooldown} วินาที` : 'ส่งรหัสยืนยันอีกครั้ง'}
                  </button>
                </>
              )}

              <button type="button" onClick={() => switchMode('login')} className="block text-base font-semibold text-brand-700 hover:underline">← กลับไปหน้าเข้าสู่ระบบ</button>
            </form>
          </>
        )}

        <hr className="my-8 border-slate-200" />

        {registerPath[role] && (
          <p className="text-center">
            <span className="block text-slate-600">ยังไม่มีบัญชี?</span>
            <Link href={registerPath[role]!} className="mt-1 inline-block font-display text-2xl font-bold text-brand-500 hover:text-brand-600">ลงทะเบียน{roleLabels[role]}</Link>
          </p>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          เข้าสู่ระบบในฐานะ: {roles.filter((item) => item !== role).map((item, index) => (
            <span key={item}>{index > 0 && ' · '}<Link href={`/login/${item}`} className="font-medium text-brand-700 hover:underline">{roleLabels[item]}</Link></span>
          ))}
        </p>

        <details className="mt-6 rounded-xl border border-dashed border-slate-300 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">บัญชีทดสอบ ({roleLabels[role]})</summary>
          <ul className="mt-3 space-y-1">
            {testAccounts.map((account) => (
              <li key={account.id}>
                <button type="button" onClick={() => { setPhone(account.phone); clearMessages(); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                  <span className="text-slate-800">{account.first_name} {account.last_name}{account.status && account.status !== 'verified' && <span className="ml-1 text-xs text-amber-700">({account.status === 'pending_verification' ? 'รออนุมัติ' : 'ไม่อนุมัติ'})</span>}</span>
                  <span className="tabular-nums text-slate-500">{formatPhone(account.phone)}</span>
                </button>
              </li>
            ))}
            {!testAccounts.length && <li className="px-2 text-slate-500">กำลังโหลด...</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-500">แตะเพื่อกรอกเบอร์ · บัญชีที่ยังไม่มีรหัสผ่าน ให้กด “ลืมหรือยังไม่เคยตั้งรหัสผ่าน?” เพื่อตั้งก่อน</p>
        </details>
      </main>
    </div>
  );
}
