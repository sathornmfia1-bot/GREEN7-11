'use client';

import { useState } from 'react';

type ThaiAddressRecord = { district: string; amphoe: string; province: string; zipcode: string };
export type AddressDetails = {
  addressLine: string;
  province: string;
  amphoe: string;
  district: string;
  location?: { lat: number; lng: number };
};
const { searchAddressByProvince } = require('thai-address-database') as {
  searchAddressByProvince: (query: string, maxResult?: number) => ThaiAddressRecord[];
};
const thaiAddressRecords = searchAddressByProvince('.', 100000);
export const thaiProvinces = [...new Set(thaiAddressRecords.map((address) => address.province))].sort((a, b) => a.localeCompare(b, 'th'));
export const emptyAddressDetails: AddressDetails = {
  addressLine: '', province: '', amphoe: '', district: '',
};

export function formatAddress(details: AddressDetails) {
  const parts = [
    details.addressLine.trim(),
    details.district && `${details.province === 'กรุงเทพมหานคร' ? 'แขวง' : 'ตำบล'}${details.district}`,
    details.amphoe && `${details.province === 'กรุงเทพมหานคร' ? 'เขต' : 'อำเภอ'}${details.amphoe}`,
    details.province,
    thaiAddressRecords.find((address) => address.province === details.province && address.amphoe === details.amphoe && address.district === details.district)?.zipcode,
  ].filter(Boolean);
  return parts.join(' ');
}

export function mapQuery(details: AddressDetails) {
  return details.location ? `${details.location.lat},${details.location.lng}` : formatAddress(details);
}

export function AddressMap({ details, className = '' }: { details: AddressDetails; className?: string }) {
  if (!details.location && !details.province) return null;
  const query = encodeURIComponent(mapQuery(details));
  return (
    <div className={className}>
      <iframe
        title="แผนที่ที่อยู่บริการ"
        src={`https://maps.google.com/maps?q=${query}&z=${details.location ? 17 : 14}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-56 w-full rounded-lg border border-slate-200"
      />
      <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline">เปิดใน Google Maps ↗</a>
    </div>
  );
}

export type LatLng = { lat: number; lng: number };

// ระยะทางเส้นตรง (Haversine) หน่วยกิโลเมตร
export function distanceKm(from: LatLng, to: LatLng) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`;
}

type AddressPicker = 'province' | 'amphoe' | 'district';

export function AddressEditor({
  details,
  onChange,
}: {
  details: AddressDetails;
  onChange: (details: AddressDetails) => void;
}) {
  const [picker, setPicker] = useState<AddressPicker | null>(null);
  const [query, setQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const districts = [...new Set(thaiAddressRecords.filter((address) => address.province === details.province).map((address) => address.amphoe))].sort((a, b) => a.localeCompare(b, 'th'));
  const subdistricts = [...new Set(thaiAddressRecords.filter((address) => address.province === details.province && address.amphoe === details.amphoe).map((address) => address.district))].sort((a, b) => a.localeCompare(b, 'th'));
  const zipcode = details.district ? thaiAddressRecords.find((address) => address.province === details.province && address.amphoe === details.amphoe && address.district === details.district)?.zipcode ?? '' : '';

  const pickers = {
    province: { title: 'เลือกจังหวัด', options: thaiProvinces, value: details.province, select: (province: string) => onChange({ ...details, province, amphoe: '', district: '' }) },
    amphoe: { title: 'เลือกเขต/อำเภอ', options: districts, value: details.amphoe, select: (amphoe: string) => onChange({ ...details, amphoe, district: '' }) },
    district: { title: 'เลือกแขวง/ตำบล', options: subdistricts, value: details.district, select: (district: string) => onChange({ ...details, district: district === details.district ? '' : district }) },
  };
  const rows: { id: AddressPicker; label: string; placeholder: string; disabledHint?: string }[] = [
    { id: 'province', label: 'จังหวัด', placeholder: 'เลือกจังหวัด' },
    { id: 'amphoe', label: 'เขต/อำเภอ', placeholder: 'เลือกเขต/อำเภอ', disabledHint: details.province ? undefined : 'เลือกจังหวัดก่อน' },
    { id: 'district', label: 'แขวง/ตำบล (ไม่บังคับ)', placeholder: 'เลือกแขวง/ตำบล', disabledHint: details.amphoe ? undefined : 'เลือกเขต/อำเภอก่อน' },
  ];
  const activePicker = picker && pickers[picker];
  const filteredOptions = activePicker ? activePicker.options.filter((option) => option.includes(query.trim())) : [];

  function openPicker(id: AddressPicker) {
    setQuery('');
    setPicker(id);
  }

  function pinCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    setLocationStatus('กำลังค้นหาตำแหน่ง...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ ...details, location: { lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) } });
        setLocationStatus('');
      },
      () => setLocationStatus('ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <p className="bg-slate-100 px-4 py-3 text-base font-semibold text-slate-800">ข้อมูลที่อยู่</p>
      <label className="block border-b border-slate-200 px-4 py-3">
        <span className="block text-sm text-slate-700">ห้องเลขที่, บ้านเลขที่, ตึก, หมู่บ้าน, ถนน</span>
        <input value={details.addressLine} onChange={(event) => onChange({ ...details, addressLine: event.target.value })} placeholder="ใส่รายละเอียดที่อยู่" autoComplete="street-address" className="mt-1 w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none" />
      </label>
      {rows.map((row) => {
        const value = pickers[row.id].value;
        return (
          <button key={row.id} type="button" disabled={Boolean(row.disabledHint)} onClick={() => openPicker(row.id)} className="flex w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:hover:bg-white">
            <span className="w-28 shrink-0 text-base text-slate-800 sm:w-auto">{row.label}</span>
            <span className={`min-w-0 flex-1 text-right text-base ${value ? 'text-slate-900' : 'text-slate-400'}`}>{value || row.disabledHint || row.placeholder}</span>
            <span aria-hidden="true" className="text-xl leading-none text-slate-400">›</span>
          </button>
        );
      })}
      {zipcode && <p className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">รหัสไปรษณีย์ <span className="font-semibold text-slate-900">{zipcode}</span></p>}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-base text-slate-800">ตำแหน่งบน Google Maps</span>
          <div className="flex gap-2">
            <button type="button" onClick={pinCurrentLocation} className="rounded-full border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">📍 ใช้ตำแหน่งปัจจุบัน</button>
            {details.location && <button type="button" onClick={() => onChange({ ...details, location: undefined })} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">ล้างหมุด</button>}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{details.location ? `ปักหมุดแล้ว (${details.location.lat}, ${details.location.lng})` : 'ยังไม่ได้ปักหมุด แผนที่จะแสดงตามที่อยู่ที่กรอก'}</p>
        {locationStatus && <p role="status" className="mt-1 text-xs text-amber-700">{locationStatus}</p>}
        <AddressMap details={details} className="mt-3" />
      </div>

      {activePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPicker(null)} onKeyDown={(event) => event.key === 'Escape' && setPicker(null)}>
          <div role="dialog" aria-modal="true" aria-label={activePicker.title} onClick={(event) => event.stopPropagation()} className="flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-base font-semibold text-slate-900">{activePicker.title}</p>
              <button type="button" onClick={() => setPicker(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-900">ปิด</button>
            </div>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา" className="mx-4 mt-3 rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:outline-none" />
            <ul className="mt-2 overflow-y-auto pb-2">
              {filteredOptions.length ? filteredOptions.map((option) => (
                <li key={option}>
                  <button type="button" onClick={() => { activePicker.select(option); setPicker(null); }} className={`flex w-full items-center justify-between px-4 py-3 text-left text-base hover:bg-slate-50 ${option === activePicker.value ? 'font-semibold text-brand-700' : 'text-slate-800'}`}>
                    {option}{option === activePicker.value && <span aria-hidden="true">✓</span>}
                  </button>
                </li>
              )) : <li className="px-4 py-3 text-sm text-slate-500">ไม่พบรายการ</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
