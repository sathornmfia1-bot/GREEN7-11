import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai, Prompt } from 'next/font/google';

// หัวข้อ: Prompt (โค้งมน อ่านง่าย) · เนื้อหา: IBM Plex Sans Thai
const display = Prompt({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-display', display: 'swap' });
const body = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'GREEN 7-Eleven · จ้างช่างตัดหญ้าออนไลน์',
  description: 'บริการตัดหญ้าและดูแลสวน รู้ราคาทันที จองได้ในไม่กี่คลิก ชำระผ่าน QR',
};

// วัดว่าระบบขยายตัวอักษรกี่เท่า (ตั้งค่าขนาดตัวอักษรของ Android / textZoom ของ WebView)
// แล้วตั้ง --display-scale ให้ส่วน .fit-zoom ขยายได้ไม่เกิน 1.15 เท่า
const fitTextScript = `(function(){
  function fit(){
    var root=document.documentElement, probe=document.createElement('div');
    probe.style.cssText='position:absolute;visibility:hidden;left:-9999px;font-size:100px;line-height:1;height:auto';
    probe.textContent='M';
    root.appendChild(probe);
    var factor=probe.getBoundingClientRect().height/100;
    root.removeChild(probe);
    var scale=factor>1.05?Math.min(factor,1.15)/factor:1;
    root.style.setProperty('--display-scale',String(scale));
  }
  window.__fitText=fit;
  fit();
  window.addEventListener('resize',fit);
  window.addEventListener('pageshow',fit);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fitTextScript }} />
      </head>
      <body className="overflow-x-clip font-sans antialiased">{children}</body>
    </html>
  );
}
