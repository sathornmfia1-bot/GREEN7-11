'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AddressMap, formatAddress } from '../_components/address';
import { DateInput, formatThaiDate, todayIsoDate } from '../_components/date-input';
import { baseAreaWa, fixedHeightLabel, isOvergrown, isPruningOnly, monthlyDiscounts, monthlyPackagePrice, monthlyPackageService, pricePerVisit, pricingOptions, usesFixedHeight } from '../_components/pricing';
import { MobileStickyBar, mobileCtaClass } from '../_components/mobile';
import { useCustomer, useNotice, useRun } from '../_components/role-shell';
import { resizeImage } from '../_lib/image';
import { createBooking } from '../_server/actions';
import { maxLawnPhotos, money } from '../_lib/rules';

const buttonClass = 'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

// ลูกค้า: คำนวณราคา → ใบเสนอราคา → ชำระผ่าน QR → งานเข้า Job Pool
export default function CustomerBookingPage() {
  const customer = useCustomer();
  const notice = useNotice();
  const run = useRun();
  const [paying, setPaying] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'single' | 'monthly'>('single');
  const [service, setService] = useState(pricingOptions[0].name);
  const [area, setArea] = useState('120');
  const [grassHeight, setGrassHeight] = useState(0);
  const [appointment, setAppointment] = useState('');
  const [monthlyFrequency, setMonthlyFrequency] = useState(2);
  const [sundayPackage, setSundayPackage] = useState(false);
  const [prepaidMonths, setPrepaidMonths] = useState(3);
  const [lawnPhotos, setLawnPhotos] = useState<string[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteAddressId, setQuoteAddressId] = useState<string | null>(null);
  const [choosingQuoteAddress, setChoosingQuoteAddress] = useState(false);
  const [paidJobId, setPaidJobId] = useState<string | null>(null);
  // มือถือ: จองเป็น 3 ขั้น (1 บริการ · 2 รายละเอียด · 3 ใบเสนอราคาและชำระเงิน) · คอมแสดงทั้งฟอร์มเหมือนเดิม
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // แต่งกิ่งอย่างเดียว: ไม่ถามความสูงหญ้า ใช้เกณฑ์พุ่มไม้ (ระดับ 0)
  // แต่งกิ่งอย่างเดียว / ตัดสวนรกร้าง: ไม่ถามความสูงหญ้า ราคาไม่คูณตามความสูง (ระดับ 0)
  const fixedHeight = paymentMode === 'single' && usesFixedHeight(service);
  const heightLevel = fixedHeight ? 0 : grassHeight;
  const total = useMemo(() => {
    if (paymentMode === 'monthly' && sundayPackage) return 14100;
    if (paymentMode === 'single') return pricePerVisit(service, area, heightLevel);
    return monthlyPackagePrice(monthlyFrequency, area, heightLevel).price;
  }, [area, heightLevel, monthlyFrequency, paymentMode, service, sundayPackage]);
  const payable = paymentMode === 'monthly' ? total * prepaidMonths : total;
  const addresses = customer.addresses;
  const quoteAddress = addresses.find((address) => address.id === quoteAddressId) ?? addresses.find((address) => address.isDefault) ?? addresses[0];

  async function addLawnPhotos(files: FileList | null) {
    if (!files) return;
    const images = [...files].filter((file) => file.type.startsWith('image/'));
    const room = maxLawnPhotos - lawnPhotos.length;
    if (images.length > room) notice(`แนบรูปได้สูงสุด ${maxLawnPhotos} รูป · เพิ่มได้อีก ${room} รูป`, false);
    const resized = await Promise.all(images.slice(0, room).map((file) => resizeImage(file).catch(() => null)));
    setLawnPhotos((current) => [...current, ...resized.filter((url): url is string => Boolean(url))].slice(0, maxLawnPhotos));
  }

  function resetForm() {
    setQuoteOpen(false);
    setPaidJobId(null);
    setStep(1);
  }

  function goToStep(next: 1 | 2 | 3) {
    if (next === 3 && !appointment) {
      notice('กรุณาเลือกวันนัดหมายก่อนดำเนินการต่อ', false);
      return;
    }
    if (next === 3) setQuoteOpen(true);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  // มือถือ: แถบวันที่ 14 วันถัดไป (แตะเลือกได้ทันที)
  const upcomingDays = useMemo(() => Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(`${todayIsoDate()}T00:00:00`);
    date.setDate(date.getDate() + offset);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { iso, day: date.getDate(), weekday: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][date.getDay()] };
  }), []);
  const stepLabels = ['เลือกบริการ', 'รายละเอียด', 'ใบราคา'];
  const mobileHidden = (visibleStep: number) => (step !== visibleStep ? 'max-sm:hidden' : '');

  function beginQuote() {
    if (!appointment) {
      notice('กรุณาเลือกวันนัดหมายก่อนดำเนินการต่อ', false);
      return;
    }
    setQuoteOpen(true);
  }

  // เซิร์ฟเวอร์คำนวณราคาจากตารางราคาในฐานข้อมูลอีกครั้ง แล้วบันทึกการจอง การชำระ และงาน
  async function payQuote() {
    if (!quoteAddress) {
      notice('กรุณาเพิ่มที่อยู่บริการในเมนูบัญชีก่อนชำระเงิน', false);
      return;
    }
    setPaying(true);
    const result = await run(createBooking({
      mode: paymentMode,
      serviceName: service,
      area: Math.max(Number(area) || 0, 0),
      grassHeight: heightLevel,
      monthlyFrequency,
      sundayPackage,
      prepaidMonths,
      date: appointment,
      addressId: quoteAddress.id,
      photos: lawnPhotos,
    }));
    setPaying(false);
    if (result.ok && 'jobId' in result && typeof result.jobId === 'string') {
      setPaidJobId(result.jobId);
      setLawnPhotos([]);
    }
  }

  const paid = paidJobId !== null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
      <section className="card p-4 max-sm:pb-28 sm:p-6">
        <p className="text-sm font-medium text-brand-600 max-sm:hidden">คำนวณราคา & จอง</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 max-sm:hidden sm:text-3xl">บริการดูแลสวน</h1>

        {/* มือถือ: หัวขั้นตอน + แถบความคืบหน้า */}
        <div className="-mx-4 -mt-4 mb-4 border-b border-slate-100 px-2 pb-3 pt-1 sm:hidden">
          <div className="flex h-12 items-center gap-1">
            {step > 1 && !paid
              ? <button type="button" onClick={() => goToStep((step - 1) as 1 | 2)} aria-label="ย้อนกลับ" className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-slate-100"><svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
              : <span className="w-2" />}
            <h1 className="font-display text-xl font-semibold text-slate-900">จองบริการ</h1>
            <span className="ml-auto pr-2 text-sm text-slate-500">ขั้น {step} จาก 3</span>
          </div>
          <ol className="mt-1 grid grid-cols-3 gap-1.5 px-2" aria-label="ขั้นตอนการจอง">
            {stepLabels.map((label, index) => (
              <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
                <span className={`block h-1.5 rounded-full ${index < step ? 'bg-brand-700' : 'bg-slate-200'}`} />
                <span className={`mt-1 block text-xs ${step === index + 1 ? 'font-semibold text-brand-800' : 'text-slate-500'}`}>{label}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className={`mb-6 mt-5 grid grid-cols-1 gap-4 max-sm:mt-0 ${mobileHidden(1)}`}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">โหมดชำระ</p>
            <div className="flex flex-col gap-2 min-[360px]:flex-row sm:gap-3">
              {([{ id: 'single', label: 'จ่ายครั้งเดียว' }, { id: 'monthly', label: 'แพ็กเกจรายเดือน' }] as const).map((mode) => (
                <button key={mode.id} type="button" disabled={paid} aria-pressed={paymentMode === mode.id} onClick={() => { setPaymentMode(mode.id); setQuoteOpen(false); }} className={`min-w-0 flex-1 rounded-xl px-2 py-3 text-sm leading-tight sm:px-4 font-semibold transition-colors ${paymentMode === mode.id ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}><span className="fit-zoom">{mode.label}</span></button>
              ))}
            </div>
          </div>

          {paymentMode === 'single' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">ประเภทบริการ</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {pricingOptions.map((option) => (
                  <button key={option.name} type="button" disabled={paid} aria-pressed={service === option.name} onClick={() => setService(option.name)} className={`${buttonClass} text-left max-sm:min-h-[52px] max-sm:text-[15px] ${service === option.name ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                    {option.name}
                  </button>
                ))}
              </div>
              {/* มือถือ: อัตราส่วนเกินซ่อนไว้ */}
              <details className="mt-2 sm:hidden">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">ดูอัตราค่าบริการ ▾</summary>
                <ul className="space-y-1 text-xs text-slate-600">
                  {pricingOptions.map((option) => <li key={option.name}>{option.name}: ฿{money(option.basePrice)} (ไม่เกิน {baseAreaWa} ตร.ว.) · เกินคิดเพิ่ม ตร.ว.ละ ฿{option.extraPerWa}</li>)}
                </ul>
              </details>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">เลือกแพ็กเกจ</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                {[1, 2, 3].map((frequency) => {
                  const selected = !sundayPackage && monthlyFrequency === frequency;
                  const { fullPrice, price } = monthlyPackagePrice(frequency, area, grassHeight);
                  return (
                    <button key={frequency} type="button" disabled={paid} aria-pressed={selected} onClick={() => { setSundayPackage(false); setMonthlyFrequency(frequency); }} className={`${buttonClass} text-left ${selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                      <span className="flex items-center justify-between gap-2">{frequency} ครั้งต่อเดือน<span className="badge bg-rose-100 text-rose-700">ลด {Math.round(monthlyDiscounts[frequency] * 100)}%</span></span>
                      <span className="mt-1 block text-xs"><span className="mr-1 text-slate-400 line-through">฿{money(fullPrice)}</span><span className="font-semibold">฿{money(price)}</span>/เดือน</span>
                      <span className="mt-0.5 block text-xs opacity-70">{monthlyPackageService}</span>
                    </button>
                  );
                })}
                <button type="button" disabled={paid} aria-pressed={sundayPackage} onClick={() => setSundayPackage(true)} className={`${buttonClass} text-left ${sundayPackage ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                  รายเดือน (หยุดวันอาทิตย์)<span className="mt-1 block text-xs opacity-70">฿14,100/เดือน · ราคาคงที่ ไม่ขึ้นกับพื้นที่</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* มือถือ ขั้น 2: แสดงบริการที่เลือกในขั้น 1 (แตะ "เปลี่ยน" เพื่อกลับไปเลือกใหม่) */}
        {step === 2 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:hidden">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug text-brand-800">
                {paymentMode === 'single' ? service : sundayPackage ? 'รายเดือน (หยุดวันอาทิตย์)' : `${monthlyFrequency} ครั้งต่อเดือน · ${monthlyPackageService}`}
              </p>
            </div>
            {!paid && <button type="button" onClick={() => goToStep(1)} className="flex min-h-[44px] shrink-0 items-center rounded-full border border-brand-600 bg-white px-4 text-sm font-semibold text-brand-700">เปลี่ยน</button>}
          </div>
        )}

        <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${mobileHidden(2)}`}>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="area" className="mb-2 block text-sm font-semibold text-slate-700">พื้นที่ (ตารางวา)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setArea(String(Math.max(1, (Number(area) || 0) - 10)))} disabled={paid || (paymentMode === 'monthly' && sundayPackage)} aria-label="ลดพื้นที่ 10 ตารางวา" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl text-brand-700 disabled:opacity-40 sm:hidden">−</button>
              <input id="area" type="number" inputMode="numeric" min="1" value={area} onChange={(event) => setArea(event.target.value)} disabled={paid || (paymentMode === 'monthly' && sundayPackage)} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100 max-sm:h-12 max-sm:text-center max-sm:text-xl max-sm:font-semibold" />
              <button type="button" onClick={() => setArea(String((Number(area) || 0) + 10))} disabled={paid || (paymentMode === 'monthly' && sundayPackage)} aria-label="เพิ่มพื้นที่ 10 ตารางวา" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl text-brand-700 disabled:opacity-40 sm:hidden">+</button>
            </div>
            {paymentMode === 'monthly' && sundayPackage && <span className="mt-1 block text-xs text-slate-500">แพ็กเกจนี้ราคาไม่ขึ้นกับพื้นที่</span>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="grass-height" className="mb-2 block text-sm font-semibold text-slate-700">{fixedHeight && isPruningOnly(service) ? 'ความสูงพุ่มไม้' : 'ความสูงหญ้า'}</label>
            {/* มือถือ: ชิป 3 ตัวแตะเลือก แทนรายการเลื่อนลง */}
            {!fixedHeight && (
              <div className="grid grid-cols-3 gap-2 sm:hidden" role="radiogroup" aria-label="ความสูงหญ้า">
                {['< 6"', '6–12"', '> 12"'].map((label, index) => (
                  <button key={label} type="button" role="radio" aria-checked={heightLevel === index} disabled={paid || (paymentMode === 'monthly' && sundayPackage)} onClick={() => setGrassHeight(index)} className={`h-12 rounded-xl border text-[15px] disabled:opacity-40 ${heightLevel === index ? 'border-2 border-brand-700 bg-brand-50 font-semibold text-brand-800' : 'border-slate-200 bg-white text-slate-800'}`}>{label}</button>
                ))}
              </div>
            )}
            {/* ตัดสวนรกร้าง: แสดง "มากกว่า 12"" ในช่องที่เปลี่ยนไม่ได้ */}
            <select id="grass-height" value={heightLevel} onChange={(event) => setGrassHeight(Number(event.target.value))} disabled={paid || (paymentMode === 'monthly' && sundayPackage) || (fixedHeight && isOvergrown(service))} className={`w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 max-sm:h-12 ${fixedHeight ? '' : 'max-sm:hidden'}`}>
              {fixedHeight
                ? <option value={0}>{fixedHeightLabel(service)}</option>
                : <><option value={0}>น้อยกว่า 6&quot; × 1.0</option><option value={1}>มากกว่า 6&quot; × 1.5</option><option value={2}>มากกว่า 12&quot; × 2.0</option></>}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="appointment" className="mb-2 block text-sm font-semibold text-slate-700">วันนัดหมาย</label>
            {/* มือถือ: แถบวันที่เลื่อนซ้าย-ขวา 14 วัน */}
            <div className="-mx-4 mb-3 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:hidden" role="radiogroup" aria-label="เลือกวันนัดหมาย">
              {upcomingDays.map((day) => (
                <button key={day.iso} type="button" role="radio" aria-checked={appointment === day.iso} aria-label={formatThaiDate(day.iso)} disabled={paid} onClick={() => setAppointment(day.iso)} className={`flex h-[72px] w-[58px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl border ${appointment === day.iso ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
                  <span className={`text-xs ${appointment === day.iso ? 'text-white' : 'text-slate-500'}`}>{day.weekday}</span>
                  <span className="text-lg font-semibold">{day.day}</span>
                </button>
              ))}
            </div>
            <span className="mb-1 block text-xs text-slate-500 sm:hidden">หรือเลือกวันอื่น</span>
            <DateInput id="appointment" value={appointment} onChange={setAppointment} min={todayIsoDate()} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500" />
          </div>
        </div>

        <div className={`mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-medium text-slate-700 ${mobileHidden(2)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>แนบรูปสนามหญ้า (ไม่บังคับ) <span className="font-normal text-slate-500">· สูงสุด {maxLawnPhotos} รูป</span></span>
            {lawnPhotos.length > 0 && <span className="text-xs text-brand-700">แนบแล้ว {lawnPhotos.length} รูป</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {lawnPhotos.map((url, index) => (
              <div key={url.slice(-40) + index} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`รูปสนามหญ้า ${index + 1}`} className="h-full w-full object-cover" />
                {!paid && <button type="button" onClick={() => setLawnPhotos((current) => current.filter((_, position) => position !== index))} aria-label={`ลบรูปที่ ${index + 1}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-xs font-bold text-white hover:bg-slate-900">✕</button>}
              </div>
            ))}
            {!paid && lawnPhotos.length < maxLawnPhotos && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 hover:border-brand-500 hover:text-brand-700">
                <span aria-hidden="true" className="text-2xl leading-none">＋</span>
                <span className="mt-1">เพิ่มรูป</span>
                <input type="file" accept="image/*" multiple onChange={(event) => { addLawnPhotos(event.target.files); event.target.value = ''; }} className="sr-only" />
              </label>
            )}
          </div>
        </div>

        {/* มือถือ: กล่องนี้แสดงเฉพาะขั้น 2 ของแพ็กเกจรายเดือน (เลือกจำนวนเดือน) · ยอดรวมและปุ่มอยู่ในแถบด้านล่าง */}
        <div className={`mt-6 rounded-xl bg-emerald-50 p-4 ${step === 2 && paymentMode === 'monthly' ? '' : 'max-sm:hidden'}`}>
          {paymentMode === 'monthly' && (
            <div className="mb-4 border-b border-emerald-100 pb-4 max-sm:mb-0 max-sm:border-b-0 max-sm:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-600">ราคาแพ็กเกจต่อเดือน</p>
                <p className="text-lg font-bold text-slate-900">฿{money(total)}<span className="text-sm font-normal text-slate-500">/เดือน</span></p>
              </div>
              <fieldset className="mt-3" disabled={paid}>
                <legend className="text-sm font-semibold text-slate-800">เลือกจำนวนเดือนที่ต้องการชำระ</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[3, 6, 12].map((months) => (
                    <button key={months} type="button" aria-pressed={prepaidMonths === months} onClick={() => setPrepaidMonths(months)} className={`rounded-xl border px-3 py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${prepaidMonths === months ? 'border-brand-600 bg-white text-brand-700 ring-2 ring-brand-500' : 'border-emerald-100 bg-white text-slate-700 hover:border-brand-500'}`}>
                      <span className="block text-base font-bold">{months} เดือน</span>
                      <span className="mt-0.5 block text-xs text-slate-500">฿{money(total * months)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4 max-sm:hidden">
            <div>
              <p className="text-sm font-medium text-slate-600">{paymentMode === 'monthly' ? `ยอดชำระ ${prepaidMonths} เดือน` : 'ราคารวมโดยประมาณ'}</p>
              <p className="mt-1 text-3xl font-bold text-brand-700">฿{money(payable)}</p>
              {paymentMode === 'monthly' && <p className="mt-0.5 text-xs text-slate-600">฿{money(total)} × {prepaidMonths} เดือน</p>}
              <p className="mt-1 text-xs text-slate-600">ราคาเพื่อสาธิต UI อาจเปลี่ยนหลังประเมินหน้างาน</p>
            </div>
            <button type="button" onClick={beginQuote} disabled={paid} className="rounded-full bg-accent-500 font-display tracking-wide shadow-soft px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-400">{paid ? 'ชำระแล้ว' : 'ต่อไป: ใบเสนอราคา'}</button>
          </div>
        </div>

        {(quoteOpen || step === 3) && (
          <div className={`mt-4 rounded-xl border border-brand-200 bg-white p-4 max-sm:mt-0 sm:p-5 ${mobileHidden(3)} ${quoteOpen ? '' : 'sm:hidden'}`} aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-900">ใบเสนอราคา</h2><p className="mt-1 text-sm text-slate-600">{paymentMode === 'single' ? `${service} · ${area || 0} ตารางวา` : sundayPackage ? 'รายเดือน (หยุดวันอาทิตย์)' : `${monthlyFrequency} ครั้งต่อเดือน`} · {formatThaiDate(appointment)}</p></div>
              {!paid && <button type="button" aria-label="ปิดใบเสนอราคา" onClick={() => setQuoteOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-900 max-sm:hidden">ปิด</button>}
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">ชื่อ-นามสกุล</dt><dd className="mt-0.5 font-semibold text-slate-900">{customer.firstName} {customer.lastName}</dd></div>
              <div><dt className="text-slate-500">เบอร์โทร</dt><dd className="mt-0.5 font-semibold text-slate-900">{customer.phone}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">ที่อยู่บริการ</dt>
                <dd className="mt-1">
                  {!quoteAddress ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-amber-800">ยังไม่มีที่อยู่บริการ · <Link href="/customer/account" className="font-semibold underline">เพิ่มที่อยู่</Link></p>
                  ) : choosingQuoteAddress ? (
                    <fieldset className="rounded-lg border border-brand-200 p-3">
                      <legend className="px-1 text-sm font-semibold text-slate-800">เลือกที่อยู่บริการ</legend>
                      <div className="space-y-2">
                        {addresses.map((address) => (
                          <label key={address.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${address.id === quoteAddress.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-500'}`}>
                            <input type="radio" name="quote-address" checked={address.id === quoteAddress.id} onChange={() => { setQuoteAddressId(address.id); setChoosingQuoteAddress(false); }} className="mt-1 accent-emerald-700" />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">{address.label}{address.isDefault && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">ที่อยู่หลัก</span>}</span>
                              <span className="mt-0.5 block text-slate-600">{formatAddress(address.details)}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <button type="button" onClick={() => setChoosingQuoteAddress(false)} className="mt-2 text-sm font-semibold text-slate-500 hover:text-slate-900">ยกเลิก</button>
                    </fieldset>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-slate-800">
                        <p className="min-w-0 flex-1"><span className="font-semibold">{quoteAddress.label}</span> · {formatAddress(quoteAddress.details)}</p>
                        {addresses.length > 1 && !paid && <button type="button" onClick={() => setChoosingQuoteAddress(true)} className="shrink-0 rounded-full border border-brand-600 px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50">เปลี่ยน</button>}
                      </div>
                      <AddressMap details={quoteAddress.details} className="mt-2" />
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-600">ยอดชำระผ่าน QR</span><strong className="text-xl text-slate-900">฿{money(payable)}</strong></div>
            {paid ? (
              <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm">
                <p className="font-semibold text-emerald-700">✓ ชำระสำเร็จ · ส่งงานเข้า Job Pool แล้ว รอช่างรับงาน</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/customer/bookings" className="rounded-full bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600">ดูการจองของฉัน</Link>
                  <button type="button" onClick={resetForm} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700">จองงานใหม่</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={payQuote} disabled={!quoteAddress || paying} className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 max-sm:hidden">{paying ? 'กำลังบันทึกการชำระเงิน...' : 'จำลองสแกน QR ชำระเงิน'}</button>
            )}
          </div>
        )}

        {/* มือถือ: ปุ่มขั้นถัดไป ติดด้านล่าง (เหนือแถบเมนู) จัดกึ่งกลางจอ */}
        {!paid && (
          <MobileStickyBar aboveNav>
            <div className="mx-auto w-full max-w-sm">
              {step < 3
                ? <button type="button" onClick={() => goToStep((step + 1) as 2 | 3)} className={`${mobileCtaClass} bg-brand-700 hover:bg-brand-800`}>ถัดไป</button>
                : <button type="button" onClick={payQuote} disabled={!quoteAddress || paying} className={`${mobileCtaClass} bg-brand-700 hover:bg-brand-800`}>{paying ? 'กำลังชำระ…' : 'ชำระผ่าน QR'}</button>}
            </div>
          </MobileStickyBar>
        )}
      </section>

      <aside className="card p-4 max-sm:hidden sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">แพ็กเกจดูแลสวน</h2>
        <button type="button" disabled={paid} onClick={() => { setPaymentMode('monthly'); setSundayPackage(true); setQuoteOpen(false); }} aria-pressed={paymentMode === 'monthly' && sundayPackage} className={`mt-4 w-full rounded-2xl p-5 text-left text-white transition-colors ${paymentMode === 'monthly' && sundayPackage ? 'bg-emerald-800' : 'bg-slate-900 hover:bg-slate-800'}`}>
          <span className="text-sm text-emerald-100">รายเดือน หยุดวันอาทิตย์</span><span className="mt-3 block text-4xl font-bold">฿14,100</span><span className="mt-2 block text-sm text-slate-200">ราคาคงที่ ไม่ขึ้นกับพื้นที่</span><span className="mt-2 block text-sm text-slate-200">รดน้ำ · กวาดใบไม้ · ถอนวัชพืช · ตัดหญ้า · แต่งกิ่ง</span>
        </button>
        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-700">ความถี่รายเดือน</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 3].map((frequency) => <button key={frequency} type="button" disabled={paid} onClick={() => { setPaymentMode('monthly'); setSundayPackage(false); setMonthlyFrequency(frequency); }} aria-pressed={paymentMode === 'monthly' && !sundayPackage && monthlyFrequency === frequency} className={`${buttonClass} ${paymentMode === 'monthly' && !sundayPackage && monthlyFrequency === frequency ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700 hover:border-brand-500'}`}>{frequency} ครั้งต่อเดือน</button>)}
          </div>
        </div>
      </aside>
    </div>
  );
}
