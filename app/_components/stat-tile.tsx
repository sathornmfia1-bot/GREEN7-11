export function StatTile({ label, value, hint, emphasis = false }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className={`card p-4 ${emphasis ? 'ring-2 ring-brand-500' : ''}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 font-bold text-slate-900 ${emphasis ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PeriodFilter<T extends number>({ value, options, onChange }: { value: T; options: { days: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลา">
      {options.map((option) => (
        <button key={option.days} type="button" aria-pressed={value === option.days} onClick={() => onChange(option.days)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${value === option.days ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
          {value === option.days && <span aria-hidden="true" className="mr-1 font-bold">✓</span>}{option.label}
        </button>
      ))}
    </div>
  );
}
