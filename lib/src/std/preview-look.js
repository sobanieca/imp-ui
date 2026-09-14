const fontTokens = {
  'font-family':
    `'Prompt', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  'font-family-mono':
    `'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
  'font-weight-normal': '300',
  'font-weight-bold': '500',
}

const tint = (strength) =>
  `color-mix(in oklch, var(--imp-color-primary) ${strength}%, var(--imp-color-surface))`

const shade = (primaryStrength, secondaryStrength) =>
  `color-mix(in oklch, var(--imp-color-primary) ${primaryStrength}%, ` +
  `color-mix(in oklch, var(--imp-color-secondary) ${secondaryStrength}%, var(--imp-color-surface)))`

const lightTokens = () => {
  const primary = '#3f78ff'
  return {
    'color-primary': primary,
    'color-on-primary': '#ffffff',
    'color-surface-sunken': tint(4),
    'color-surface-hover': tint(20),
    'color-border': shade(8, 10),
    'background-app': tint(10),
  }
}

const darkTokens = () => ({
  'background-app': tint(14),
})

export const previewLook = (scheme) => ({
  ...fontTokens,
  ...(scheme === 'dark' ? darkTokens() : lightTokens()),
})
