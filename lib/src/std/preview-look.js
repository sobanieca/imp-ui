const typeTokens = {
  'font-family': `'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  'font-family-mono': `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
  'font-family-heading': `'Sora', system-ui, sans-serif`,
  'font-size-sm': '0.8125rem',
  'font-size-md': '0.875rem',
  'font-size-lg': '1rem',
  'font-size-xl': '1.375rem',
  'font-size-2xl': '2rem',
  'font-weight-normal': '400',
  'font-weight-bold': '600',
  'line-height-tight': '1.2',
  'line-height-normal': '1.57',
}

const shapeTokens = {
  'icon-stroke-width': '1.5',
  'radius-item': '4px',
  'radius-container': '8px',
  'shadow-sm': 'none',
  'shadow-md': 'none',
  'shadow-lg': '0 8px 24px rgb(from var(--imp-color-shadow) r g b / 18%)',
}

export const MAIN_1 = '#d700d1'
export const MAIN_2 = '#ee4b00'
export const MAIN_3 = '#0078ea'

const lightColorTokens = {
  'background-app': '#fafafa',
  'color-surface': '#ffffff',
  'color-surface-sunken': '#f1f1f4',
  'color-surface-hover': '#e3e3e8',
  'color-border': '#e3e3e8',
  'color-text': '#101010',
  'color-heading': 'var(--imp-color-text)',
  'color-secondary': '#5b5b63',
  'color-primary': '#101010',
  'color-on-primary': '#ffffff',
  'color-info': '#0063c4',
  'color-success': '#137a3a',
  'color-warning': '#8a5a00',
  'color-danger': '#c62828',
  'color-on-danger': '#ffffff',
  'color-shadow': '#101010',
}

const darkColorTokens = {
  'background-app': '#101010',
  'color-surface': '#18181b',
  'color-surface-sunken': '#222226',
  'color-surface-hover': '#2e2e33',
  'color-border': '#2e2e33',
  'color-text': '#fafafa',
  'color-heading': 'var(--imp-color-text)',
  'color-secondary': '#a3a3ad',
  'color-primary': '#fafafa',
  'color-on-primary': '#101010',
  'color-info': '#5aa9ff',
  'color-success': '#4cc47a',
  'color-warning': '#e0a53a',
  'color-danger': '#ff6b6b',
  'color-on-danger': '#101010',
  'color-shadow': '#000000',
}

export const previewLook = (scheme) => ({
  ...typeTokens,
  ...shapeTokens,
  ...(scheme === 'dark' ? darkColorTokens : lightColorTokens),
})
