import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ตรวจสิทธิ์ตาม role ก่อนเปิดหน้า: /customer → ลูกค้า, /mechanic → ช่าง, /admin → แอดมิน
// ไม่มีเซสชันของ role นั้น → ส่งไปหน้าล็อกอินของ role นั้น (เซสชันของ role อื่นใช้แทนไม่ได้)
const areas = [
  { prefix: '/customer', role: 'customer' },
  { prefix: '/mechanic', role: 'mechanic' },
  { prefix: '/admin', role: 'admin' },
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = areas.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!area) return NextResponse.next();

  if (request.cookies.get(`lawnflow_session_${area.role}`)?.value) return NextResponse.next();

  const loginUrl = new URL(`/login/${area.role}`, request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/customer/:path*', '/mechanic/:path*', '/admin/:path*'],
};
