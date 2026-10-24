import type { Equipment } from '../_lib/equipment';

// ภาพประกอบเครื่องมือของช่าง (SVG วาดเอง สีตามแบรนด์) · ขนาด 64×64
const ink = '#1f2937';
const metal = '#9ca3af';
const steel = '#d1d5db';
const green = '#0ab463';
const darkGreen = '#07804a';
const orange = '#fd9802';
const red = '#ea1029';

// ด้ามยาว + มือจับ + ใบมีดวงกลม (ใช้ร่วมกันในเครื่องตัดหญ้าสะพายบ่า)
function BrushCutterBody() {
  return (
    <>
      {/* ใบมีดและฝาครอบ */}
      <circle cx="13" cy="51" r="8.5" fill={steel} stroke={ink} strokeWidth="1.5" />
      <path d="M13 42.5v17M4.5 51h17M7 45l12 12M19 45L7 57" stroke={metal} strokeWidth="1.2" />
      <circle cx="13" cy="51" r="2" fill={ink} />
      <path d="M6 44.5a9.5 9.5 0 0 1 14 0" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      {/* ด้าม */}
      <path d="M15 48 49 14" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      {/* มือจับแบบแฮนด์ */}
      <path d="M26 30 33 39M33 23l7 9" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 32h6M38 25h6" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
    </>
  );
}

function StrokeBadge({ text, color }: { text: string; color: string }) {
  return (
    <g>
      <rect x="2" y="3" width="22" height="14" rx="4" fill={color} />
      <text x="13" y="13.5" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#fff">{text}</text>
    </g>
  );
}

const art: Record<Equipment, React.ReactNode> = {
  brush_cutter_2t: (
    <>
      <BrushCutterBody />
      {/* เครื่องยนต์ 2 จังหวะ: ตัวเครื่องสีส้ม ถังน้ำมันผสม */}
      <rect x="44" y="5" width="16" height="13" rx="3.5" fill={orange} stroke={ink} strokeWidth="1.5" transform="rotate(-45 52 11.5)" />
      <circle cx="53" cy="11" r="2.4" fill="#fff" stroke={ink} strokeWidth="1.2" />
      <StrokeBadge text="2T" color={orange} />
    </>
  ),
  brush_cutter_4t: (
    <>
      <BrushCutterBody />
      {/* เครื่องยนต์ 4 จังหวะ: ตัวเครื่องใหญ่กว่า สีแดง มีครีบระบายความร้อน */}
      <rect x="42" y="3" width="19" height="15" rx="3.5" fill={red} stroke={ink} strokeWidth="1.5" transform="rotate(-45 51.5 10.5)" />
      <path d="M47 9.5l6 6M50 6.5l6 6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <StrokeBadge text="4T" color={red} />
    </>
  ),
  battery_cutter: (
    <>
      <BrushCutterBody />
      {/* แบตเตอรี่สีเขียวพร้อมสัญลักษณ์สายฟ้า */}
      <rect x="43" y="4" width="17" height="12" rx="2.5" fill={green} stroke={ink} strokeWidth="1.5" transform="rotate(-45 51.5 10)" />
      <path d="M53 5.5l-4.5 5.5h3.5l-2.5 5 5-6h-3.5z" fill="#fff" />
      <rect x="2" y="3" width="22" height="14" rx="4" fill={green} />
      <path d="M14.5 5.5 9.5 11h3.5l-1.5 4.5 5-6h-3.5z" fill="#fff" />
    </>
  ),
  riding_mower: (
    <>
      {/* หญ้า */}
      <path d="M2 58h60" stroke={darkGreen} strokeWidth="2" strokeLinecap="round" />
      {/* ตัวรถ */}
      <path d="M8 46c0-5 3-8 8-8h18l6-8h10c4 0 6 3 6 6v10z" fill={green} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="14" y="46" width="34" height="5" rx="1.5" fill={metal} stroke={ink} strokeWidth="1.2" />
      {/* เบาะและพวงมาลัย */}
      <path d="M20 38v-9c0-2 1-3 3-3h4v12" fill={ink} />
      <path d="M38 30 34 20" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M30 19h8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      {/* ล้อ */}
      <circle cx="15" cy="51" r="7" fill={ink} />
      <circle cx="15" cy="51" r="2.6" fill={steel} />
      <circle cx="51" cy="53" r="5" fill={ink} />
      <circle cx="51" cy="53" r="1.8" fill={steel} />
    </>
  ),
  leaf_blower: (
    <>
      {/* ใบไม้ที่ถูกเป่าปลิว */}
      <path d="M3 22c3-4 8-4 10 0-3 3-7 3-10 0z" fill={orange} />
      <path d="M5 38c2-4 7-4 9-1-2 3-6 4-9 1z" fill={green} />
      <path d="M8 50c2-3 6-3 8 0-2 2-6 2-8 0z" fill={darkGreen} />
      {/* ลมที่เป่าออกจากปลายท่อ */}
      <path d="M17 26c-2 0-4 0-6 1M16 32h-5M17 38c-2 0-4 1-6 2" stroke={metal} strokeWidth="1.6" strokeLinecap="round" />
      {/* ท่อเป่ายาว เรียวไปทางปลาย */}
      <path d="M38 30 19 31.5v4L38 38z" fill={steel} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      {/* ตัวเครื่อง (มอเตอร์/ใบพัด) */}
      <path d="M37 25c0-3 2-5 5-5h13c3 0 6 3 6 7v8c0 4-3 7-7 7H42c-3 0-5-2-5-5z" fill={green} stroke={ink} strokeWidth="1.5" />
      <circle cx="51" cy="31" r="6" fill="#fff" stroke={ink} strokeWidth="1.3" />
      <path d="M51 26v10M46 31h10M47.5 27.5l7 7M54.5 27.5l-7 7" stroke={metal} strokeWidth="1.1" />
      {/* มือจับด้านล่าง */}
      <path d="M44 42v8c0 2 1.5 3 3.5 3h3c2 0 3.5-1 3.5-3v-8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47 45h4" stroke={darkGreen} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

export function EquipmentArt({ type, className = 'h-12 w-12' }: { type: Equipment; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {art[type]}
    </svg>
  );
}
