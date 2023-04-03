const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const tailwindcss = require('tailwindcss')

const nodeEnv = process.env.NODE_ENV || 'development'

const plugins = [tailwindcss, autoprefixer, ...(nodeEnv === 'production' ? [cssnano] : [])]

module.exports = {
  plugins,
}
