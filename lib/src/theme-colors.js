const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const toLinear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

const toGamma = (channel) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

const parseHex = (value) => {
  const digits = value.slice(1)
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits
  return [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255)
}

const toHex = ([red, green, blue]) =>
  `#${
    [red, green, blue]
      .map((channel) => Math.round(clamp(channel, 0, 1) * 255).toString(16).padStart(2, '0'))
      .join('')
  }`

const rgbToOklch = (rgb) => {
  const [red, green, blue] = rgb.map(toLinear)
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  const lightness = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short
  const greenRed = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
  const blueYellow = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  const chroma = Math.hypot(greenRed, blueYellow)
  const hue = (Math.atan2(blueYellow, greenRed) * 180 / Math.PI + 360) % 360
  return { l: lightness, c: chroma, h: hue }
}

const oklchToRgb = ({ l, c, h }) => {
  const radians = h * Math.PI / 180
  const greenRed = c * Math.cos(radians)
  const blueYellow = c * Math.sin(radians)
  const long = (l + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3
  const medium = (l - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3
  const short = (l - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ].map(toGamma)
}

const inGamut = (rgb) => rgb.every((channel) => channel >= -0.0001 && channel <= 1.0001)

const fit = (color) => {
  const opaque = { l: clamp(color.l, 0, 1), c: Math.max(color.c, 0), h: color.h }
  if (inGamut(oklchToRgb(opaque))) return opaque
  let low = 0
  let high = opaque.c
  for (let step = 0; step < 16; step++) {
    const middle = (low + high) / 2
    if (inGamut(oklchToRgb({ ...opaque, c: middle }))) low = middle
    else high = middle
  }
  return { ...opaque, c: low }
}

const hex = (color) => toHex(oklchToRgb(fit(color)))

const relativeLuminance = (rgb) => {
  const [red, green, blue] = rgb.map(toLinear)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrastRatio = (first, second) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

const shiftLightness = (color, delta) => ({ ...color, l: clamp(color.l + delta, 0.02, 0.99) })

const WHITE_TEXT_CONTRAST = 3

const readable = (background) => {
  const backgroundRgb = oklchToRgb(fit(background))
  if (contrastRatio(backgroundRgb, [1, 1, 1]) >= WHITE_TEXT_CONTRAST) return '#ffffff'
  const dark = fit({ l: 0.2, c: Math.min(background.c, 0.04), h: background.h })
  return toHex(oklchToRgb(dark))
}

const PALETTE = {
  gray: { l: 0.62, c: 0.004, h: 270 },
  mauve: { l: 0.62, c: 0.014, h: 310 },
  slate: { l: 0.62, c: 0.016, h: 265 },
  sage: { l: 0.62, c: 0.012, h: 175 },
  olive: { l: 0.62, c: 0.012, h: 130 },
  sand: { l: 0.62, c: 0.012, h: 75 },
  tomato: { l: 0.56, c: 0.19, h: 35 },
  red: { l: 0.55, c: 0.21, h: 27 },
  ruby: { l: 0.54, c: 0.2, h: 15 },
  crimson: { l: 0.53, c: 0.21, h: 5 },
  pink: { l: 0.54, c: 0.2, h: 355 },
  plum: { l: 0.5, c: 0.19, h: 335 },
  purple: { l: 0.48, c: 0.21, h: 315 },
  violet: { l: 0.47, c: 0.2, h: 300 },
  iris: { l: 0.48, c: 0.19, h: 285 },
  indigo: { l: 0.48, c: 0.2, h: 272 },
  blue: { l: 0.55, c: 0.19, h: 258 },
  cyan: { l: 0.58, c: 0.13, h: 220 },
  teal: { l: 0.56, c: 0.12, h: 195 },
  jade: { l: 0.57, c: 0.12, h: 175 },
  green: { l: 0.55, c: 0.15, h: 155 },
  grass: { l: 0.56, c: 0.16, h: 145 },
  bronze: { l: 0.55, c: 0.05, h: 55 },
  gold: { l: 0.57, c: 0.05, h: 85 },
  brown: { l: 0.52, c: 0.08, h: 65 },
  orange: { l: 0.6, c: 0.19, h: 55 },
  amber: { l: 0.83, c: 0.16, h: 80 },
  yellow: { l: 0.9, c: 0.17, h: 100 },
  lime: { l: 0.88, c: 0.18, h: 125 },
  mint: { l: 0.87, c: 0.1, h: 170 },
  sky: { l: 0.85, c: 0.09, h: 230 },
}

export const paletteNames = () => Object.keys(PALETTE)

export const SEMANTIC_SOURCES = {
  'color-success': 'green',
  'color-warning': 'amber',
  'color-info': 'blue',
}

const DANGER_SOURCE = 'red'

let paletteHexes = null

export const paletteTokens = () => (paletteHexes ??= Object.fromEntries(
  Object.entries(PALETTE).map(([name, color]) => [`color-${name}`, hex(color)]),
))

const semanticTokens = () =>
  Object.fromEntries(
    Object.entries(SEMANTIC_SOURCES).map((
      [name, source],
    ) => [name, paletteTokens()[`color-${source}`]]),
  )

const RADIUS_LEVELS = {
  none: { 'radius-item': '0px', 'radius-container': '0px' },
  small: { 'radius-item': '3px', 'radius-container': '6px' },
  medium: { 'radius-item': '6px', 'radius-container': '10px' },
  large: { 'radius-item': '10px', 'radius-container': '16px' },
}

export const radiusSteps = () => Object.keys(RADIUS_LEVELS)

const SHADOW_LEVELS = {
  none: {
    light: ['none', 'none', 'none'],
    dark: ['none', 'none', 'none'],
  },
  soft: {
    light: [
      '0 1px 2px rgb(15 23 42 / 10%)',
      '0 4px 12px rgb(15 23 42 / 12%)',
      '0 12px 32px rgb(15 23 42 / 18%)',
    ],
    dark: [
      '0 1px 2px rgb(0 0 0 / 40%)',
      '0 4px 12px rgb(0 0 0 / 45%)',
      '0 12px 32px rgb(0 0 0 / 55%)',
    ],
  },
  strong: {
    light: [
      '0 1px 3px rgb(15 23 42 / 18%)',
      '0 6px 16px rgb(15 23 42 / 22%)',
      '0 18px 44px rgb(15 23 42 / 30%)',
    ],
    dark: [
      '0 1px 3px rgb(0 0 0 / 55%)',
      '0 6px 16px rgb(0 0 0 / 60%)',
      '0 18px 44px rgb(0 0 0 / 70%)',
    ],
  },
}

export const shadowSteps = () => Object.keys(SHADOW_LEVELS)

const SURFACE_STEPS = {
  light: { surface: 0.995, sunken: 0.97, hover: 0.955, border: 0.86, text: 0.22 },
  dark: { surface: 0.205, sunken: 0.165, hover: 0.26, border: 0.37, text: 0.93 },
}

const NEUTRAL_CHROMA = { surface: 0.004, sunken: 0.008, hover: 0.01, border: 0.022, text: 0.02 }

const neutral = (base, scheme, step) =>
  hex({
    l: SURFACE_STEPS[scheme][step],
    c: Math.min(base.c, NEUTRAL_CHROMA[step]),
    h: base.h,
  })

const solidRamp = (base, scheme, name) => {
  const step = scheme === 'dark' ? 0.055 : -0.055
  return {
    [name]: hex(base),
    [`${name}-hover`]: hex(shiftLightness(base, step)),
    [`${name}-active`]: hex(shiftLightness(base, step * 2)),
    [`color-on-${name.slice('color-'.length)}`]: readable(base),
  }
}

export const isHexColor = (value) => typeof value === 'string' && HEX_COLOR.test(value)

const readBase = (value, fallback) => rgbToOklch(parseHex(isHexColor(value) ? value : fallback))

export const colorSchemeOf = (tokens) => {
  const surface = tokens?.['color-surface']
  if (!isHexColor(surface)) return undefined
  return rgbToOklch(parseHex(surface)).l < 0.5 ? 'dark' : 'light'
}

export const colorTokens = ({ primary, secondary, mode }) => {
  const scheme = mode === 'dark' ? 'dark' : 'light'
  const accent = readBase(primary, '#3b6fe0')
  const base = readBase(secondary, '#6b7280')
  const danger = rgbToOklch(parseHex(paletteTokens()[`color-${DANGER_SOURCE}`]))
  return {
    ...paletteTokens(),
    ...semanticTokens(),
    ...solidRamp(accent, scheme, 'color-primary'),
    ...solidRamp(danger, scheme, 'color-danger'),
    'color-secondary': hex(base),
    'color-text': neutral(base, scheme, 'text'),
    'color-surface': neutral(base, scheme, 'surface'),
    'color-surface-sunken': neutral(base, scheme, 'sunken'),
    'color-surface-hover': neutral(base, scheme, 'hover'),
    'color-border': neutral(base, scheme, 'border'),
    'color-focus-ring': hex(accent),
    'color-link': hex(accent),
    'color-link-hover': hex(shiftLightness(accent, scheme === 'dark' ? 0.055 : -0.055)),
  }
}

export const radiusTokens = (level) => ({
  ...(RADIUS_LEVELS[level] ?? RADIUS_LEVELS.medium),
  'radius-full': '9999px',
})

export const radiusLevelOf = (tokens) =>
  radiusSteps().find((level) => RADIUS_LEVELS[level]['radius-item'] === tokens['radius-item']) ??
    'medium'

export const shadowLevelOf = (tokens, mode) => {
  const scheme = mode === 'dark' ? 'dark' : 'light'
  return shadowSteps().find((level) => SHADOW_LEVELS[level][scheme][1] === tokens['shadow-md']) ??
    'soft'
}

export const shadowTokens = (level, mode) => {
  const scheme = mode === 'dark' ? 'dark' : 'light'
  const [small, medium, large] = (SHADOW_LEVELS[level] ?? SHADOW_LEVELS.soft)[scheme]
  return { 'shadow-sm': small, 'shadow-md': medium, 'shadow-lg': large }
}
