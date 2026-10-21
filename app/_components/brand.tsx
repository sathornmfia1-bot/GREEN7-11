import Link from 'next/link';

// โทนสีชื่อแบรนด์ (ตามภาพอ้างอิงที่ลูกค้าส่งมา)
const brandGreen = '#167455';
const brandOrange = '#ff6e00';
const brandRed = '#ea1029';

// ชื่อแบรนด์ GREEN 7-Eleven บนพื้นขาว: ตัวอักษรเขียว (GREEN พิมพ์ใหญ่, Eleven พิมพ์ปกติ), เลข 7 ครึ่งบนส้ม ครึ่งล่างแดง, ขีดสีแดง
// framed = ใส่กรอบพื้นขาว ใช้เมื่อวางบนพื้นสีเข้ม (เช่น footer)
export function BrandName({ framed = false, className = '' }: { framed?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline whitespace-nowrap font-display font-extrabold leading-none tracking-tight ${framed ? 'rounded-xl bg-white px-3 py-2 shadow-soft' : ''} ${className}`}
      style={{ color: brandGreen }}
    >
      GREEN
      <span
        className="ml-[0.28em] bg-clip-text text-transparent"
        style={{ backgroundImage: `linear-gradient(180deg, ${brandOrange} 0 46%, ${brandRed} 46% 100%)` }}
      >
        7
      </span>
      <span style={{ color: brandRed }}>-</span>
      <span>Eleven</span>
    </span>
  );
}

// สัญลักษณ์แบรนด์: ใบไม้สีขาวบนสี่เหลี่ยมมุมมนสีเขียว (ไฟล์เดียวกับ favicon: app/icon.svg)
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-mark-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2fc077" />
          <stop offset="1" stopColor="#13965a" />
        </linearGradient>
        <mask id="logo-mark-leaf">
          <path fill="#fff" d="M18.5 46.5C15.6 31.4 25.8 17.6 49.5 14.5c1.4 22.8-10.6 34.6-29.2 33.4z" />
          <path fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="round" d="M20 45.2C26.5 36 33.5 28.4 43 21" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-mark-bg)" />
      <rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#fff" strokeOpacity=".14" />
      <rect width="64" height="64" fill="#fff" mask="url(#logo-mark-leaf)" />
      <path fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" d="M20 45.2 15 50.8" />
    </svg>
  );
}

// โลโก้: สัญลักษณ์ใบไม้ + ชื่อแบรนด์
export function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'md' | 'lg' }) {
  // มือถือ: ขนาดตัวอักษรแปรผันตามความกว้างจอ ให้โลโก้กับปุ่มด้านขวาพอดีเสมอ
  const text = size === 'lg' ? 'text-3xl' : 'text-[clamp(1rem,5vw,1.25rem)] sm:text-2xl';
  const mark = size === 'lg' ? 'h-10 w-10' : 'h-[clamp(1.6rem,7.5vw,2rem)] w-[clamp(1.6rem,7.5vw,2rem)] sm:h-9 sm:w-9';
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-2" aria-label="GREEN 7-Eleven หน้าแรก">
      <LogoMark className={`shrink-0 ${mark}`} />
      <BrandName className={`fit-zoom ${text}`} />
    </Link>
  );
}
