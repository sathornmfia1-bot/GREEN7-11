'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AddressMap, formatAddress } from '../_components/address';
import { DateInput, formatThaiDate, todayIsoDate } from '../_components/date-input';
import { baseAreaWa, isPruningOnly, monthlyDiscounts, monthlyPackagePrice, monthlyPackageService, pricePerVisit, pricingOptions, shrubHeightLabel } from '../_components/pricing';
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

  // แต่งกิ่งอย่างเดียว: ไม่ถามความสูงหญ้า ใช้เกณฑ์พุ่มไม้ (ระดับ 0)
  const pruningOnly = paymentMode === 'single' && isPruningOnly(service);
  const heightLevel = pruningOnly ? 0 : grassHeight;
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
  }

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
      <section className="card p-4 sm:p-6">
        <p className="text-sm font-medium text-brand-600">คำนวณราคา & จอง</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">บริการดูแลสวน</h1>

        <div className="mb-6 mt-5 grid grid-cols-1 gap-4">
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
                  <button key={option.name} type="button" disabled={paid} aria-pressed={service === option.name} onClick={() => setService(option.name)} className={`${buttonClass} text-left ${service === option.name ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                    {option.name}<span className="mt-1 block text-xs opacity-70">฿{money(option.basePrice)} (ไม่เกิน {baseAreaWa} ตารางวา) · เกินคิดเพิ่ม ตารางวาละ ฿{option.extraPerWa}</span>
                  </button>
                ))}
              </div>
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="area" className="mb-2 block text-sm font-semibold text-slate-700">พื้นที่ (ตารางวา)</label>
            <input id="area" type="number" min="1" value={area} onChange={(event) => setArea(event.target.value)} disabled={paid || (paymentMode === 'monthly' && sundayPackage)} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100" />
            {paymentMode === 'monthly' && sundayPackage && <span className="mt-1 block text-xs text-slate-500">แพ็กเกจนี้ราคาไม่ขึ้นกับพื้นที่</span>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="grass-height" className="mb-2 block text-sm font-semibold text-slate-700">{pruningOnly ? 'ความสูงพุ่มไม้' : 'ความสูงหญ้า'}</label>
            <select id="grass-height" value={heightLevel} onChange={(event) => setGrassHeight(Number(event.target.value))} disabled={paid || (paymentMode === 'monthly' && sundayPackage)} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100">
              {pruningOnly
                ? <option value={0}>{shrubHeightLabel}</option>
                : <><option value={0}>น้อยกว่า 6&quot; × 1.0</option><option value={1}>มากกว่า 6&quot; × 1.5</option><option value={2}>มากกว่า 12&quot; × 2.0</option></>}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="appointment" className="mb-2 block text-sm font-semibold text-slate-700">วันนัดหมาย</label>
            <DateInput id="appointment" value={appointment} onChange={setAppointment} min={todayIsoDate()} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500" />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-medium text-slate-700">
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

        <div className="mt-6 rounded-xl bg-emerald-50 p-4">
          {paymentMode === 'monthly' && (
            <div className="mb-4 border-b border-emerald-100 pb-4">
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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">{paymentMode === 'monthly' ? `ยอดชำระ ${prepaidMonths} เดือน` : 'ราคารวมโดยประมาณ'}</p>
              <p className="mt-1 text-3xl font-bold text-brand-700">฿{money(payable)}</p>
              {paymentMode === 'monthly' && <p className="mt-0.5 text-xs text-slate-600">฿{money(total)} × {prepaidMonths} เดือน</p>}
              <p className="mt-1 text-xs text-slate-600">ราคาเพื่อสาธิต UI อาจเปลี่ยนหลังประเมินหน้างาน</p>
            </div>
            <button type="button" onClick={beginQuote} disabled={paid} className="rounded-full bg-accent-500 font-display tracking-wide shadow-soft px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-400">{paid ? 'ชำระแล้ว' : 'ต่อไป: ใบเสนอราคา'}</button>
          </div>
        </div>

        {quoteOpen && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-white p-4 sm:p-5" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-900">ใบเสนอราคา</h2><p className="mt-1 text-sm text-slate-600">{paymentMode === 'single' ? `${service} · ${area || 0} ตารางวา` : sundayPackage ? 'รายเดือน (หยุดวันอาทิตย์)' : `${monthlyFrequency} ครั้งต่อเดือน`} · {formatThaiDate(appointment)}</p></div>
              {!paid && <button type="button" aria-label="ปิดใบเสนอราคา" onClick={() => setQuoteOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-900">ปิด</button>}
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
              <button type="button" onClick={payQuote} disabled={!quoteAddress || paying} className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">{paying ? 'กำลังบันทึกการชำระเงิน...' : 'จำลองสแกน QR ชำระเงิน'}</button>
            )}
          </div>
        )}
      </section>

      <aside className="card p-4 sm:p-6">
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
