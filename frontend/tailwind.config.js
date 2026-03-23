/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#111111',
          light: '#1A1A1A',
          lighter: '#222222',
        },
        matrix: {
          DEFAULT: '#00FF41',
          dim: '#00CC33',
          dark: '#009926',
          glow: 'rgba(0, 255, 65, 0.15)',
        },
        accent: {
          DEFAULT: '#3B82F6',
          dim: '#2563EB',
        },
        alert: '#FF3333',
        warning: '#EAB308',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'matrix-fall': 'matrix-fall 8s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'matrix-fall': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
