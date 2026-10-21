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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable}`}>
      <body className="overflow-x-clip font-sans antialiased">{children}</body>
    </html>
  );
}
