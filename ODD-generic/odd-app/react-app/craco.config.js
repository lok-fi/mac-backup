// CRA 5 doesn't read a project postcss.config.js, so inject Tailwind +
// autoprefixer through CRACO's PostCSS loaderOptions (CRACO 7 API).
module.exports = {
  style: {
    postcss: {
      mode: 'extends',
      loaderOptions: {
        postcssOptions: {
          ident: 'postcss',
          plugins: [require('tailwindcss'), require('autoprefixer')],
        },
      },
    },
  },
};
