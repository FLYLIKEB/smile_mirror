module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
        sm: '4px',
      },
      backgroundColor: {
        'black-50': 'rgba(0, 0, 0, 0.5)',
        'gray-800-80': 'rgba(31, 41, 55, 0.8)',
      }
    },
  },
  plugins: [],
} 