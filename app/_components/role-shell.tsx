'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { loadJobPhotos, loadSnapshot } from '../_server/actions';
import { Logo } from './brand';
import { clearSession, getSessionUserId, roleLabels, type Role } from '../_lib/session';
import type { AdminAccount, CustomerAccount, MechanicAccount, Result, Snapshot } from '../_lib/types';

export type NavItem = { href: string; label: string; icon: string; badge?: 'notifications' };

type ShellContext = {
  userId: string;
  data: Snapshot;
  refresh: () => Promise<void>;
  notice: (message: string, ok?: boolean) => void;
  // เรียกคำสั่งบนเซิร์ฟเวอร์ แสดงผลลัพธ์ แล้วโหลดข้อมูลใหม่
  run: <T extends Result>(action: Promise<T>) => Promise<T>;
};
const RoleShellContext = createContext<ShellContext | null>(null);

function useShell() {
  const context = useContext(RoleShellContext);
  if (!context) throw new Error('ต้องใช้ภายใน RoleShell');
  return context;
}

export const useNotice = () => useShell().notice;
export const useData = () => useShell().data;
export const useRefresh = () => useShell().refresh;
export const useRun = () => useShell().run;

// บัญชีของผู้ที่ล็อกอินใน role นั้น — เซิร์ฟเวอร์ส่งเฉพาะข้อมูลที่ role นี้มีสิทธิ์เห็น
export function useCustomer(): CustomerAccount {
  const { data, userId } = useShell();
  return data.customers.find((item) => item.id === userId)!;
}
export function useMechanic(): MechanicAccount {
  const { data, userId } = useShell();
  return data.mechanics.find((item) => item.id === userId)!;
}
export function useAdmin(): AdminAccount {
  const { data, userId } = useShell();
  return data.admins.find((item) => item.id === userId)!;
}

const pollMs = 5000;

export function RoleShell({ role, nav, children }: { role: Role; nav: NavItem[]; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  // ใช้เฉพาะผลของคำขอล่าสุด (โหลดซ้อนกันได้ เช่น ระหว่างอัปเดตอัตโนมัติกับหลังกดปุ่ม)
  const latestRequest = useRef(0);
  // รูปสนามหญ้าแนบตอนจองครั้งเดียวไม่เปลี่ยน → เก็บไว้ตามรหัสงาน ไม่ต้องโหลดซ้ำทุก 5 วินาที
  const photoCache = useRef(new Map<string, string[]>());

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const result = await loadSnapshot(role);
      if (requestId !== latestRequest.current) return;
      if (result.ok) {
        const withPhotos = (snapshot: Snapshot) => ({ ...snapshot, jobs: snapshot.jobs.map((job) => ({ ...job, photos: photoCache.current.get(job.id) ?? [] })) });
        // แสดงข้อมูลทันที แล้วค่อยเติมรูปของงานที่ยังไม่เคยโหลด
        setData(withPhotos(result.data));
        const missing = result.data.jobs.filter((job) => !photoCache.current.has(job.id)).map((job) => job.id);
        if (missing.length) {
          const photos = await loadJobPhotos(role, missing);
          if (photos) missing.forEach((id) => photoCache.current.set(id, photos[id] ?? []));
          if (photos && requestId === latestRequest.current) setData(withPhotos(result.data));
        }
        setLoadError('');
      } else if (result.auth) {
        // ไม่มีเซสชันของ role นี้ หรือบัญชีไม่อยู่ในฐานข้อมูล → กลับไปหน้าล็อกอินของ role นี้
        clearSession(role);
        router.replace(`/login/${role}?next=${encodeURIComponent(pathname)}`);
      } else {
        setLoadError(result.message);
      }
    } catch (error) {
      if (requestId === latestRequest.current) setLoadError((error as Error).message);
    }
  }, [role, router, pathname]);

  useEffect(() => {
    const id = getSessionUserId(role);
    if (!id) {
      router.replace(`/login/${role}?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setUserId(id);
  }, [role, router, pathname]);

  // โหลดข้อมูลจาก Supabase และอัปเดตทุก 5 วินาที (เห็นการเปลี่ยนแปลงจากผู้ใช้อื่น)
  // ข้ามรอบถ้ารอบก่อนยังโหลดไม่เสร็จ — กันคำขอซ้อนกันจนเครื่อง/เซิร์ฟเวอร์ช้าลงเรื่อย ๆ
  useEffect(() => {
    if (!userId) return;
    let polling = false;
    const poll = async () => {
      if (polling || document.visibilityState !== 'visible') return;
      polling = true;
      try { await refresh(); } finally { polling = false; }
    };
    poll();
    const timer = window.setInterval(poll, pollMs);
    return () => window.clearInterval(timer);
  }, [userId, refresh]);

  useEffect(() => { setMessage(null); }, [pathname]);
  // ข้อความลอยหายเองหลังสักครู่ (สำเร็จ 5 วิ · ผิดพลาด 10 วิ)
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), message.ok ? 5000 : 10000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const notice = useCallback((text: string, ok = true) => setMessage({ text, ok }), []);
  const run = useCallback(async <T extends Result>(action: Promise<T>) => {
    const result = await action;
    if (result.message) notice(result.message, result.ok);
    await refresh();
    return result;
  }, [notice, refresh]);

  const account = userId && data ? (role === 'customer' ? data.customers : role === 'mechanic' ? data.mechanics : data.admins).find((item) => item.id === userId) : undefined;

  if (!userId || !data || !account) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-500">
        {loadError ? <><p className="text-rose-700">โหลดข้อมูลไม่สำเร็จ: {loadError}</p><button type="button" onClick={refresh} className="rounded-full border border-slate-300 px-3 py-2 font-semibold text-slate-700">ลองใหม่</button></> : 'กำลังโหลดข้อมูล...'}
      </main>
    );
  }

  const unread = data.notifications.filter((item) => !item.read).length;
  const isActive = (href: string) => (href === nav[0].href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  function logout() {
    clearSession(role);
    router.replace('/');
  }

  return (
    <RoleShellContext.Provider value={{ userId, data, refresh, notice, run }}>
      <div className="min-h-screen bg-slate-50/60 pb-20 sm:pb-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Logo href={nav[0].href} />
              <span className="hidden rounded-full bg-brand-50 px-3 py-1 font-display text-xs font-semibold text-brand-700 sm:inline">{roleLabels[role]}</span>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden truncate text-sm font-medium text-slate-700 md:inline">{account.firstName} {account.lastName}</span>
              <button type="button" onClick={logout} className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 font-display text-sm font-medium text-slate-700 sm:px-4 hover:border-rose-300 hover:text-rose-700"><span className="fit-zoom">ออกจากระบบ</span></button>
            </div>
          </div>
          {/* แท็บเล็ต/คอมพิวเตอร์: เมนูใต้แถบหัว */}
          <nav aria-label={`เมนู${roleLabels[role]}`} className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:flex md:px-8">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-display text-sm font-medium transition-colors ${isActive(item.href) ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
                <span aria-hidden="true">{item.icon}</span>{item.label}
                {item.badge === 'notifications' && unread > 0 && <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] leading-none text-white">{unread}</span>}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 lg:py-10">
          {children}
        </main>

        {/* ข้อความผลการกดปุ่ม: ลอยเหนือเมนูล่าง เห็นได้ทุกตำแหน่งที่เลื่อนจออยู่ */}
        {message && (
          <div role={message.ok ? 'status' : 'alert'} className={`fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift sm:bottom-6 ${message.ok ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            <span>{message.text}</span>
            <button type="button" aria-label="ปิดข้อความ" onClick={() => setMessage(null)} className="shrink-0 font-bold">ปิด</button>
          </div>
        )}

        {/* มือถือ: เมนูด้านล่างจอ */}
        <nav aria-label={`เมนู${roleLabels[role]}`} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white sm:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={`relative flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${isActive(item.href) ? 'text-brand-700' : 'text-slate-500'}`}>
              <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.badge === 'notifications' && unread > 0 && <span className="absolute right-1/4 top-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] leading-none text-white">{unread}</span>}
            </Link>
          ))}
        </nav>
      </div>
    </RoleShellContext.Provider>
  );
}
