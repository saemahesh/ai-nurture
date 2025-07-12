/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './app.js',
  ],
  theme: {
    extend: {
      fontSize: {
        'icon-sm': '1rem',
        'icon-md': '1.5rem',
        'icon-lg': '2rem',
      },
      spacing: {
        'icon': '2.5rem',
      },
      borderRadius: {
        'xl': '1rem',
      },
    },
  },
  plugins: [],
}

