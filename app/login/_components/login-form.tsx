'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '../../_components/brand';
import { findLoginAccount, listTestAccounts } from '../../_server/actions';
import { formatPhone } from '../../_lib/rules';
import { getSessionUserId, roleLabels, roles, safeNextPath, setSession, type Role } from '../../_lib/session';

const otpCooldownSeconds = 60;
const otpValidMinutes = 5;

const roleIcons: Record<Role, string> = { customer: '🏡', mechanic: '👷', admin: '🛡️' };
const registerPath: Partial<Record<Role, string>> = { customer: '/register/customer', mechanic: '/register/mechanic' };

type TestAccount = { id: string; first_name: string; last_name: string; phone: string; status?: string };

// ล็อกอินแบบจำลอง: ตรวจเบอร์กับบัญชีในฐานข้อมูล Supabase แล้วสร้าง OTP บนหน้าจอ (ยังไม่ส่ง SMS จริง)
export default function LoginForm({ role, next }: { role: Role; next: string | null }) {
  const router = useRouter();
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState('');
  const [sentOtp, setSentOtp] = useState<{ code: string; userId: string; expiresAt: number } | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const destination = safeNextPath(role, next);

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

  async function requestOtp() {
    setError('');
    setNotRegistered(false);
    if (!/^0\d{9}$/.test(digits)) {
      setError('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0');
      return;
    }
    // ค้นหาเฉพาะบัญชีของ role นี้ — เบอร์ของ role อื่นเข้าหน้านี้ไม่ได้
    setChecking(true);
    const account = await findLoginAccount(role, digits).catch(() => ({ ok: false, userId: undefined, message: 'error' }));
    setChecking(false);
    if (!account.ok || !account.userId) {
      setNotRegistered(account.message === 'not_registered');
      setError(account.message === 'not_registered' ? `เบอร์นี้ยังไม่ได้ลงทะเบียนเป็น${roleLabels[role]}` : 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่');
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentOtp({ code, userId: account.userId, expiresAt: Date.now() + otpValidMinutes * 60000 });
    setOtpInput('');
    setCooldown(otpCooldownSeconds);
  }

  function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!sentOtp) return;
    if (Date.now() > sentOtp.expiresAt) {
      setError('รหัส OTP หมดอายุ กรุณาขอรหัสใหม่');
      return;
    }
    if (otpInput !== sentOtp.code) {
      setError('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่');
      return;
    }
    setSession(role, sentOtp.userId);
    router.replace(destination);
  }

  function changePhone(value: string) {
    setPhone(value);
    setSentOtp(null);
    setOtpInput('');
    setError('');
    setNotRegistered(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><Logo /><Link href="/#login" className="ml-auto text-sm font-medium text-brand-600 hover:underline">เปลี่ยนประเภทผู้ใช้</Link></div>
      <div className="card mt-3 p-5 sm:p-6">
        <p className="text-3xl" aria-hidden="true">{roleIcons[role]}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">เข้าสู่ระบบ{roleLabels[role]}</h1>
        <p className="mt-1 text-sm text-slate-600">ใช้เบอร์โทรที่ลงทะเบียนไว้ ระบบจะส่งรหัส OTP 6 หลัก</p>

        <form onSubmit={verify} noValidate className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">เบอร์โทร
            <div className="mt-1 flex gap-2">
              <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => changePhone(event.target.value)} placeholder="08x-xxx-xxxx" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none" />
              <button type="button" onClick={requestOtp} disabled={cooldown > 0 || checking} className="shrink-0 rounded-full border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
                {checking ? 'กำลังตรวจ...' : cooldown > 0 ? `ขอใหม่ใน ${cooldown} วิ` : sentOtp ? 'ขอ OTP ใหม่' : 'ขอรหัส OTP'}
              </button>
            </div>
          </label>

          {sentOtp && (
            <>
              <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">ส่ง OTP ไปที่ {formatPhone(digits)} แล้ว ใช้ได้ {otpValidMinutes} นาที · <span className="font-semibold">โหมดทดสอบ: รหัสคือ {sentOtp.code}</span></p>
              <label className="block text-sm font-medium text-slate-700">รหัส OTP
                <input value={otpInput} onChange={(event) => { setOtpInput(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} inputMode="numeric" autoComplete="one-time-code" placeholder="รหัส 6 หลัก" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 tracking-widest text-slate-900 focus:border-brand-500 focus:outline-none" />
              </label>
              <button type="submit" disabled={otpInput.length !== 6} className="w-full rounded-full bg-accent-500 font-display tracking-wide shadow-soft px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-300">เข้าสู่ระบบ</button>
            </>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              {error}
              {notRegistered && registerPath[role] && <Link href={registerPath[role]!} className="mt-1 block font-semibold underline">ลงทะเบียน{roleLabels[role]} →</Link>}
            </div>
          )}
        </form>

        {registerPath[role] && <p className="mt-5 text-center text-sm text-slate-600">ยังไม่มีบัญชี? <Link href={registerPath[role]!} className="font-semibold text-brand-700 hover:underline">ลงทะเบียน{roleLabels[role]}</Link></p>}
      </div>

      <details className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-700">บัญชีทดสอบ ({roleLabels[role]})</summary>
        <ul className="mt-3 space-y-1">
          {testAccounts.map((account) => (
            <li key={account.id}>
              <button type="button" onClick={() => changePhone(account.phone)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                <span className="text-slate-800">{account.first_name} {account.last_name}{account.status && account.status !== 'verified' && <span className="ml-1 text-xs text-amber-700">({account.status === 'pending_verification' ? 'รออนุมัติ' : 'ไม่อนุมัติ'})</span>}</span>
                <span className="tabular-nums text-slate-500">{formatPhone(account.phone)}</span>
              </button>
            </li>
          ))}
          {!testAccounts.length && <li className="px-2 text-slate-500">กำลังโหลด...</li>}
        </ul>
        <p className="mt-2 text-xs text-slate-500">บัญชีจากฐานข้อมูล Supabase · แตะเพื่อกรอกเบอร์ · OTP เป็นรหัสจำลองที่แสดงบนหน้าจอ</p>
      </details>

      <p className="mt-4 text-center text-xs text-slate-500">
        เข้าสู่ระบบในฐานะ: {roles.filter((item) => item !== role).map((item, index) => (
          <span key={item}>{index > 0 && ' · '}<Link href={`/login/${item}`} className="font-medium text-brand-700 hover:underline">{roleLabels[item]}</Link></span>
        ))}
      </p>
    </main>
  );
}
