'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandName, Logo } from '../../../_components/brand';
import { AddressEditor, emptyAddressDetails, formatAddress, type AddressDetails } from '../../../_components/address';
import { registerMechanic } from '../../../_server/actions';
import { setSession } from '../../../_lib/session';
import { FieldError, inputClass, isValidThaiMobile, labelClass, PhoneOtpField, phoneDigitsOf, phoneErrorMessage, Section, thaiBanks } from '../../../_components/form-ui';

const radiusOptions = [5, 10, 20, 30, 50];

type MechanicInput = { firstName: string; lastName: string; phone: string; bankName: string; accountNumber: string; accountName: string; serviceRadiusKm: number; baseAddress: AddressDetails; idCardFileName: string; photoDataUrl?: string };

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone' | 'otp' | 'bankName' | 'accountNumber' | 'accountName' | 'baseAddress' | 'idCard' | 'photo' | 'terms', string>>;

export default function WorkerRegistrationForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(10);
  const [baseAddress, setBaseAddress] = useState<AddressDetails>(emptyAddressDetails);
  const [idCard, setIdCard] = useState<{ name: string; preview: string } | null>(null);
  const [photo, setPhoto] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<MechanicInput | null>(null);

  useEffect(() => () => { if (idCard) URL.revokeObjectURL(idCard.preview); }, [idCard]);

  // ย่อรูปโปรไฟล์เป็นสี่เหลี่ยมจัตุรัส 160px เพื่อเก็บในเบราว์เซอร์ได้
  function selectPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, photo: 'กรุณาแนบไฟล์รูปภาพเท่านั้น' }));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const side = Math.min(image.width, image.height);
      canvas.getContext('2d')?.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
      setPhoto(canvas.toDataURL('image/jpeg', 0.8));
      setErrors((current) => ({ ...current, photo: undefined }));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  function selectIdCard(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, idCard: 'กรุณาแนบไฟล์รูปภาพเท่านั้น' }));
      return;
    }
    setIdCard({ name: file.name, preview: URL.createObjectURL(file) });
    setErrors((current) => ({ ...current, idCard: undefined }));
  }

  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!firstName.trim()) nextErrors.firstName = 'กรุณากรอกชื่อ';
    if (!lastName.trim()) nextErrors.lastName = 'กรุณากรอกนามสกุล';
    if (!isValidThaiMobile(phone)) nextErrors.phone = phoneErrorMessage;
    else if (!phoneVerified) nextErrors.otp = 'กรุณายืนยันเบอร์โทรด้วย OTP';
    if (!bankName) nextErrors.bankName = 'กรุณาเลือกธนาคาร';
    if (!/^\d{10,12}$/.test(accountNumber.replace(/\D/g, ''))) nextErrors.accountNumber = 'กรุณากรอกเลขบัญชี 10–12 หลัก';
    if (!accountName.trim()) nextErrors.accountName = 'กรุณากรอกชื่อบัญชี';
    if (!baseAddress.addressLine.trim() || !baseAddress.province || !baseAddress.amphoe) nextErrors.baseAddress = 'กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ';
    else if (!baseAddress.location) nextErrors.baseAddress = 'กรุณาปักหมุดตำแหน่ง เพื่อใช้คำนวณระยะทางไปยังงาน';
    if (!photo) nextErrors.photo = 'กรุณาแนบรูปโปรไฟล์';
    if (!idCard) nextErrors.idCard = 'กรุณาแนบรูปบัตรประชาชน';
    if (!acceptTerms) nextErrors.terms = 'กรุณายอมรับข้อกำหนดการให้บริการ';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const profile: MechanicInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phoneDigitsOf(phone),
      bankName,
      accountNumber: accountNumber.replace(/\D/g, ''),
      accountName: accountName.trim(),
      serviceRadiusKm,
      baseAddress,
      idCardFileName: idCard!.name,
      photoDataUrl: photo,
    };
    // บันทึกใบสมัครลง Supabase (สถานะรอตรวจสอบ) แล้วเข้าสู่ระบบช่างให้ทันที
    setSaving(true);
    const result = await registerMechanic(profile);
    setSaving(false);
    if (!result.ok || !('id' in result) || typeof result.id !== 'string') {
      setErrors({ phone: result.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSession('mechanic', result.id);
    setSubmitted(profile);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="card p-6 text-center">
          <p className="text-4xl" aria-hidden="true">⏳</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">ส่งใบสมัครเรียบร้อย</h1>
          <p className="mt-2 text-sm text-slate-600">สถานะบัญชี: <span className="badge bg-amber-100 text-amber-700">รอการตรวจสอบ (Pending Verification)</span></p>
          <p className="mt-3 text-sm text-slate-600">แอดมินจะตรวจสอบข้อมูลและบัตรประชาชนของคุณ ระหว่างนี้ยังไม่สามารถรับงานได้</p>
          <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">ชื่อ-นามสกุล</dt><dd className="font-medium text-slate-900">{submitted.firstName} {submitted.lastName}</dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">เบอร์โทร</dt><dd className="text-slate-900">{submitted.phone} <span className="text-brand-700">✓ ยืนยันแล้ว</span></dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">บัญชีรับเงิน</dt><dd className="text-slate-900">{submitted.bankName} · {submitted.accountNumber} · {submitted.accountName}</dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">รัศมีให้บริการ</dt><dd className="text-slate-900">{submitted.serviceRadiusKm} กม.</dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">ที่อยู่ฐาน</dt><dd className="text-slate-900">{formatAddress(submitted.baseAddress)}</dd></div>
          </dl>
          <Link href="/mechanic/profile" className="mt-6 inline-block rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">ไปที่หน้าช่าง</Link>
        </div>
      </main>
    );
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3"><Logo /><Link href="/login/mechanic" className="text-sm font-medium text-brand-600 hover:underline">มีบัญชีแล้ว? เข้าสู่ระบบ</Link></div>
      <header className="mt-3">
        <p><BrandName className="text-xs tracking-[0.2em]" /></p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">สมัครเป็นช่างตัดหญ้า</h1>
        <p className="mt-2 text-sm text-slate-600">กรอกข้อมูลให้ครบ หลังสมัครบัญชีจะอยู่ในสถานะรอแอดมินตรวจสอบก่อนเริ่มรับงาน</p>
      </header>

      {errorCount > 0 && (
        <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          ข้อมูลยังไม่ครบ {errorCount} รายการ กรุณาตรวจสอบช่องที่มีข้อความสีแดง
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-5">
        <Section step={1} title="ข้อมูลส่วนตัว">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}>ชื่อ <span className="text-rose-700">*</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" className={inputClass} /><FieldError message={errors.firstName} /></label>
            <label className={labelClass}>นามสกุล <span className="text-rose-700">*</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" className={inputClass} /><FieldError message={errors.lastName} /></label>
          </div>
        </Section>

        <Section step={2} title="ยืนยันเบอร์โทร">
          <PhoneOtpField phone={phone} onPhoneChange={setPhone} verified={phoneVerified} onVerifiedChange={(value) => { setPhoneVerified(value); if (value) setErrors((current) => ({ ...current, phone: undefined, otp: undefined })); }} phoneError={errors.phone} otpError={errors.otp} />
        </Section>

        <Section step={3} title="บัญชีธนาคารรับเงิน">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>ธนาคาร <span className="text-rose-700">*</span><select value={bankName} onChange={(event) => setBankName(event.target.value)} className={inputClass}><option value="">เลือกธนาคาร</option>{thaiBanks.map((bank) => <option key={bank}>{bank}</option>)}</select><FieldError message={errors.bankName} /></label>
            <label className={labelClass}>เลขที่บัญชี <span className="text-rose-700">*</span><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" placeholder="xxx-x-xxxxx-x" className={inputClass} /><FieldError message={errors.accountNumber} /></label>
            <label className={labelClass}>ชื่อบัญชี <span className="text-rose-700">*</span><input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="ตรงกับหน้าสมุดบัญชี" className={inputClass} /><FieldError message={errors.accountName} /></label>
          </div>
        </Section>

        <Section step={4} title="ที่อยู่ปัจจุบันและรัศมีให้บริการ">
          <p className="mb-3 text-sm text-slate-600">ใช้เป็นจุดฐานในการคำนวณระยะทางไปยังสถานที่บริการ ให้คุณทราบก่อนกดรับงาน · <span className="font-medium text-slate-800">ต้องปักหมุดตำแหน่ง</span></p>
          <AddressEditor details={baseAddress} onChange={(details) => { setBaseAddress(details); setErrors((current) => ({ ...current, baseAddress: undefined })); }} />
          <FieldError message={errors.baseAddress} />
          <fieldset className="mt-4">
            <legend className={labelClass}>รัศมีที่รับงานได้</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {radiusOptions.map((radius) => (
                <button key={radius} type="button" aria-pressed={serviceRadiusKm === radius} onClick={() => setServiceRadiusKm(radius)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${serviceRadiusKm === radius ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700 hover:border-brand-500'}`}>{radius} กม.</button>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section step={5} title="ยืนยันตัวตน">
          <div className="mb-4 flex items-center gap-4">
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo} alt="รูปโปรไฟล์" className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
              : <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 text-3xl text-slate-400">👤</span>}
            <label className="block cursor-pointer text-sm font-medium text-slate-700">
              รูปโปรไฟล์ <span className="text-rose-700">*</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">ลูกค้าจะเห็นรูปนี้เมื่อคุณรับงาน · ใช้รูปหน้าตรง เห็นหน้าชัด</span>
              <span className="mt-2 inline-block rounded-md bg-brand-50 px-3 py-2 font-semibold text-brand-700 hover:bg-brand-100">{photo ? 'เปลี่ยนรูป' : 'เลือกรูป'}</span>
              <input type="file" accept="image/*" capture="user" onChange={(event) => selectPhoto(event.target.files?.[0])} className="sr-only" />
            </label>
          </div>
          <FieldError message={errors.photo} />
          <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:border-brand-500">
            รูปบัตรประชาชน <span className="text-rose-700">*</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">ถ่ายให้เห็นข้อมูลบนบัตรชัดเจน ไม่มีแสงสะท้อน</span>
            <input type="file" accept="image/*" capture="environment" onChange={(event) => selectIdCard(event.target.files?.[0])} className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
          </label>
          {idCard && (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={idCard.preview} alt="ตัวอย่างรูปบัตรประชาชน" className="h-20 w-32 rounded-lg border border-slate-200 object-cover" />
              <span className="min-w-0 truncate text-sm text-brand-700">แนบแล้ว: {idCard.name}</span>
            </div>
          )}
          <FieldError message={errors.idCard} />
        </Section>

        <div className="card p-5 sm:p-6">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700" />
            <span>ข้าพเจ้ายอมรับข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัว และยืนยันว่าข้อมูลที่กรอกเป็นความจริง</span>
          </label>
          <FieldError message={errors.terms} />
          <button type="submit" disabled={saving} className="mt-4 w-full rounded-full bg-accent-500 font-display tracking-wide shadow-soft disabled:bg-slate-400 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600">{saving ? 'กำลังบันทึก...' : 'ส่งใบสมัคร'}</button>
        </div>
      </form>
    </main>
  );
}
