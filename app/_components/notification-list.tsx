'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { markNotificationsRead } from '../_server/actions';
import { formatLocalDateTime } from '../_lib/rules';
import type { Role } from '../_lib/session';
import type { AppNotification } from '../_lib/types';
import { useData, useRefresh } from './role-shell';

const styles: Record<AppNotification['kind'], string> = {
  arrived: 'bg-sky-50',
  started: 'bg-emerald-50',
  completed: 'bg-amber-50',
  info: 'bg-slate-50',
};

// แจ้งเตือนของผู้ใช้คนนี้เท่านั้น (แยกตาม id ของลูกค้า/ช่าง) · เปิดหน้าแล้วถือว่าอ่านแล้ว
export function NotificationList({ role, jobsHref }: { role: Role; jobsHref: string }) {
  const db = useData();
  const refresh = useRefresh();
  const items = db.notifications;
  const unread = items.filter((item) => !item.read).length;

  useEffect(() => {
    if (unread > 0) markNotificationsRead(role).then(() => refresh());
  }, [role, unread, refresh]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">แจ้งเตือน</h1>
      {items.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item) => {
            const job = item.jobId ? db.jobs.find((candidate) => candidate.id === item.jobId) : undefined;
            return (
              <li key={item.id} className={`rounded-xl p-4 ${styles[item.kind]} ${item.read ? '' : 'ring-1 ring-brand-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-medium text-slate-900">{item.message}</span>
                    {job && <span className="mt-0.5 block text-xs text-slate-500">{job.title} · {job.service}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{formatLocalDateTime(item.createdAt)}</span>
                </div>
                {job && <Link href={jobsHref} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">{item.kind === 'completed' ? '⭐ ไปรีวิวช่าง →' : 'ดูงาน →'}</Link>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card mt-4 p-6 text-center text-sm text-slate-600">ยังไม่มีแจ้งเตือน</p>
      )}
    </div>
  );
}
