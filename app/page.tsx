import Image from 'next/image';
import Link from 'next/link';
import { AboutPros } from './_components/about-pros';
import { BrandName, Logo } from './_components/brand';
import { FeatureArt } from './_components/feature-art';
import { HeroScene } from './_components/hero-scene';
import { LineContactButton } from './_components/line-contact';
import { Accordion } from './_components/mobile';
import { PriceEstimator } from './_components/price-estimator';
import { baseAreaWa, monthlyPackages, pricingOptions } from './_components/pricing';
import { RecentBooking } from './_components/recent-booking';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

const steps = [
  { title: 'ใส่ข้อมูลสนาม → เห็นราคาทันที', body: 'เลือกบริการ ขนาดพื้นที่ และความสูงหญ้า ระบบคำนวณราคาให้ในไม่กี่วินาที', link: { href: '#estimate', label: 'ลองคำนวณราคา' } },
  { title: 'เลือกวันที่สะดวก', body: 'ชำระผ่าน QR แล้วงานเข้าสู่ Job Pool ให้ช่างในพื้นที่กดรับงาน' },
  { title: 'ช่างมาทำงาน คุณแค่รีวิว', body: 'ติดตามสถานะแบบเรียลไทม์ ได้รับแจ้งเตือนเมื่อช่างถึง เริ่มงาน และทำงานเสร็จ' },
];

const features = [
  { art: 'phone', title: 'ยืดหยุ่น จัดการได้ในแอป', body: 'ยกเลิกได้ก่อนวันนัด 2 วัน รับเงินคืนเต็มจำนวน เพิ่มที่อยู่บริการได้หลายแห่ง' },
  { art: 'grass', title: 'พอใจก่อน ช่างได้เงิน', body: 'เงินพักใน Escrow จนคุณรีวิวงาน หรือครบ 2 วันหลังทำงานเสร็จ' },
  { art: 'mower', title: 'ช่างผ่านการตรวจสอบ', body: 'ยืนยันเบอร์โทร บัตรประชาชน และบัญชีธนาคาร ก่อนแอดมินอนุมัติให้รับงาน' },
  { art: 'crew', title: 'ดูแลสวนครบในที่เดียว', body: 'ตัดหญ้า แต่งกิ่ง ขนทิ้ง และแพ็กเกจรายเดือน ราคาโปร่งใสตามตารางราคา' },
] as const;

// การันตีที่ระบบทำจริง (ไม่ใช่รีวิวหรือคะแนน) · รูปประกอบจาก public/features
// escrow-thai-banknotes-box.jpg จาก Pixabay (Pixabay Content License) และ price-agreement.jpg จาก Unsplash (Unsplash License) — ใช้ได้ฟรีเชิงพาณิชย์
// รูปธนบัตรไทยมีพระบรมฉายาลักษณ์: จัดตำแหน่งให้เห็นธนบัตรทั้งใบ ไม่ตัดผ่านพระบรมฉายาลักษณ์
const assurances = [
  { title: 'ช่างผ่านการตรวจสอบตัวตน', body: 'ยืนยันเบอร์โทร บัตรประชาชน และบัญชีธนาคาร', image: '/features/happy-lawn.jpg', alt: 'สนามหญ้าหน้าบ้านสีเขียวที่ตัดแต่งเรียบร้อย', position: 'object-[50%_15%]' },
  { title: 'เงินพักใน Escrow จนคุณพอใจ', body: 'โอนให้ช่างเมื่อรีวิว หรือครบ 2 วันหลังงานเสร็จ', image: '/features/escrow-thai-banknotes-box.jpg', alt: 'ธนบัตรไทยใบ 100 บาทและ 500 บาทวางอยู่ในหีบไม้', position: 'object-[50%_100%]' },
  { title: 'ราคาตามตาราง', body: 'ปรับราคาหน้างานได้เมื่อคุณกดยืนยันเท่านั้น', image: '/features/price-agreement.jpg', alt: 'สองฝ่ายจับมือตกลงกันเหนือเอกสารใบราคา', position: 'object-[50%_45%]' },
];

// การ์ดการันตี: รูปด้านบน + หัวข้อ + คำอธิบาย (คอม 3 คอลัมน์ · มือถือใช้ในแถบเลื่อนซ้าย-ขวา)
function AssuranceCard({ item, compact = false }: { item: (typeof assurances)[number]; compact?: boolean }) {
  return (
    <article className="h-full overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
      <div className={`relative ${compact ? 'aspect-[16/10]' : 'aspect-[16/9]'}`}>
        <Image src={item.image} alt={item.alt} fill sizes={compact ? '60vw' : '(min-width: 640px) 300px, 100vw'} className={`object-cover ${item.position}`} />
      </div>
      <div className={compact ? 'p-3' : 'p-4'}>
        {/* เครื่องหมายถูกอยู่หน้าหัวข้อ ไม่วางทับบนรูป (รูปธนบัตรมีพระบรมฉายาลักษณ์) */}
        <h3 className={`flex items-start gap-2 font-semibold leading-snug text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}>
          <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white ${compact ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-xs'}`}>✓</span>
          {item.title}
        </h3>
        <p className={`mt-1 text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>{item.body}</p>
      </div>
    </article>
  );
}

function AssuranceList({ className }: { className: string }) {
  return (
    <ul className={`max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3 ${className}`}>
      {assurances.map((item) => <li key={item.title}><AssuranceCard item={item} /></li>)}
    </ul>
  );
}

const roles = [
  { role: 'customer', icon: '🏡', title: 'ลูกค้า', body: 'จองช่างตัดหญ้า ชำระผ่าน QR และติดตามงาน', register: { href: '/register/customer', label: 'ลงทะเบียนลูกค้า' } },
  { role: 'mechanic', icon: '👷', title: 'ช่างตัดหญ้า', body: 'รับงานใกล้บ้าน ตรวจงาน และโอนเงินรายรับ', register: { href: '/register/mechanic', label: 'สมัครเป็นช่าง' } },
  { role: 'admin', icon: '🛡️', title: 'แอดมิน', body: 'ตรวจสอบช่าง ดูคลังงาน และรายงานรายรับ' },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-white max-sm:bg-slate-50 max-sm:pb-40">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-4 max-sm:border-b max-sm:border-slate-200 max-sm:bg-white max-sm:py-2 md:px-8">
        <Logo />
        <nav className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {/* มือถือ: เข้าสู่ระบบย้ายไปอยู่ในแถบปุ่มด้านล่าง */}
          <a href="#login" className="btn-outline whitespace-nowrap px-3 py-1.5 text-xs max-sm:hidden sm:px-4 sm:text-sm"><span className="fit-zoom">เข้าสู่ระบบ</span></a>
          {/* ปุ่ม LINE มุมขวาบนสุด ให้ลูกค้ากดติดต่อได้ทันที (ทุกขนาดจอ) */}
          <LineContactButton />
        </nav>
      </header>

      {/* Hero */}
      <section id="estimate" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-2 pt-6 max-sm:pt-5 sm:pb-6 md:px-8 md:pt-12">
        <h1 className="fit-zoom max-w-2xl font-display text-[2.4rem] font-medium leading-[1.2] text-brand-500 max-sm:text-[1.75rem] max-sm:font-semibold max-sm:text-brand-700 md:text-5xl md:leading-[1.2]">บริการตัดหญ้าราคาเข้าถึงง่าย จองได้ในไม่กี่คลิก</h1>
        <p className="fit-zoom mt-4 font-display text-lg leading-normal text-brand-500 max-sm:mt-2 max-sm:font-sans max-sm:text-[15px] max-sm:text-slate-600 md:text-xl md:leading-normal"><span className="max-sm:hidden">รู้ราคาทันที · จองออนไลน์ · ช่างผ่านการตรวจสอบ</span><span className="sm:hidden">รู้ราคาทันที · ช่างผ่านการตรวจสอบ</span></p>
        <div className="mt-8 max-sm:mt-4">
          <PriceEstimator />
        </div>
        <AssuranceList className="mt-10 hidden sm:grid" />
      </section>

      {/* มือถือ: การันตีเป็นการ์ดเลื่อนซ้าย-ขวา แล้วตามด้วยหัวข้อยุบ/ขยาย แทนส่วนยาวๆ ของคอม */}
      <section aria-label="การันตี" className="sm:hidden">
        <ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-4 [scrollbar-width:none]">
          {assurances.map((item) => (
            <li key={item.title} className="w-[62%] min-w-[200px] shrink-0 snap-start">
              <AssuranceCard item={item} compact />
            </li>
          ))}
        </ul>
        <p className="px-4 text-xs text-slate-500">ปัดเพื่อดูเพิ่ม →</p>
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-white shadow-soft">
          <Accordion title="ใช้งานอย่างไร">
            <ol className="space-y-3 text-sm text-slate-600">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">{index + 1}</span>
                  <span><span className="block font-semibold text-slate-900">{step.title}</span>{step.body}</span>
                </li>
              ))}
            </ol>
          </Accordion>
          <Accordion title="ราคาบริการทั้งหมด">
            <ul className="divide-y divide-slate-100 text-sm">
              {pricingOptions.map((option) => (
                <li key={option.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-slate-800">{option.name}</span>
                  <span className="shrink-0 font-semibold text-brand-700">฿{money(option.basePrice)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">ราคาสำหรับพื้นที่ไม่เกิน {baseAreaWa} ตารางวา · แพ็กเกจรายเดือนเลือกได้ 1–4 ครั้งต่อเดือน</p>
          </Accordion>
          <Accordion title="เกี่ยวกับช่างของเรา">
            <ul className="space-y-2 text-sm text-slate-600">
              {assurances.map((item) => <li key={item.title}><span className="font-semibold text-slate-900">{item.title}</span> · {item.body}</li>)}
            </ul>
            <Link href="/register/mechanic" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 underline">สมัครเป็นช่างกับเรา →</Link>
          </Accordion>
        </div>
      </section>

      {/* ภาพประกอบ + แถบเขียว */}
      <section aria-label="พื้นที่ให้บริการ" className="relative max-sm:hidden">
        <HeroScene />
        <div className="absolute bottom-24 left-3 hidden sm:block md:left-8">
          <RecentBooking />
        </div>
        <div className="bg-brand-500">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-8 pt-3 text-white md:flex-row md:items-center md:gap-8 md:px-8">
            <p className="shrink-0 font-display text-base font-medium">บริการของเรา...</p>
            <ul className="flex flex-wrap items-center gap-x-7 gap-y-2 font-display text-lg font-bold tracking-tight md:text-xl">
              {['ตัดหญ้า', 'แต่งกิ่ง', 'ขนทิ้ง', 'ใส่ปุ๋ย', 'แพ็กเกจรายเดือน'].map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
        {/* มือถือ: ภาพต่อจากฟอร์มราคาทันที (แบบ LawnStarter) แล้วค่อยแสดงการันตีใต้แถบเขียว */}
        <div className="space-y-6 px-4 pt-6 sm:hidden">
          <AssuranceList className="grid" />
          <RecentBooking />
        </div>
      </section>

      {/* ใช้งานอย่างไร (มือถือ: อยู่ในหัวข้อยุบ/ขยายด้านบน) */}
      <section className="mx-auto max-w-6xl px-4 py-16 max-sm:hidden md:px-8">
        <h2 className="text-center font-display text-3xl font-semibold text-slate-900">ใช้งานอย่างไร</h2>
        <p className="mt-3 text-center text-slate-600">จองเสร็จในไม่ถึง 2 นาที ทำได้ทั้งหมดออนไลน์</p>
        <ol className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="card p-6">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 font-display font-semibold text-white">{index + 1}</span>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.body}</p>
              {'link' in step && step.link && <a href={step.link.href} className="mt-3 inline-block text-sm font-semibold text-brand-600 underline">{step.link.label}</a>}
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="/login/customer?next=/customer" className="btn-cta w-full max-w-md py-3.5">ดูราคาของฉัน</Link>
        </div>
      </section>

      {/* จุดเด่น */}
      <section className="mx-auto max-w-6xl px-4 pb-16 max-sm:hidden md:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="card overflow-hidden">
              <FeatureArt variant={feature.art} />
              <div className="p-5">
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-soft sm:flex-row sm:items-center">
          <svg viewBox="0 0 84 90" className="h-20 w-20 shrink-0" aria-hidden="true">
            <path d="M42 4 L76 15 V44 C76 65 59 79 42 86 C25 79 8 65 8 44 V15 Z" fill="#fff" stroke="#0ab463" strokeWidth="6" />
            <path d="M42 17 L65 25 V44 C65 59 55 69 42 74 C29 69 19 59 19 44 V25 Z" fill="#0ab463" />
            <text x="42" y="42" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="13" fill="#fff">พอใจ</text>
            <text x="42" y="58" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="11" fill="#d3f5e2">ก่อนจ่าย</text>
          </svg>
          <p className="text-slate-700">เงินที่คุณชำระจะ<span className="font-semibold">พักไว้ในระบบ (Escrow)</span> และโอนให้ช่างเมื่อคุณรีวิวงาน หรือครบ 2 วันหลังทำงานเสร็จ หากหน้างานจริงต่างจากที่แจ้ง ช่างต้องส่งคำขอปรับราคาให้คุณยืนยันก่อนทุกครั้ง</p>
        </div>
      </section>

      <div className="max-sm:hidden">
        <AboutPros />
      </div>

      {/* บริการและราคา */}
      <section className="bg-slate-50 py-16 max-sm:hidden">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="text-center font-display text-3xl font-semibold text-slate-900">บริการของเรา</h2>
          <p className="mt-3 text-center text-slate-600">ราคาเริ่มต้นสำหรับพื้นที่ไม่เกิน {baseAreaWa} ตารางวา</p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pricingOptions.map((option) => (
              <article key={option.name} className="card flex items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold text-slate-900">{option.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">เกิน {baseAreaWa} ตารางวา คิดเพิ่มตารางวาละ ฿{option.extraPerWa}</p>
                </div>
                <p className="shrink-0 text-right"><span className="block text-xs text-slate-500">เริ่มต้น</span><span className="font-display text-2xl font-semibold text-brand-600">฿{money(option.basePrice)}</span></p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">แพ็กเกจรายเดือน 1–4 ครั้งต่อเดือน · {monthlyPackages.map((pack) => `${pack.name} ฿${money(pack.basePrice)}/ครั้ง`).join(' · ')}</p>
        </div>
      </section>

      {/* เข้าสู่ระบบแยกตาม role */}
      <section id="login" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-16 max-sm:hidden md:px-8">
        <h2 className="text-center font-display text-3xl font-semibold text-slate-900">เข้าสู่ระบบ</h2>
        <p className="mt-3 text-center text-slate-600">เลือกประเภทผู้ใช้ แล้วเข้าสู่ระบบด้วยเบอร์โทรและรหัสผ่าน</p>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {roles.map((card) => (
            <section key={card.role} className="card flex flex-col p-6">
              <p className="text-4xl" aria-hidden="true">{card.icon}</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-600">{card.body}</p>
              <Link href={`/login/${card.role}`} className="btn-green mt-5 w-full py-3">เข้าสู่ระบบ{card.title}</Link>
              {'register' in card && <Link href={card.register.href} className="btn-outline mt-2 w-full">{card.register.label}</Link>}
            </section>
          ))}
        </div>
      </section>

      <footer className="bg-brand-900 text-brand-100 max-sm:mt-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p><BrandName framed className="text-2xl" /></p>
            <p className="mt-3 text-sm">แพลตฟอร์มจ้างช่างตัดหญ้าและดูแลสวน</p>
          </div>
          <p className="text-xs text-brand-200">โหมดทดสอบ: รหัสยืนยันทาง SMS เป็นรหัสจำลองที่แสดงบนหน้าจอ</p>
        </div>
      </footer>
    </div>
  );
}
