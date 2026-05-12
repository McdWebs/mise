import type { Config } from 'tailwindcss'
import servoPreset from '@servo/tokens'
import plugin from 'tailwindcss/plugin'

export default {
  presets: [servoPreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // scrollbar-none utility
    plugin(({ addUtilities }) => {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })
    }),
  ],
} satisfies Config
