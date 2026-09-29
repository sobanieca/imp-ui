const shared = {
  'font-family': "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'font-family-heading': "'Sora', 'IBM Plex Sans', system-ui, sans-serif",
  'radius-item': '0.75rem',
  'radius-container': '1.25rem',
  loader: 'dots',
}

export const auroraLight = {
  base: 'imp-light',
  name: 'aurora-light',
  tokens: {
    ...shared,
    'color-primary': '#6d4aff',
    'color-on-primary': '#ffffff',
    'color-secondary': '#6b6883',
    'color-text': '#1b1530',
    'color-surface': '#ffffff',
    'color-surface-sunken': '#f6f4ff',
    'color-surface-hover': '#f1edff',
    'color-border': '#e7e2f7',
    'color-shadow': '#2a1a78',
    'shadow-sm': '0 1px 2px rgb(42 26 120 / 0.05), 0 8px 24px -12px rgb(76 48 200 / 0.18)',
    'shadow-md': '0 2px 6px rgb(42 26 120 / 0.06), 0 16px 40px -16px rgb(76 48 200 / 0.28)',
    'shadow-lg': '0 4px 12px rgb(42 26 120 / 0.08), 0 32px 80px -24px rgb(76 48 200 / 0.4)',
    'background-app': [
      'radial-gradient(60rem 40rem at 0% -10%, #ebe4ff 0%, transparent 60%)',
      'radial-gradient(50rem 36rem at 100% 0%, #ffe3f3 0%, transparent 55%)',
      'radial-gradient(48rem 40rem at 50% 110%, #dcf1ff 0%, transparent 60%)',
      '#faf9ff',
    ].join(', '),
  },
}

const auroraDark = {
  base: 'imp-dark',
  name: 'aurora-dark',
  tokens: {
    ...shared,
    'color-primary': '#a18dff',
    'color-on-primary': '#140d33',
    'color-secondary': '#a19cc0',
    'color-text': '#eeebff',
    'color-surface': '#171429',
    'color-surface-sunken': '#100e1e',
    'color-surface-hover': '#221e3b',
    'color-border': '#2e2950',
    'color-shadow': '#000000',
    'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px -12px rgb(0 0 0 / 0.6)',
    'shadow-md': '0 2px 6px rgb(0 0 0 / 0.4), 0 16px 40px -16px rgb(0 0 0 / 0.7)',
    'shadow-lg': '0 4px 12px rgb(0 0 0 / 0.5), 0 32px 80px -24px rgb(0 0 0 / 0.8)',
    'background-app': [
      'radial-gradient(60rem 40rem at 0% -10%, #2c1a6b 0%, transparent 60%)',
      'radial-gradient(50rem 36rem at 100% 0%, #4a1640 0%, transparent 55%)',
      'radial-gradient(48rem 40rem at 50% 110%, #0f2d4a 0%, transparent 60%)',
      '#0c0a17',
    ].join(', '),
  },
}

export const THEME_CHOICES = [
  { value: 'aurora-light', label: 'Aurora light', theme: auroraLight },
  { value: 'aurora-dark', label: 'Aurora dark', theme: auroraDark },
]
