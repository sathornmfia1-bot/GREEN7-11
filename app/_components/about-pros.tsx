import Link from 'next/link';
import { platformFeePercent } from './pricing';
import { escrowReleaseDays } from '../_lib/rules';

// ไอคอนเส้นสีขาว (24×24) สำหรับรายการการันตี
const icons = {
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h4M14.5 13.5h3" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6Z" /><path d="m8.8 12 2.2 2.2 4.3-4.4" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M16 13.5h1.5" /></>,
};

// การันตีที่ระบบทำจริงทุกข้อ (ไม่ใช่ตัวเลขสถิติหรือคำรับรองที่ยังไม่มีข้อมูลจริง)
const guarantees: { icon: keyof typeof icons; text: string }[] = [
  { icon: 'id', text: 'ยืนยันเบอร์โทร บัตรประชาชน และบัญชีธนาคาร' },
  { icon: 'shield', text: 'แอดมินตรวจสอบช่างทุกคนก่อนเปิดให้รับงาน' },
  { icon: 'star', text: 'ลูกค้าประเมินทุกงาน: ความสะอาด · ตรงเวลา · มารยาท' },
  { icon: 'wallet', text: 'เงินพักใน Escrow จนคุณพอใจกับงาน' },
];

const mechanicPerks = [
  'รับงานในรัศมีที่เลือกเอง ใกล้บ้าน ไม่ต้องหาลูกค้า',
  `ได้รับ ${100 - platformFeePercent}% ของค่างาน (ค่าบริการแพลตฟอร์ม ${platformFeePercent}%)`,
  `โอนเงินออกได้เมื่อลูกค้ารีวิว หรือครบ ${escrowReleaseDays} วันหลังงานเสร็จ`,
];

export function AboutPros() {
  return (
    <section aria-labelledby="about-pros" className="bg-brand-500 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <h2 id="about-pros" className="font-display text-3xl font-medium">เกี่ยวกับช่างของเรา</h2>
        <p className="mt-4 max-w-4xl leading-relaxed text-brand-50">
          เราคัดช่างตัดหญ้าในพื้นที่ที่ผ่านการตรวจสอบ เพื่อให้คุณได้บริการที่ไว้ใจได้ และช่วยให้ช่างท้องถิ่นมีงานต่อเนื่อง
          ทุกงานมีรีวิวจากลูกค้าจริง ช่างที่ทำงานดีจะได้คะแนนสูงและเป็นที่เลือกของลูกค้ามากขึ้น
        </p>

        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
          <div>
            <h3 className="font-display text-2xl font-medium">การันตีจากเรา</h3>
            <ul className="mt-4 space-y-3">
              {guarantees.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[item.icon]}</svg>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <Link href="/register/mechanic" className="mt-8 inline-flex items-center gap-1 rounded-xl bg-amber-300 px-5 py-3 font-display text-sm font-bold text-slate-900 shadow-soft transition-colors hover:bg-amber-200">
              สมัครเป็นช่างกับเรา <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="md:border-l md:border-white/25 md:pl-12">
            <p aria-hidden="true" className="font-display text-6xl font-bold leading-none">“</p>
            <p className="mt-1 font-display text-2xl leading-snug md:text-[1.7rem]">
              เป็นช่างตัดหญ้าอิสระ รับงานใกล้บ้าน เลือกวันทำงานได้เอง และได้เงินแน่นอนทุกงาน
            </p>
            <ul className="mt-6 space-y-2 text-sm text-brand-50">
              {mechanicPerks.map((perk) => (
                <li key={perk} className="flex gap-2"><span aria-hidden="true" className="font-bold text-amber-300">✓</span>{perk}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
