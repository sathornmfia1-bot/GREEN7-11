'use client';

import { useState } from 'react';
import type { Bucket } from './earnings';

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

function compact(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}K`;
  return String(value);
}

function niceMax(value: number) {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

// คอลัมน์ชุดเดียว (single series) — สีเดียว, แท่งบาง, มี tooltip และมุมมองตาราง
export function ColumnChart({ title, buckets, valueLabel, color = '#1ea860' }: { title: string; buckets: Bucket[]; valueLabel: string; color?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const width = 640;
  const height = 220;
  const margin = { top: 24, right: 8, bottom: 28, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(...buckets.map((bucket) => bucket.value)));
  const band = plotWidth / buckets.length;
  const barWidth = Math.min(24, band * 0.6);
  const y = (value: number) => margin.top + plotHeight - (value / max) * plotHeight;
  const ticks = [0, max / 2, max];
  const labelEvery = buckets.length > 8 ? 2 : 1;
  const peakIndex = buckets.reduce((best, bucket, index) => (bucket.value > buckets[best].value ? index : best), 0);
  const active = hovered !== null ? buckets[hovered] : null;

  return (
    <figure className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-semibold text-slate-900">{title}</figcaption>
        <button type="button" onClick={() => setShowTable(!showTable)} className="text-sm font-medium text-brand-700 hover:underline">{showTable ? 'ดูเป็นกราฟ' : 'ดูเป็นตาราง'}</button>
      </div>
      {showTable ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-2 font-medium">ช่วงเวลา</th><th className="py-2 text-right font-medium">จำนวนงาน</th><th className="py-2 text-right font-medium">{valueLabel}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((bucket) => <tr key={bucket.key}><td className="py-2 text-slate-700">{bucket.detail}</td><td className="py-2 text-right tabular-nums text-slate-700">{bucket.count}</td><td className="py-2 text-right tabular-nums font-medium text-slate-900">฿{money(bucket.value)}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${title} · สูงสุด ฿${money(buckets[peakIndex]?.value ?? 0)} ช่วง ${buckets[peakIndex]?.detail ?? ''}`} onPointerLeave={() => setHovered(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={1} />
                <text x={margin.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#64748b" className="tabular-nums">{compact(tick)}</text>
              </g>
            ))}
            {buckets.map((bucket, index) => {
              const center = margin.left + band * index + band / 2;
              const top = y(bucket.value);
              const barHeight = margin.top + plotHeight - top;
              const radius = Math.min(4, barHeight);
              const left = center - barWidth / 2;
              const baseline = margin.top + plotHeight;
              return (
                <g
                  key={bucket.key}
                  tabIndex={0}
                  role="button"
                  aria-label={`${bucket.detail}: ฿${money(bucket.value)} จาก ${bucket.count} งาน`}
                  onPointerEnter={() => setHovered(index)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  className="cursor-default outline-none"
                >
                  <rect x={margin.left + band * index} y={margin.top} width={band} height={plotHeight} fill="transparent" />
                  {bucket.value > 0 && (
                    <path
                      d={`M${left},${baseline} V${top + radius} Q${left},${top} ${left + radius},${top} H${left + barWidth - radius} Q${left + barWidth},${top} ${left + barWidth},${top + radius} V${baseline} Z`}
                      fill={color}
                      opacity={hovered === null || hovered === index ? 1 : 0.45}
                    />
                  )}
                  {index === peakIndex && bucket.value > 0 && <text x={center} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">{compact(bucket.value)}</text>}
                  {index % labelEvery === (buckets.length - 1) % labelEvery && <text x={center} y={height - 8} textAnchor="middle" fontSize={11} fill="#64748b">{bucket.label}</text>}
                </g>
              );
            })}
          </svg>
          {active && hovered !== null && (
            <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg" style={{ left: `${((margin.left + band * hovered + band / 2) / width) * 100}%` }}>
              <p className="text-sm font-bold text-slate-900">฿{money(active.value)}</p>
              <p className="text-slate-600">{valueLabel} · {active.count} งาน</p>
              <p className="text-slate-500">{active.detail}</p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
