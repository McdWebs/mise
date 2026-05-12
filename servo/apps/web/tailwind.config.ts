import type { Config } from 'tailwindcss'
import servoPreset from '@servo/tokens'

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
  plugins: [],
} satisfies Config
