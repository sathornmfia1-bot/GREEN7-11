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
      boxShadow: {
        soft: '0 2px 14px rgba(16, 24, 40, 0.08)',
        lift: '0 10px 30px rgba(16, 24, 40, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
