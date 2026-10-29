/** Palette follows a 60-30-10 split:
 *  60% warm paper neutrals, 30% deep moss green (brand, text accents),
 *  10% saffron / clay (data highlights and one-off emphasis).
 *  Every text/background pair below is >= 4.5:1 contrast (WCAG AA). */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F2E9',
        card: '#FFFDF8',
        line: '#E2DACB',
        ink: '#1F2B24',
        soft: '#56635B',
        moss: { DEFAULT: '#25513B', dark: '#1B3D2C', tint: '#E4EEE6' },
        saffron: { DEFAULT: '#C77A12', tint: '#FBEBD0' },
        clay: { DEFAULT: '#A8472F', tint: '#F6E0D8' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
