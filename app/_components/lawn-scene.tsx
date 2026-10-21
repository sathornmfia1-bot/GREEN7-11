// ภาพประกอบเส้นหน้าแรก: บ้าน รั้ว ต้นไม้ รถกระบะลากรถตัดหญ้า บนแถบสนามหญ้าสีเขียว
const line = { stroke: '#64748b', strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Tree({ x, base, r }: { x: number; base: number; r: number }) {
  const cy = base - r * 2.3;
  return (
    <g>
      <circle cx={x} cy={cy} r={r + 9} fill="none" stroke="#94a3b8" strokeWidth="2" />
      <circle cx={x} cy={cy} r={r} fill="#0ab463" />
      <path d={`M${x} ${cy + r * 0.2} V${base + 14} M${x} ${cy + r * 0.7} l-${r * 0.35} -${r * 0.35} M${x} ${cy + r * 0.95} l${r * 0.35} -${r * 0.35}`} {...line} fill="none" />
    </g>
  );
}

export function LawnScene() {
  const pickets = Array.from({ length: 62 }, (_, index) => index * 24);
  return (
    <svg viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" className="block h-40 w-full sm:h-auto" role="img" aria-label="ภาพบ้าน สนามหญ้า และรถตัดหญ้า">
      {/* เนินหญ้าด้านหลัง */}
      <path d="M0 170 C 260 132 470 126 760 146 S 1220 170 1440 136 V260 H0 Z" fill="#e9f8f0" />
      {/* รั้ว */}
      <g stroke="#94a3b8" strokeWidth="2" fill="#fff">
        {pickets.map((x) => <path key={x} d={`M${x + 4} 214 V180 l6 -7 l6 7 V214`} />)}
        <path d="M0 190 H1440 M0 204 H1440" fill="none" />
      </g>

      {/* บ้าน */}
      <g {...line} fill="#fff">
        <path d="M930 214 V128 L998 78 L1066 128 V214 Z" />
        <path d="M914 134 L998 68 L1082 134" fill="none" />
        <rect x="1046" y="74" width="16" height="34" />
        <rect x="982" y="154" width="32" height="60" />
        <rect x="948" y="140" width="24" height="24" />
        <rect x="1024" y="140" width="24" height="24" />
        <path d="M1066 136 H1170 V214 H1066" />
        <path d="M1080 152 H1156 M1080 168 H1156 M1080 184 H1156 M1080 200 H1156" fill="none" />
        <path d="M1056 136 L1118 110 L1180 136" fill="none" />
      </g>

      {/* รถกระบะลากรถตัดหญ้า */}
      <g {...line} fill="#fff">
        <path d="M600 214 V184 Q600 176 608 176 H660 L676 154 H726 Q736 154 740 164 L748 184 H770 Q778 184 778 192 V214 Z" />
        <path d="M684 160 H722 L730 180 H676 Z" fill="#f1f5f9" />
        <path d="M778 206 H812" fill="none" />
        <path d="M812 214 H880 V196 H812 Z" />
        <path d="M824 196 L834 180 H864 L872 196" fill="none" />
        <path d="M864 180 L884 156 M880 152 L892 160" fill="none" />
      </g>
      <g fill="#fff" stroke="#475569" strokeWidth="2.4">
        <circle cx="632" cy="216" r="14" />
        <circle cx="742" cy="216" r="14" />
        <circle cx="832" cy="218" r="9" />
        <circle cx="866" cy="218" r="9" />
      </g>
      <g fill="#94a3b8">
        <circle cx="632" cy="216" r="5" />
        <circle cx="742" cy="216" r="5" />
      </g>

      {/* ต้นไม้ */}
      <Tree x={70} base={214} r={44} />
      <Tree x={520} base={214} r={30} />
      <Tree x={1300} base={214} r={36} />
      <Tree x={1400} base={214} r={52} />

      {/* แถบสนามหญ้า */}
      <path d="M0 226 H1440 V260 H0 Z" fill="#0ab463" />
    </svg>
  );
}
