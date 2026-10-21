// ปุ่มติดต่อทาง LINE: กดแล้วเปิดแอป LINE เพื่อเพิ่มเพื่อน/แชตกับ LINE ID ของร้าน
export const lineId = 'mafiathorn';
// ลิงก์เพิ่มเพื่อนที่ร้านสร้างจาก LINE (lin.ee)
export const lineUrl = 'https://lin.ee/v1vz9B7';

export function LineIcon({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#06c755" />
      <path d="M20 8.5c-7.5 0-13.5 4.9-13.5 10.9 0 5.4 4.8 9.9 11.2 10.8.4.1 1 .3 1.2.6.1.3.1.8 0 1.1l-.2 1.1c-.1.3-.3 1.3 1.1.7 1.4-.6 7.8-4.6 10.6-7.9 2-2.1 2.9-4.2 2.9-6.4 0-6-6-10.9-13.3-10.9z" fill="#fff" />
      <g fill="#06c755">
        <path d="M11.6 16.2h1.3v5.2h2.9v1.2h-4.2z" />
        <path d="M16.9 16.2h1.3v6.4h-1.3z" />
        <path d="M19.7 16.2h1.2l2.9 4.1v-4.1H25v6.4h-1.2l-2.9-4v4h-1.2z" />
        <path d="M26.5 16.2h4.1v1.2h-2.8v1.4h2.7V20h-2.7v1.4h2.8v1.2h-4.1z" />
      </g>
    </svg>
  );
}

export function LineContactButton({ className = '' }: { className?: string }) {
  return (
    <a href={lineUrl} target="_blank" rel="noopener noreferrer" aria-label={`ติดต่อทาง LINE (ID: ${lineId})`} title={`LINE ID: ${lineId}`} className={`inline-flex shrink-0 rounded-[10px] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${className}`}>
      <LineIcon />
    </a>
  );
}
