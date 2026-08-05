import { defaultTokens } from '../../theme.js'

export const token = (name) => {
  const defaults = defaultTokens()
  if (!Object.hasOwn(defaults, name)) {
    throw new Error(`imp: '${name}' is not a theme token - see the tokens in applyTheme`)
  }
  return `var(--imp-${name}, ${defaults[name]})`
}

export const fontFamily = () => `font-family: ${token('font-family')};`

export const focusRing = () => `
  outline: ${token('focus-ring-width')} solid ${token('color-focus-ring')};
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

const variantRules = (property, variants, valueOf) =>
  `\n${
    variants
      .map(([variant, value]) => `  .${property}-${variant} { ${valueOf(value)} }`)
      .join('\n')
  }\n`

export const TONES = ['default', 'secondary']

export const SIZES = ['sm', 'md', 'lg']

export const WEIGHTS = ['normal', 'medium', 'bold']

export const ALIGNMENTS = ['start', 'center', 'end']

const TONE_TOKENS = [['default', 'color-text'], ['secondary', 'color-secondary']]

const sameNames = (values) => values.map((value) => [value, value])

export const toneRules = () => variantRules('tone', TONE_TOKENS, (name) => `color: ${token(name)}`)

export const sizeRules = () =>
  variantRules('size', sameNames(SIZES), (size) => `font-size: ${token(`font-size-${size}`)}`)

export const weightRules = () =>
  variantRules(
    'weight',
    sameNames(WEIGHTS),
    (weight) => `font-weight: ${token(`font-weight-${weight}`)}`,
  )

export const alignRules = () =>
  variantRules('align', sameNames(ALIGNMENTS), (alignment) => `text-align: ${alignment}`)
