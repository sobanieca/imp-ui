import { parseCssColor } from './css-colors.js'
import { contrastRatio, TEXT_CONTRAST_MINIMUM } from './theme-colors.js'

const TEXT_PAIRS = [
  ['color-text', 'color-surface'],
  ['color-text', 'color-surface-sunken'],
  ['color-text', 'color-surface-hover'],
  ['color-text', 'background-app'],
  ['color-heading', 'color-surface'],
  ['color-heading', 'color-surface-sunken'],
  ['color-heading', 'background-app'],
  ['color-secondary', 'color-surface'],
  ['color-secondary', 'color-surface-sunken'],
  ['color-secondary', 'background-app'],
  ['color-primary', 'color-surface'],
  ['color-primary', 'color-surface-sunken'],
  ['color-danger', 'color-surface'],
  ['color-on-primary', 'color-primary'],
  ['color-on-danger', 'color-danger'],
]

const TOKEN_REFERENCE = /^var\(--imp-([a-z0-9-]+)\)$/

const resolvedColor = (tokens, name) => {
  let value = tokens[name]
  for (let depth = 0; depth < 4 && typeof value === 'string'; depth++) {
    const reference = value.trim().match(TOKEN_REFERENCE)
    if (!reference) break
    value = tokens[reference[1]]
  }
  return parseCssColor(value)
}

const roundedRatio = (ratio) => Math.floor(ratio * 100) / 100

const composite = (color, ground) =>
  color.rgb.map((channel, index) => channel * color.alpha + ground[index] * (1 - color.alpha))

const uncheckable = (text, background, token, value, why) => [{
  text,
  background,
  ratio: null,
  reason: `cannot check contrast - ${token} is '${value}', ${why}`,
}]

export const contrastProblems = (tokens) =>
  TEXT_PAIRS.flatMap(([text, background]) => {
    if (tokens[text] === undefined || tokens[background] === undefined) return []
    const textColor = resolvedColor(tokens, text)
    const backgroundColor = resolvedColor(tokens, background)
    if (!backgroundColor) {
      return uncheckable(text, background, background, tokens[background], 'not a colour')
    }
    if (!textColor) return uncheckable(text, background, text, tokens[text], 'not a colour')
    if (backgroundColor.alpha < 1) {
      return uncheckable(text, background, background, tokens[background], 'a translucent colour')
    }
    const ratio = contrastRatio(composite(textColor, backgroundColor.rgb), backgroundColor.rgb)
    return ratio < TEXT_CONTRAST_MINIMUM ? [{ text, background, ratio: roundedRatio(ratio) }] : []
  })
