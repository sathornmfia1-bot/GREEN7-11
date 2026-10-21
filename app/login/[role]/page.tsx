import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isRole, roleLabels } from '../../_lib/session';
import LoginForm from '../_components/login-form';

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role } = await params;
  return { title: isRole(role) ? `เข้าสู่ระบบ${roleLabels[role]} | GREEN 7-Eleven` : 'เข้าสู่ระบบ | GREEN 7-Eleven' };
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<{ next?: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  const { next } = await searchParams;
  return <LoginForm role={role} next={next ?? null} />;
}
