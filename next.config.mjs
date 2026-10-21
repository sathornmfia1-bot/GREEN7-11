/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ซ่อนป้าย "Rendering..." ของโหมดพัฒนา (ข้อผิดพลาดตอนคอมไพล์/รันยังแสดงตามปกติ)
  devIndicators: false,
  // อนุญาตให้มือถือในวง Wi-Fi เดียวกันเปิดหน้าเว็บขณะพัฒนา (npm run dev) ได้ — ไม่มีผลกับ production
  allowedDevOrigins: ['192.168.1.47', '192.168.*.*'],
  // เส้นทางเดิมก่อนแยกหน้าตาม role
  async redirects() {
    return [
      { source: '/register-customer', destination: '/register/customer', permanent: false },
      { source: '/register-worker', destination: '/register/mechanic', permanent: false },
      { source: '/worker-earnings', destination: '/mechanic/earnings', permanent: false },
      { source: '/mobile-preview', destination: '/admin/mobile-preview', permanent: false },
    ];
  },
};

export default nextConfig;
