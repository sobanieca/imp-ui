export const FONT_STACK =
  `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

export const fontFamily = `font-family: var(--imp-font-family, ${FONT_STACK});`

export const focusRing = `
  outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
  outline-offset: 2px;
`

export const forcedColors = `
  @media (forced-colors: active) {
    button, input, select, textarea { border-color: ButtonBorder }
    button:disabled, input:disabled, select:disabled, textarea:disabled { color: GrayText }
  }
`

export const hiddenRule = `
  [hidden] { display: none }
`

export const toneRules = `
  .tone-default { color: var(--imp-color-text, #0f172a) }
  .tone-secondary { color: var(--imp-color-secondary, #64748b) }
`

export const sizeRules = `
  .size-sm { font-size: var(--imp-font-size-sm, 0.875rem) }
  .size-md { font-size: var(--imp-font-size-md, 1rem) }
  .size-lg { font-size: var(--imp-font-size-lg, 1.125rem) }
`

export const weightRules = `
  .weight-normal { font-weight: var(--imp-font-weight-normal, 400) }
  .weight-medium { font-weight: var(--imp-font-weight-medium, 500) }
  .weight-bold { font-weight: var(--imp-font-weight-bold, 700) }
`

export const alignRules = `
  .align-start { text-align: start }
  .align-center { text-align: center }
  .align-end { text-align: end }
`

export const TONES = ['default', 'secondary']

export const SIZES = ['sm', 'md', 'lg']

export const WEIGHTS = ['normal', 'medium', 'bold']

export const ALIGNMENTS = ['start', 'center', 'end']
