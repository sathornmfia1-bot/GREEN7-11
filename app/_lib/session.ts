// เซสชันจำลอง (mock) แยกตาม role — เก็บใน cookie เพื่อให้ proxy.ts ตรวจสิทธิ์ก่อนเปิดหน้าได้
// แต่ละ role มี cookie ของตัวเอง จึงทดสอบลูกค้าและช่างคนละแท็บพร้อมกันได้ โดยหน้าของแต่ละ role ใช้เฉพาะเซสชันของ role นั้น

export type Role = 'customer' | 'mechanic' | 'admin';

export const roles: Role[] = ['customer', 'mechanic', 'admin'];

export const roleLabels: Record<Role, string> = {
  customer: 'ลูกค้า',
  mechanic: 'ช่างตัดหญ้า',
  admin: 'แอดมิน',
};

export const roleHome: Record<Role, string> = {
  customer: '/customer',
  mechanic: '/mechanic',
  admin: '/admin',
};

export function isRole(value: string): value is Role {
  return (roles as string[]).includes(value);
}

export function sessionCookieName(role: Role) {
  return `lawnflow_session_${role}`;
}

export function getSessionUserId(role: Role): string | null {
  if (typeof document === 'undefined') return null;
  const name = `${sessionCookieName(role)}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(name));
  return found ? decodeURIComponent(found.slice(name.length)) : null;
}

export function setSession(role: Role, userId: string) {
  document.cookie = `${sessionCookieName(role)}=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function clearSession(role: Role) {
  document.cookie = `${sessionCookieName(role)}=; path=/; max-age=0; samesite=lax`;
}

// ปลายทางหลังล็อกอินต้องอยู่ในพื้นที่ของ role นั้นเท่านั้น
export function safeNextPath(role: Role, next?: string | null) {
  const home = roleHome[role];
  return next && (next === home || next.startsWith(`${home}/`)) ? next : home;
}
