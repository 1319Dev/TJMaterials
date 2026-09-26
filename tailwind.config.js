/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pmi: {
          bg: 'var(--pmi-bg)',
          card: 'var(--pmi-card)',
          text: 'var(--pmi-text)',
          muted: 'var(--pmi-muted)',
          accent: 'var(--pmi-accent)',
          'accent-text': 'var(--pmi-accent-text)',
          border: 'var(--pmi-border)',
          nav: 'var(--pmi-nav)',
        },
      },
    },
  },
  plugins: [],
};
