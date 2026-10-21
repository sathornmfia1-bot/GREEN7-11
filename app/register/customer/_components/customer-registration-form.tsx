'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '../../../_components/brand';
import { AddressEditor, emptyAddressDetails, formatAddress, type AddressDetails } from '../../../_components/address';
import { registerCustomer } from '../../../_server/actions';
import { setSession } from '../../../_lib/session';
import { FieldError, inputClass, isValidThaiMobile, labelClass, PhoneOtpField, phoneDigitsOf, phoneErrorMessage, Section } from '../../../_components/form-ui';

const addressLabels = ['บ้าน', 'ที่ทำงาน', 'อื่นๆ'];
const minPasswordLength = 8;

type Submitted = { firstName: string; lastName: string; phone: string; email: string; addressLabel: string; address: AddressDetails };

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone' | 'otp' | 'email' | 'password' | 'confirmPassword' | 'address' | 'terms', string>>;

export default function CustomerRegistrationForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [addressLabel, setAddressLabel] = useState(addressLabels[0]);
  const [address, setAddress] = useState<AddressDetails>(emptyAddressDetails);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!firstName.trim()) nextErrors.firstName = 'กรุณากรอกชื่อ';
    if (!lastName.trim()) nextErrors.lastName = 'กรุณากรอกนามสกุล';
    if (!isValidThaiMobile(phone)) nextErrors.phone = phoneErrorMessage;
    else if (!phoneVerified) nextErrors.otp = 'กรุณายืนยันเบอร์โทรด้วย OTP';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'กรุณากรอกอีเมลให้ถูกต้อง';
    if (password.length < minPasswordLength) nextErrors.password = `รหัสผ่านต้องมีอย่างน้อย ${minPasswordLength} ตัวอักษร`;
    if (confirmPassword !== password) nextErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
    if (!address.addressLine.trim() || !address.province || !address.amphoe) nextErrors.address = 'กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ';
    if (!acceptTerms) nextErrors.terms = 'กรุณายอมรับข้อกำหนดการให้บริการ';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const profile: Submitted = { firstName: firstName.trim(), lastName: lastName.trim(), phone: phoneDigitsOf(phone), email: email.trim(), addressLabel, address };
    // บันทึกลง Supabase (ไม่เก็บรหัสผ่าน — ล็อกอินด้วยเบอร์โทร + OTP) แล้วเข้าสู่ระบบลูกค้าให้ทันที
    setSaving(true);
    const result = await registerCustomer({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone, email: profile.email, addressLabel, address });
    setSaving(false);
    if (!result.ok || !('id' in result) || typeof result.id !== 'string') {
      setErrors({ phone: result.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSession('customer', result.id);
    setSubmitted(profile);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="card p-6 text-center">
          <p className="text-4xl" aria-hidden="true">🎉</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">สมัครสมาชิกสำเร็จ</h1>
          <p className="mt-2 text-sm text-slate-600">สถานะบัญชี: <span className="badge bg-emerald-100 text-emerald-700">เปิดใช้งานแล้ว</span></p>
          <p className="mt-3 text-sm text-slate-600">เริ่มจองบริการดูแลสวนได้ทันที</p>
          <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">ชื่อ-นามสกุล</dt><dd className="font-medium text-slate-900">{submitted.firstName} {submitted.lastName}</dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">เบอร์โทร</dt><dd className="text-slate-900">{submitted.phone} <span className="text-brand-700">✓ ยืนยันแล้ว</span></dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">อีเมล</dt><dd className="break-all text-slate-900">{submitted.email}</dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-slate-500">ที่อยู่บริการ</dt><dd className="text-slate-900"><span className="font-medium">{submitted.addressLabel}</span> · {formatAddress(submitted.address)}</dd></div>
          </dl>
          <Link href="/customer" className="mt-6 inline-block rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">เริ่มจองบริการ</Link>
        </div>
      </main>
    );
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3"><Logo /><Link href="/login/customer" className="text-sm font-medium text-brand-600 hover:underline">มีบัญชีแล้ว? เข้าสู่ระบบ</Link></div>
      <header className="mt-3">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ลงทะเบียนลูกค้า</h1>
        <p className="mt-2 text-sm text-slate-600">สมัครบัญชีเพื่อจองบริการตัดหญ้าและดูแลสวน ยืนยันเบอร์โทรแล้วใช้งานได้ทันที</p>
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

        <Section step={3} title="ข้อมูลเข้าสู่ระบบ">
          <div className="space-y-4">
            <label className={labelClass}>อีเมล <span className="text-rose-700">*</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" className={inputClass} /><FieldError message={errors.email} /></label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={labelClass}>รหัสผ่าน <span className="text-rose-700">*</span><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">อย่างน้อย {minPasswordLength} ตัวอักษร</span><FieldError message={errors.password} /></label>
              <label className={labelClass}>ยืนยันรหัสผ่าน <span className="text-rose-700">*</span><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className={inputClass} /><FieldError message={errors.confirmPassword} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="accent-emerald-700" />แสดงรหัสผ่าน</label>
          </div>
        </Section>

        <Section step={4} title="ที่อยู่หลักสำหรับให้บริการ">
          <label className={`${labelClass} mb-3 max-w-xs`}>ประเภทที่อยู่<select value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} className={inputClass}>{addressLabels.map((label) => <option key={label}>{label}</option>)}</select></label>
          <AddressEditor details={address} onChange={(details) => { setAddress(details); setErrors((current) => ({ ...current, address: undefined })); }} />
          <FieldError message={errors.address} />
          <p className="mt-2 text-xs text-slate-500">แนะนำให้ปักหมุดตำแหน่ง เพื่อให้ช่างหาบ้านเจอง่ายและรู้ระยะทางก่อนรับงาน · เพิ่มที่อยู่อื่นได้ภายหลังในเมนูตั้งค่า</p>
        </Section>

        <div className="card p-5 sm:p-6">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700" />
            <span>ข้าพเจ้ายอมรับข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัว</span>
          </label>
          <FieldError message={errors.terms} />
          <button type="submit" disabled={saving} className="mt-4 w-full rounded-full bg-accent-500 font-display tracking-wide shadow-soft disabled:bg-slate-400 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600">{saving ? 'กำลังบันทึก...' : 'สมัครสมาชิก'}</button>
        </div>
      </form>
    </main>
  );
}
