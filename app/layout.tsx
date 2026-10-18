import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lawn Service Marketplace',
  description: 'Customer and mechanic platform for lawn care booking and service tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
