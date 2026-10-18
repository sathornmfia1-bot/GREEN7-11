/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // อนุญาตให้มือถือในวง Wi-Fi เดียวกันเปิดหน้าเว็บขณะพัฒนา (npm run dev) ได้ — ไม่มีผลกับ production
  allowedDevOrigins: ['192.168.1.47', '192.168.*.*'],
};

export default nextConfig;
