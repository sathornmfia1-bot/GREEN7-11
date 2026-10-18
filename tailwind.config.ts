import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4fdf5',
          100: '#e7f9eb',
          500: '#2fbf71',
          600: '#1ea860',
          700: '#187d49',
        },
        accent: {
          500: '#0f766e',
        },
        ink: '#102a22',
        slate: {
          950: '#081b16',
        },
      },
      boxShadow: {
        soft: '0 14px 30px rgba(15, 118, 110, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
