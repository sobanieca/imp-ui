import { defaultTokens } from '../../theme.js'

const REFERENCE = /^var\(--imp-([a-z0-9-]+)\)$/

const defaultOf = (name) => {
  const defaults = defaultTokens()
  if (!Object.hasOwn(defaults, name)) {
    throw new Error(`imp: '${name}' is not a theme token - see the tokens in applyTheme`)
  }
  const referenced = REFERENCE.exec(defaults[name])
  return referenced === null ? defaults[name] : defaultOf(referenced[1])
}

export const token = (name) => `var(--imp-${name}, ${defaultOf(name)})`

const shaded = (name, amount) =>
  `color-mix(in oklab, ${token(name)}, ${token('color-text')} ${amount})`

export const hoverColor = (name) => shaded(name, '12%')

export const activeColor = (name) => shaded(name, '24%')

export const quietScrollbar = () => `
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklch, ${token('color-text')} 28%, transparent) transparent;
`

export const fontFamily = () => `
  font-family: ${token('font-family')};
  font-weight: ${token('font-weight-normal')};
`

export const focusRing = () => `
  outline: ${token('focus-ring-width')} solid ${token('color-primary')};
  outline-offset: 2px;
`

const CORNER_START = '--imp-corner-inline-start'

const CORNER_END = '--imp-corner-inline-end'

const SEAM_SHIFT = '--imp-seam-shift'

const SEAM_LIFT = '--imp-seam-lift'

export const groupableSeam = () => `
  border-start-start-radius: var(${CORNER_START}, ${token('radius-item')});
  border-end-start-radius: var(${CORNER_START}, ${token('radius-item')});
  border-start-end-radius: var(${CORNER_END}, ${token('radius-item')});
  border-end-end-radius: var(${CORNER_END}, ${token('radius-item')});
  margin-inline-start: var(${SEAM_SHIFT}, 0);
`

export const seamLift = (control) => `
  ${control}:hover,
  ${control}:focus-visible {
    z-index: var(${SEAM_LIFT}, auto);
  }
`

export const seamReset = () => `
  ${CORNER_START}: initial;
  ${CORNER_END}: initial;
  ${SEAM_SHIFT}: initial;
  ${SEAM_LIFT}: initial;
`

export const groupSeamRules = (row) => `
  ${row} > * {
    ${SEAM_LIFT}: 1;
  }

  ${row} > *:not(:first-child) {
    ${CORNER_START}: 0;
    ${SEAM_SHIFT}: calc(-1 * ${token('border-width')});
  }

  ${row} > *:not(:last-child) {
    ${CORNER_END}: 0;
  }
`

export const forcedColors = `
  @media (forced-colors: active) {
    button, input, select, textarea { border-color: ButtonBorder }
    button:disabled, input:disabled, select:disabled, textarea:disabled { color: GrayText }
  }
`

export const visuallyHidden = `
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

export const hiddenRule = `
  [hidden] { display: none !important }
`

const variantRules = (property, variants, valueOf) =>
  `\n${
    variants
      .map(([variant, value]) => `  .${property}-${variant} { ${valueOf(value)} }`)
      .join('\n')
  }\n`

export const TONES = ['default', 'secondary']

export const SIZES = ['sm', 'md', 'lg']

export const WEIGHTS = ['normal', 'bold']

export const ALIGNMENTS = ['start', 'center', 'end']

const TONE_TOKENS = [['default', 'color-text'], ['secondary', 'color-secondary']]

const sameNames = (values) => values.map((value) => [value, value])

export const toneRules = () => variantRules('tone', TONE_TOKENS, (name) => `color: ${token(name)}`)

export const sizeRules = () =>
  variantRules('size', sameNames(SIZES), (size) => `font-size: ${token(`font-size-${size}`)}`)

export const controlPaddingRules = () => `
  .size-sm {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
  }

  .size-md {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
  }

  .size-lg {
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-5')};
  }

  .square.size-sm {
    padding-inline: ${token('space-1')};
  }

  .square.size-md {
    padding-inline: ${token('space-2')};
  }

  .square.size-lg {
    padding-inline: ${token('space-3')};
  }
`

export const weightRules = () =>
  variantRules(
    'weight',
    sameNames(WEIGHTS),
    (weight) => `font-weight: ${token(`font-weight-${weight}`)}`,
  )

export const alignRules = () =>
  variantRules('align', sameNames(ALIGNMENTS), (alignment) => `text-align: ${alignment}`)
