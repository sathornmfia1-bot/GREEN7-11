'use client';

import { useState } from 'react';
import { StatTile } from '../../_components/stat-tile';
import type { CustomerAccount, MechanicAccount } from '../../_lib/types';
import { money } from '../../_lib/rules';

type Level = 'province' | 'amphoe';
type Area = { province: string; amphoe: string };
type Row = { key: string; province: string; amphoe: string; customers: number; mechanics: number; verified: number; pending: number };

const unknownArea = 'ไม่ระบุพื้นที่';

// พื้นที่ของลูกค้า = ที่อยู่หลัก (ถ้าไม่ได้ตั้ง ใช้ที่อยู่แรก) · ช่าง = ที่อยู่ตั้งต้นที่ใช้รับงาน
function customerArea(customer: CustomerAccount): Area {
  const address = customer.addresses.find((item) => item.isDefault) ?? customer.addresses[0];
  return { province: address?.details.province || unknownArea, amphoe: address?.details.amphoe || unknownArea };
}

function mechanicArea(mechanic: MechanicAccount): Area {
  return { province: mechanic.baseAddress.province || unknownArea, amphoe: mechanic.baseAddress.amphoe || unknownArea };
}

function amphoeLabel(row: Pick<Row, 'province' | 'amphoe'>) {
  if (row.amphoe === unknownArea) return unknownArea;
  return `${row.province === 'กรุงเทพมหานคร' ? 'เขต' : 'อำเภอ'}${row.amphoe}`;
}

function buildRows(customers: CustomerAccount[], mechanics: MechanicAccount[], level: Level): Row[] {
  const rows = new Map<string, Row>();
  const rowFor = (area: Area) => {
    const key = level === 'province' ? area.province : `${area.province}|${area.amphoe}`;
    let row = rows.get(key);
    if (!row) {
      row = { key, province: area.province, amphoe: level === 'province' ? '' : area.amphoe, customers: 0, mechanics: 0, verified: 0, pending: 0 };
      rows.set(key, row);
    }
    return row;
  };
  customers.forEach((customer) => { rowFor(customerArea(customer)).customers += 1; });
  mechanics.forEach((mechanic) => {
    const row = rowFor(mechanicArea(mechanic));
    row.mechanics += 1;
    if (mechanic.status === 'verified') row.verified += 1;
    if (mechanic.status === 'pending_verification') row.pending += 1;
  });
  // ไม่ระบุพื้นที่ไว้ท้ายสุด · ที่เหลือเรียงตามจำนวนลูกค้า แล้วตามจำนวนช่าง แล้วตามชื่อ
  return [...rows.values()].sort((a, b) =>
    Number(a.province === unknownArea) - Number(b.province === unknownArea)
    || b.customers - a.customers || b.mechanics - a.mechanics
    || a.province.localeCompare(b.province, 'th') || a.amphoe.localeCompare(b.amphoe, 'th'));
}

function coverage(row: Row) {
  if (row.customers > 0 && row.verified === 0) return { text: row.pending ? 'ช่างรออนุมัติ' : 'ยังไม่มีช่าง', className: 'bg-rose-100 text-rose-800' };
  if (row.customers === 0 && row.mechanics > 0) return { text: 'ยังไม่มีลูกค้า', className: 'bg-sky-100 text-sky-800' };
  return { text: 'มีทั้งลูกค้าและช่าง', className: 'bg-emerald-100 text-emerald-800' };
}

function downloadCsv(rows: Row[], level: Level) {
  const header = level === 'province' ? ['จังหวัด'] : ['จังหวัด', 'เขต/อำเภอ'];
  const lines = [
    [...header, 'ลูกค้า (ราย)', 'ช่างทั้งหมด (ราย)', 'ช่างอนุมัติแล้ว', 'ช่างรอตรวจสอบ', 'ลูกค้าต่อช่างที่อนุมัติ'],
    ...rows.map((row) => [
      row.province,
      ...(level === 'province' ? [] : [amphoeLabel(row)]),
      row.customers, row.mechanics, row.verified, row.pending,
      row.verified && row.customers ? (row.customers / row.verified).toFixed(1) : '-',
    ]),
  ];
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  // BOM ให้ Excel อ่านภาษาไทยถูก
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `รายงานลูกค้าและช่าง-${level === 'province' ? 'รายจังหวัด' : 'รายเขตอำเภอ'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// แถบเทียบจำนวนในแถว (สเกลตามค่าสูงสุดของตาราง)
function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="tabular-nums text-slate-900">{money(value)}</span>
      <span aria-hidden="true" className="hidden h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:block">
        <span className={`block h-full rounded-full ${className}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </span>
    </span>
  );
}

export function AreaReport({ customers, mechanics }: { customers: CustomerAccount[]; mechanics: MechanicAccount[] }) {
  const [level, setLevel] = useState<Level>('province');
  const [province, setProvince] = useState('');
  const [gapsOnly, setGapsOnly] = useState(false);

  const provinceRows = buildRows(customers, mechanics, 'province');
  const amphoeRows = buildRows(customers, mechanics, 'amphoe');
  const rows = (level === 'province' ? provinceRows : amphoeRows)
    .filter((row) => level === 'province' || !province || row.province === province)
    .filter((row) => !gapsOnly || (row.customers > 0 && row.verified === 0));
  const maxCustomers = Math.max(0, ...rows.map((row) => row.customers));
  const maxMechanics = Math.max(0, ...rows.map((row) => row.mechanics));
  const totals = rows.reduce((sum, row) => ({ customers: sum.customers + row.customers, mechanics: sum.mechanics + row.mechanics, verified: sum.verified + row.verified }), { customers: 0, mechanics: 0, verified: 0 });

  const known = provinceRows.filter((row) => row.province !== unknownArea);
  const gapAreas = amphoeRows.filter((row) => row.province !== unknownArea && row.customers > 0 && row.verified === 0);
  const unknownCount = customers.filter((customer) => customerArea(customer).province === unknownArea).length + mechanics.filter((mechanic) => mechanicArea(mechanic).province === unknownArea).length;

  return (
    <section aria-label="รายงานลูกค้าและช่างตามพื้นที่">
      <p className="mb-4 text-sm text-slate-600">จำนวนลูกค้าและช่างตัดหญ้าในแต่ละพื้นที่ · ลูกค้านับตามที่อยู่หลัก · ช่างนับตามที่อยู่ตั้งต้นที่ใช้รับงาน</p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="จังหวัดที่มีลูกค้า" value={`${known.filter((row) => row.customers > 0).length} จังหวัด`} hint={`ลูกค้าทั้งหมด ${money(customers.length)} ราย`} />
        <StatTile label="จังหวัดที่มีช่าง" value={`${known.filter((row) => row.mechanics > 0).length} จังหวัด`} hint={`ช่างทั้งหมด ${money(mechanics.length)} ราย · อนุมัติแล้ว ${money(mechanics.filter((item) => item.status === 'verified').length)}`} />
        <StatTile emphasis={gapAreas.length > 0} label="เขต/อำเภอที่ยังไม่มีช่าง" value={`${gapAreas.length} พื้นที่`} hint={`มีลูกค้า ${money(gapAreas.reduce((sum, row) => sum + row.customers, 0))} ราย แต่ไม่มีช่างที่อนุมัติแล้ว`} />
        <StatTile label="ไม่ระบุพื้นที่" value={`${unknownCount} ราย`} hint="ลูกค้า/ช่างที่ยังไม่มีที่อยู่" />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="flex rounded-full border border-slate-200 p-0.5" role="tablist" aria-label="ระดับพื้นที่">
            {([['province', 'รายจังหวัด'], ['amphoe', 'รายเขต/อำเภอ']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={level === value} onClick={() => setLevel(value)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${level === value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
            ))}
          </div>
          {level === 'amphoe' && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              จังหวัด
              <select value={province} onChange={(event) => setProvince(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:border-brand-500 focus:outline-none">
                <option value="">ทุกจังหวัด</option>
                {provinceRows.map((row) => <option key={row.province} value={row.province}>{row.province}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={gapsOnly} onChange={(event) => setGapsOnly(event.target.checked)} className="h-4 w-4 accent-brand-500" />
            เฉพาะพื้นที่ที่ยังไม่มีช่าง
          </label>
          <button type="button" onClick={() => downloadCsv(rows, level)} disabled={!rows.length} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-brand-500 disabled:opacity-50">⬇ ดาวน์โหลด CSV</button>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">{level === 'province' ? 'จังหวัด' : 'เขต/อำเภอ'}</th>
                  <th className="px-4 py-3 text-right font-medium">ลูกค้า (ราย)</th>
                  <th className="px-4 py-3 text-right font-medium">ช่างตัดหญ้า (ราย)</th>
                  <th className="px-4 py-3 text-right font-medium">ลูกค้าต่อช่าง</th>
                  <th className="px-4 py-3 font-medium">สถานะพื้นที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const status = coverage(row);
                  return (
                    <tr key={row.key}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{level === 'province' ? row.province : amphoeLabel(row)}</span>
                        {level === 'amphoe' && !province && <span className="block text-xs text-slate-500">{row.province}</span>}
                      </td>
                      <td className="px-4 py-3"><Bar value={row.customers} max={maxCustomers} className="bg-brand-500" /></td>
                      <td className="px-4 py-3">
                        <Bar value={row.mechanics} max={maxMechanics} className="bg-accent-500" />
                        {row.mechanics > 0 && <span className="block text-right text-xs text-slate-500">อนุมัติ {row.verified}{row.pending ? ` · รอตรวจ ${row.pending}` : ''}</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.verified && row.customers ? (row.customers / row.verified).toFixed(1) : '–'}</td>
                      <td className="px-4 py-3"><span className={`badge ${status.className}`}>{status.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">รวม {rows.length} พื้นที่</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.customers)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.mechanics)} <span className="block text-xs font-normal text-slate-500">อนุมัติ {totals.verified}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.verified ? (totals.customers / totals.verified).toFixed(1) : '–'}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-slate-600">{gapsOnly ? 'ทุกพื้นที่ที่มีลูกค้ามีช่างที่อนุมัติแล้ว' : 'ยังไม่มีข้อมูลลูกค้าหรือช่าง'}</p>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">ลูกค้าต่อช่าง = จำนวนลูกค้า ÷ ช่างที่อนุมัติแล้วในพื้นที่ · ตัวเลขยิ่งสูง แปลว่าควรหาช่างเพิ่มในพื้นที่นั้น</p>
    </section>
  );
}
