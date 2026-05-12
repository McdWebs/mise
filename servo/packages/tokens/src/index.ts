import type { Config } from 'tailwindcss'

const preset: Partial<Config> = {
  theme: {
    extend: {
      // ── Colors (lifted verbatim from colors_and_type.css) ──────────────────
      colors: {
        paper: {
          DEFAULT: '#FAF6F0',
          '2': '#F3ECE0',
          '3': '#E8DFCF',
          '4': '#D7CBB4',
        },
        ink: {
          DEFAULT: '#1A1612',
          '2': '#2A241D',
          '3': '#3B342B',
          '5': '#6A5E51',
          '6': '#837564',
          '7': '#9A8C7A',
          '8': '#C2B7A6',
        },
        saffron: {
          DEFAULT: '#D97706',
          '2': '#B8620A',
          '3': '#934B07',
          wash: '#FBEFD9',
        },
        ember: {
          DEFAULT: '#B3321A',
          '2': '#962815',
          wash: '#F7D9D3',
        },
        honey: {
          DEFAULT: '#C28A00',
          '2': '#9E7100',
          wash: '#F5E6B7',
        },
        herb: {
          DEFAULT: '#3F7A3A',
          '2': '#2F5E2C',
          wash: '#DCEACE',
        },
        steel: {
          DEFAULT: '#2C5F7F',
          '2': '#224C66',
          wash: '#D6E2EA',
        },
      },

      // ── Typography ─────────────────────────────────────────────────────────
      fontFamily: {
        display: ['Fraunces', 'Newsreader', 'Source Serif Pro', 'Georgia', 'serif'],
        sans: ['Hanken Grotesk', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },

      fontSize: {
        // Body scale
        'body-sm': ['14px', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '400' }],
        'body':    ['16px', { lineHeight: '1.5',  letterSpacing: '0', fontWeight: '400' }],
        'body-lg': ['20px', { lineHeight: '1.5',  letterSpacing: '0', fontWeight: '400' }],
        // Label / label
        'label':    ['13px', { lineHeight: '1.3',  letterSpacing: '0.01em', fontWeight: '500' }],
        'overline': ['11px', { lineHeight: '1.2',  letterSpacing: '0.08em', fontWeight: '600' }],
        // Mono
        'mono': ['13px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        // Heading scale
        'h3': ['20px', { lineHeight: '1.3',  letterSpacing: '0',      fontWeight: '600' }],
        'h2': ['24px', { lineHeight: '1.25', letterSpacing: '-0.005em', fontWeight: '600' }],
        'h1': ['30px', { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '600' }],
        // Display scale
        'display-2': ['40px', { lineHeight: '1.1',  letterSpacing: '-0.015em', fontWeight: '500' }],
        'display-1': ['56px', { lineHeight: '1.05', letterSpacing: '-0.02em',  fontWeight: '500' }],
      },

      // ── Spacing (4px base) ─────────────────────────────────────────────────
      spacing: {
        '1':  '4px',
        '2':  '8px',
        '3':  '12px',
        '4':  '16px',
        '5':  '20px',
        '6':  '24px',
        '8':  '32px',
        '10': '40px',
        '14': '56px',
        '20': '80px',
      },

      // ── Border radius ──────────────────────────────────────────────────────
      borderRadius: {
        'none': '0',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        'pill': '999px',
        // Keep Tailwind's semantic names mapped to our scale
        'sm': '4px',
        DEFAULT: '8px',
        'md': '8px',
        'lg': '12px',
        'full': '9999px',
      },

      // ── Shadows ────────────────────────────────────────────────────────────
      boxShadow: {
        'none': 'none',
        '1': '0 1px 2px rgba(26,22,18,0.04), 0 4px 12px rgba(26,22,18,0.06)',
        '2': '0 4px 24px rgba(26,22,18,0.12)',
        // semantic aliases
        DEFAULT: '0 1px 2px rgba(26,22,18,0.04), 0 4px 12px rgba(26,22,18,0.06)',
        'sm': '0 1px 2px rgba(26,22,18,0.04), 0 4px 12px rgba(26,22,18,0.06)',
        'md': '0 1px 2px rgba(26,22,18,0.04), 0 4px 12px rgba(26,22,18,0.06)',
        'lg': '0 4px 24px rgba(26,22,18,0.12)',
      },

      // ── Motion ─────────────────────────────────────────────────────────────
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'press':    '80ms',
        'hover':    '120ms',
        'standard': '160ms',
        'large':    '260ms',
      },

      // ── Animation ─────────────────────────────────────────────────────────
      keyframes: {
        'order-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0px rgba(217,119,6,0)' },
          '50%':       { boxShadow: '0 0 0 8px rgba(217,119,6,0.35)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
      },
      animation: {
        'order-pulse': 'order-pulse 600ms cubic-bezier(0.2,0.8,0.2,1)',
        'fade-in':     'fade-in 160ms cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-up':    'slide-up 260ms cubic-bezier(0.2,0.8,0.2,1) both',
      },
    },
  },
}

export default preset
