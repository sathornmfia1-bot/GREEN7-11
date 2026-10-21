import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // เขียวแบรนด์ (สไตล์บริการดูแลสนามหญ้า) และส้มสำหรับปุ่มหลัก (CTA)
        brand: {
          50: '#ecfbf3',
          100: '#d3f5e2',
          200: '#a8ebc6',
          300: '#6fdc9f',
          500: '#0ab463',
          600: '#09a058',
          700: '#07804a',
          800: '#06663b',
          900: '#064e30',
        },
        accent: {
          400: '#ffad33',
          500: '#fd9802',
          600: '#e48700',
        },
        ink: '#111827',
        slate: {
          950: '#081b16',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
      },
      // ระยะบรรทัดแบบสัดส่วน (เท่าค่าเดิมของ Tailwind) — ขยายตามตัวอักษรเมื่อผู้ใช้ตั้งฟอนต์ใหญ่บนมือถือ บรรทัดไม่ทับกัน
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.3333' }],
        sm: ['0.875rem', { lineHeight: '1.4286' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.5556' }],
        xl: ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3333' }],
        '3xl': ['1.875rem', { lineHeight: '1.2' }],
        '4xl': ['2.25rem', { lineHeight: '1.1111' }],
      },
      boxShadow: {
        soft: '0 2px 14px rgba(16, 24, 40, 0.08)',
        lift: '0 10px 30px rgba(16, 24, 40, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
