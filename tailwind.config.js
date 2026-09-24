/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dalkia: {
          blue: '#002E6D',
          lightBlue: '#0072CE',
          orange: '#FF5E00',
          dark: '#0A1628',
          card: '#10223A',
          border: '#1E3A5F'
        }
      }
    },
  },
  plugins: [],
}
