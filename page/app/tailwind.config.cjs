/** @type {import('tailwindcss').Config} */

const typescript = require('@tailwindcss/typography')
const daisyui = require('daisyui')

module.exports = {
  content: [
    'index.html',
    './src/**/*.{ts,tsx,mdx}',
    'node_modules/daisyui/dist/**/*.js',
    'node_modules/react-daisyui/dist/**/*.js',
  ],
  plugins: [typescript, daisyui],
}
