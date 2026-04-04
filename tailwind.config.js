/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "{.,plans}/**/*.html",
    "./src/**/*.{css,js}",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0073e6',
        'primary-hover': '#2989ea',
        heading: '#004080',
        'text-body': '#333333',
        navy: '#002b5c',
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
