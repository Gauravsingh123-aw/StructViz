/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#b9d9ff',
          300: '#8cc1ff',
          400: '#5aa1ff',
          500: '#2f7eff',
          600: '#1d63e6',
          700: '#164fba',
          800: '#153f91',
          900: '#133875'
        },
        accent: {
          500: '#12b981'
        }
      },
      boxShadow: {
        soft: '0 8px 24px rgba(16,24,40,0.08)'
      }
    },
  },
  plugins: [],
}; 