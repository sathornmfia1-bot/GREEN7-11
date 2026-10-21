'use client';

import { useState } from 'react';

// หน้าจอที่ต้องการพรีวิว (เปิดหน้าจริงในกรอบขนาดมือถือ)
// หน้าของช่าง/ลูกค้าต้องล็อกอิน role นั้นในเบราว์เซอร์นี้ก่อน ไม่งั้นกรอบจะแสดงหน้าล็อกอินของ role นั้น
const screens = [
  { id: 'job-pool', label: 'ช่าง · งานใหม่', path: '/mechanic' },
  { id: 'my-jobs', label: 'ช่าง · งานของฉัน', path: '/mechanic/jobs' },
  { id: 'earnings', label: 'ช่าง · รายรับ', path: '/mechanic/earnings' },
  { id: 'customer-booking', label: 'ลูกค้า · จองบริการ', path: '/customer' },
  { id: 'customer-bookings', label: 'ลูกค้า · การจองของฉัน', path: '/customer/bookings' },
  { id: 'register', label: 'สมัครเป็นช่าง', path: '/register/mechanic' },
];

const devices = [
  { id: 'iphone', label: 'iPhone 15', width: 393, height: 852 },
  { id: 'android', label: 'Android', width: 360, height: 800 },
  { id: 'small', label: 'จอเล็ก', width: 320, height: 640 },
];

export default function MobilePreview() {
  const [screenId, setScreenId] = useState(screens[0].id);
  const [deviceId, setDeviceId] = useState(devices[0].id);
  const [reloadKey, setReloadKey] = useState(0);
  const screen = screens.find((item) => item.id === screenId) ?? screens[0];
  const device = devices.find((item) => item.id === deviceId) ?? devices[0];

  return (
    <div>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <section className="lg:w-72 lg:shrink-0" aria-label="ตัวเลือกพรีวิว">
          <h1 className="text-2xl font-bold text-slate-900">พรีวิวหน้าจอมือถือ</h1>
          <p className="mt-2 text-sm text-slate-600">ดูหน้าจอฝั่งช่างในขนาดมือถือ กดใช้งานในกรอบได้เหมือนจริง</p>

          <p className="mt-6 text-sm font-semibold text-slate-800">หน้าจอ</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {screens.map((item) => (
              <button key={item.id} type="button" aria-pressed={screenId === item.id} onClick={() => { setScreenId(item.id); setReloadKey((key) => key + 1); }} className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${screenId === item.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>{item.label}</button>
            ))}
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-800">ขนาดจอ</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {devices.map((item) => (
              <button key={item.id} type="button" aria-pressed={deviceId === item.id} onClick={() => setDeviceId(item.id)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${deviceId === item.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>{item.label}<span className="ml-1 text-xs opacity-70">{item.width}px</span></button>
            ))}
          </div>

          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-6 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-500">↻ โหลดหน้าจอใหม่</button>
          <p className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">ต้องการดูบนมือถือจริง: ต่อ Wi-Fi เดียวกับคอมพิวเตอร์ แล้วเปิด <span className="font-mono font-semibold text-slate-800">http://192.168.1.47:3000</span></p>
        </section>

        <section className="flex flex-1 justify-center overflow-x-auto" aria-label={`พรีวิว ${screen.label} บน ${device.label}`}>
          <div className="rounded-[3rem] bg-slate-900 p-3 shadow-2xl ring-1 ring-slate-700">
            <div className="relative overflow-hidden rounded-[2.4rem] bg-white" style={{ width: device.width, height: device.height }}>
              <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-2 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
              <iframe key={`${screen.path}-${reloadKey}`} src={screen.path} title={`หน้าจอ ${screen.label}`} className="h-full w-full border-0 pt-9" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
