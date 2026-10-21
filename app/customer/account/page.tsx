'use client';

import { useState } from 'react';
import { AddressEditor, emptyAddressDetails, formatAddress, type AddressDetails } from '../../_components/address';
import { useCustomer, useNotice, useRun } from '../../_components/role-shell';
import { saveCustomerAddresses, updateCustomerPhone } from '../../_server/actions';
import type { ServiceAddress } from '../../_lib/types';
import { formatPhone } from '../../_lib/rules';

const labels = ['บ้าน', 'ที่ทำงาน', 'อื่นๆ'];
const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none';
const lockedClass = 'mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 focus:outline-none';

function isComplete(details: AddressDetails) {
  return Boolean(details.addressLine.trim() && details.province && details.amphoe);
}

export default function CustomerAccountPage() {
  const customer = useCustomer();
  const notice = useNotice();
  const run = useRun();
  const [phone, setPhone] = useState(formatPhone(customer.phone));
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState(labels[0]);
  const [newDetails, setNewDetails] = useState<AddressDetails>(emptyAddressDetails);
  const [newDefault, setNewDefault] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDetails, setEditDetails] = useState<AddressDetails>(emptyAddressDetails);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const addresses = customer.addresses;

  async function save(next: ServiceAddress[], message: string) {
    const result = await run(saveCustomerAddresses(next));
    if (result.ok) notice(message);
    return result.ok;
  }

  async function addAddress() {
    if (!isComplete(newDetails)) {
      notice('กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ', false);
      return;
    }
    const makeDefault = newDefault || addresses.length === 0;
    const next = [...addresses.map((item) => ({ ...item, isDefault: makeDefault ? false : item.isDefault })), { id: `new-${Date.now()}`, label: newLabel, details: newDetails, isDefault: makeDefault }];
    if (await save(next, 'เพิ่มที่อยู่บริการแล้ว')) {
      setAdding(false);
      setNewDetails(emptyAddressDetails);
      setNewDefault(false);
    }
  }

  async function saveEdit(id: string) {
    if (!isComplete(editDetails)) {
      notice('กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ', false);
      return;
    }
    if (await save(addresses.map((item) => item.id === id ? { ...item, label: editLabel, details: editDetails } : item), 'แก้ไขที่อยู่บริการแล้ว')) setEditingId(null);
  }

  function remove(id: string) {
    setConfirmDeleteId(null);
    if (addresses.length === 1) {
      notice('ต้องมีที่อยู่บริการอย่างน้อย 1 แห่ง', false);
      return;
    }
    const remaining = addresses.filter((item) => item.id !== id);
    save(remaining.some((item) => item.isDefault) ? remaining : remaining.map((item, index) => ({ ...item, isDefault: index === 0 })), 'ลบที่อยู่บริการแล้ว');
  }

  return (
    <div className="space-y-6">
      <section className="card p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">บัญชีของฉัน</h1>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">ชื่อ<input value={customer.firstName} readOnly aria-readonly="true" className={lockedClass} /></label>
          <label className="text-sm font-medium text-slate-700">นามสกุล<input value={customer.lastName} readOnly aria-readonly="true" className={lockedClass} /></label>
          <p className="text-xs text-slate-500 sm:col-span-2">ชื่อ-นามสกุลใช้ตามที่ลงทะเบียน และใช้เป็นชื่อบัญชีรับเงินคืน จึงแก้ไขไม่ได้ · หากต้องการเปลี่ยน กรุณาติดต่อแอดมิน</p>
          <label className="text-sm font-medium text-slate-700">เบอร์โทร (ใช้เข้าสู่ระบบ)
            <div className="flex gap-2">
              <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
              <button type="button" onClick={() => { run(updateCustomerPhone(phone)); }} className="mt-1 shrink-0 rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white">บันทึก</button>
            </div>
          </label>
          <label className="text-sm font-medium text-slate-700">อีเมล<input value={customer.email} readOnly aria-readonly="true" className={lockedClass} /></label>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-900">ที่อยู่บริการ</h2><p className="mt-1 text-sm text-slate-600">เลือกที่อยู่หลัก หรือเพิ่มสถานที่ให้บริการใหม่</p></div>
          <button type="button" onClick={() => setAdding(!adding)} aria-expanded={adding} className="rounded-full border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">{adding ? 'ยกเลิก' : '+ เพิ่มที่อยู่ใหม่'}</button>
        </div>
        <div className="mt-3 space-y-2">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex min-w-[12rem] flex-1 cursor-pointer items-start gap-3">
                  <input type="radio" name="default-address" checked={address.isDefault} onChange={() => save(addresses.map((item) => ({ ...item, isDefault: item.id === address.id })), 'ตั้งเป็นที่อยู่หลักแล้ว')} className="mt-1 accent-emerald-700" />
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">{address.label}{address.isDefault && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">ที่อยู่หลัก</span>}</span><span className="mt-1 block text-sm text-slate-600">{formatAddress(address.details)}</span></span>
                </label>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => { setEditingId(address.id); setEditLabel(address.label); setEditDetails({ ...address.details }); setConfirmDeleteId(null); }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500">แก้ไข</button>
                  <button type="button" onClick={() => { setConfirmDeleteId(address.id); setEditingId(null); }} className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">ลบ</button>
                </div>
              </div>
              {editingId === address.id && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <label className="mb-3 block max-w-xs text-sm font-medium text-slate-700">ประเภทที่อยู่<select value={editLabel} onChange={(event) => setEditLabel(event.target.value)} className={inputClass}>{labels.map((label) => <option key={label}>{label}</option>)}</select></label>
                  <AddressEditor details={editDetails} onChange={setEditDetails} />
                  <div className="mt-3 flex gap-2"><button type="button" onClick={() => saveEdit(address.id)} className="rounded-full bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600">บันทึกการแก้ไข</button><button type="button" onClick={() => setEditingId(null)} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
                </div>
              )}
              {confirmDeleteId === address.id && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-3">
                  <p className="text-sm text-rose-800">ยืนยันลบที่อยู่นี้หรือไม่?</p>
                  <div className="flex gap-2"><button type="button" onClick={() => remove(address.id)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800">ยืนยันลบ</button><button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
                </div>
              )}
            </div>
          ))}
        </div>
        {adding && (
          <div className="mt-3 rounded-xl bg-slate-50 p-4">
            <label className="mb-3 block max-w-xs text-sm font-medium text-slate-700">ประเภทที่อยู่<select value={newLabel} onChange={(event) => setNewLabel(event.target.value)} className={inputClass}>{labels.map((label) => <option key={label}>{label}</option>)}</select></label>
            <AddressEditor details={newDetails} onChange={setNewDetails} />
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={newDefault} onChange={(event) => setNewDefault(event.target.checked)} className="accent-emerald-700" />ตั้งเป็นที่อยู่หลัก</label>
            <button type="button" onClick={addAddress} className="mt-3 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">บันทึกที่อยู่นี้</button>
          </div>
        )}
      </section>
    </div>
  );
}
