/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: {
          100: '#EEF1F6',
          200: '#DDE2EB',
          950: '#070F1F',
          900: '#0B1D3A',
          800: '#122A4D',
          700: '#1C3A63',
          600: '#33507A',
          500: '#52698C',
          400: '#7A8DA8',
          300: '#A8B6C8',
        },
        brand: {
          50: '#EFF5FF',
          100: '#DCE8FE',
          200: '#BFD6FE',
          300: '#93B8FD',
          400: '#6094FA',
          500: '#3B76F6',
          600: '#2459E8',
          700: '#1D46C7',
          800: '#1E3C9E',
          900: '#1E387D',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F7F8FA',
          sunken: '#F2F4F7',
        },
        line: {
          DEFAULT: '#E6E9EF',
          strong: '#D5DAE3',
        },
        success: '#0E9F6E',
        warn: '#C27803',
        danger: '#DC2626',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 29, 58, 0.04), 0 1px 3px rgba(11, 29, 58, 0.03)',
        raised: '0 4px 12px rgba(11, 29, 58, 0.06), 0 1px 3px rgba(11, 29, 58, 0.04)',
        pop: '0 20px 50px -12px rgba(11, 29, 58, 0.22)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: 0.7 },
          '70%': { transform: 'scale(1.4)', opacity: 0 },
          '100%': { transform: 'scale(1.4)', opacity: 0 },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
