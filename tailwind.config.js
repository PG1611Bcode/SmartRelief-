/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: { DEFAULT: '#34D399', dim: '#10B981', glow: 'rgba(52,211,153,0.15)' },
        zinc: { 950: '#09090B' }
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      borderRadius: { '5xl': '2.5rem' },
    }
  },
  plugins: [],
}
