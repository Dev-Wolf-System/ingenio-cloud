import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)',
        },
        border: {
          DEFAULT: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
          soft: 'var(--primary-soft)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.2' }],
        'fluid-kpi': ['clamp(1.5rem, 2.5vw, 3rem)', { lineHeight: '1.1' }],
        'fluid-value': ['clamp(1rem, 1.2vw, 1.5rem)', { lineHeight: '1.2' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      boxShadow: {
        glow: '0 0 24px var(--primary-glow)',
        'glow-ok': '0 0 16px rgba(0, 200, 150, 0.4)',
        'glow-warn': '0 0 16px rgba(255, 176, 32, 0.5)',
        'glow-danger': '0 0 20px rgba(255, 71, 87, 0.6)',
      },
      keyframes: {
        flash: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '20%': { backgroundColor: 'var(--primary-soft)' },
        },
        'pulse-alarm': {
          '0%, 100%': { boxShadow: 'inset 3px 0 0 var(--danger), 0 0 0 0 rgba(255, 71, 87, 0.4)' },
          '50%': { boxShadow: 'inset 3px 0 0 var(--danger), 0 0 0 8px rgba(255, 71, 87, 0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { transform: 'translateY(-100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        flash: 'flash 400ms ease-out',
        'pulse-alarm': 'pulse-alarm 2s ease-in-out infinite',
        'fade-up': 'fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
