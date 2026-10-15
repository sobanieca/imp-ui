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
  `#${[red, green, blue]
    .map((channel) =>
      Math.round(clamp(channel, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

const rgbToOklch = (rgb) => {
  const [red, green, blue] = rgb.map(toLinear)
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  const lightness = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short
  const greenRed = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
  const blueYellow = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  const chroma = Math.hypot(greenRed, blueYellow)
  const hue = ((Math.atan2(blueYellow, greenRed) * 180) / Math.PI + 360) % 360
  return { l: lightness, c: chroma, h: hue }
}

export const oklabToLinearSrgb = ([lightness, greenRed, blueYellow]) => {
  const long = (lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3
  const medium = (lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3
  const short = (lightness - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ]
}

const oklchToRgb = ({ l, c, h }) => {
  const radians = (h * Math.PI) / 180
  return oklabToLinearSrgb([l, c * Math.cos(radians), c * Math.sin(radians)]).map(toGamma)
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

export const contrastRatio = (first, second) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

export const TEXT_CONTRAST_MINIMUM = 4.5

const WHITE = [1, 1, 1]

const emitted = (color) => parseHex(hex(color))

const darkTint = (background) => ({ l: 0.2, c: Math.min(background.c, 0.04), h: background.h })

const readable = (background) => {
  const backgroundRgb = emitted(background)
  const whiteContrast = contrastRatio(backgroundRgb, WHITE)
  if (whiteContrast >= TEXT_CONTRAST_MINIMUM) return '#ffffff'
  const tint = hex(darkTint(background))
  return contrastRatio(backgroundRgb, parseHex(tint)) > whiteContrast ? tint : '#ffffff'
}

const carriesText = (color) =>
  contrastRatio(emitted(color), parseHex(readable(color))) >= TEXT_CONTRAST_MINIMUM

const readsOn = (color, backgrounds) => {
  const rgb = emitted(color)
  return backgrounds.every(
    (background) => contrastRatio(rgb, parseHex(background)) >= TEXT_CONTRAST_MINIMUM,
  )
}

const LEGIBLE_STEP = 0.01

const legible = (color, backgrounds, scheme, { solid = false } = {}) => {
  const step = scheme === 'dark' ? LEGIBLE_STEP : -LEGIBLE_STEP
  const reads = (candidate) => readsOn(candidate, backgrounds) && (!solid || carriesText(candidate))
  const canMove = (candidate) => (step > 0 ? candidate.l < 1 : candidate.l > 0)
  let candidate = fit(color)
  while (!reads(candidate) && canMove(candidate)) {
    candidate = fit({ ...candidate, l: candidate.l + step })
  }
  return candidate
}

const PALETTE = {
  gray: { l: 0.62, c: 0.004, h: 270 },
  brown: { l: 0.52, c: 0.08, h: 65 },
  red: { l: 0.55, c: 0.21, h: 27 },
  orange: { l: 0.6, c: 0.19, h: 55 },
  amber: { l: 0.83, c: 0.16, h: 80 },
  yellow: { l: 0.9, c: 0.17, h: 100 },
  lime: { l: 0.88, c: 0.18, h: 125 },
  green: { l: 0.55, c: 0.15, h: 155 },
  teal: { l: 0.56, c: 0.12, h: 195 },
  cyan: { l: 0.58, c: 0.13, h: 220 },
  sky: { l: 0.85, c: 0.09, h: 230 },
  blue: { l: 0.55, c: 0.19, h: 258 },
  indigo: { l: 0.48, c: 0.2, h: 272 },
  violet: { l: 0.47, c: 0.2, h: 300 },
  purple: { l: 0.48, c: 0.21, h: 315 },
  pink: { l: 0.54, c: 0.2, h: 355 },
}

export const paletteNames = () => Object.keys(PALETTE)

const ROLE_SOURCES = {
  'color-danger': 'red',
  'color-success': 'green',
  'color-warning': 'amber',
  'color-info': 'blue',
}

let paletteHexes = null

export const paletteTokens = () =>
  (paletteHexes ??= Object.fromEntries(
    Object.entries(PALETTE).map(([name, color]) => [`color-${name}`, hex(color)]),
  ))

const roleTokens = () =>
  Object.fromEntries(
    Object.entries(ROLE_SOURCES).map(([name, source]) => [name, `var(--imp-color-${source})`]),
  )

const RADIUS_LEVELS = {
  none: { 'radius-item': '0px', 'radius-container': '0px' },
  small: { 'radius-item': '3px', 'radius-container': '6px' },
  medium: { 'radius-item': '6px', 'radius-container': '10px' },
  large: { 'radius-item': '10px', 'radius-container': '16px' },
}

export const radiusSteps = () => Object.keys(RADIUS_LEVELS)

const SHADOW_COLORS = { light: '#0f172a', dark: '#ffffff' }

const shade = (offset, alpha) => `${offset} rgb(from var(--imp-color-shadow) r g b / ${alpha}%)`

const SHADOW_LEVELS = {
  none: ['none', 'none', 'none'],
  soft: [shade('0 1px 2px', 10), shade('0 4px 12px', 12), shade('0 12px 32px', 18)],
  strong: [shade('0 1px 3px', 18), shade('0 6px 16px', 22), shade('0 18px 44px', 30)],
}

export const shadowSteps = () => Object.keys(SHADOW_LEVELS)

const LOADER_SHAPES = ['spinner', 'dots', 'bar', 'pulse']

export const loaderShapes = () => [...LOADER_SHAPES]

export const isLoaderShape = (value) => LOADER_SHAPES.includes(value)

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

const solid = (base, name) => ({
  [name]: hex(base),
  [`color-on-${name.slice('color-'.length)}`]: readable(base),
})

export const isHexColor = (value) => typeof value === 'string' && HEX_COLOR.test(value)

const readBase = (value, fallback) => rgbToOklch(parseHex(isHexColor(value) ? value : fallback))

export const colorTokens = ({ primary, secondary, mode }) => {
  const scheme = mode === 'dark' ? 'dark' : 'light'
  const accent = readBase(primary, '#3b6fe0')
  const base = readBase(secondary, '#6b7280')
  const danger = rgbToOklch(parseHex(paletteTokens()[`color-${ROLE_SOURCES['color-danger']}`]))
  const surface = neutral(base, scheme, 'surface')
  const sunken = neutral(base, scheme, 'sunken')
  const textGrounds = [surface, sunken]
  const legibleDanger =
    readsOn(danger, textGrounds) && carriesText(danger)
      ? { 'color-on-danger': readable(danger) }
      : solid(legible(danger, textGrounds, scheme, { solid: true }), 'color-danger')
  return {
    'color-scheme': scheme,
    ...paletteTokens(),
    ...roleTokens(),
    ...solid(legible(accent, textGrounds, scheme, { solid: true }), 'color-primary'),
    ...legibleDanger,
    'color-secondary': hex(legible(base, textGrounds, scheme)),
    'color-text': neutral(base, scheme, 'text'),
    'color-heading': 'var(--imp-color-text)',
    'color-surface': surface,
    'color-surface-sunken': sunken,
    'color-surface-hover': neutral(base, scheme, 'hover'),
    'color-border': neutral(base, scheme, 'border'),
    'color-shadow': SHADOW_COLORS[scheme],
  }
}

const COLOR_SCHEMES = ['light', 'dark']

export const colorSchemeOf = (tokens) => {
  const scheme = tokens?.['color-scheme']
  return COLOR_SCHEMES.includes(scheme) ? scheme : undefined
}

export const radiusTokens = (level) => RADIUS_LEVELS[level] ?? RADIUS_LEVELS.medium

export const radiusLevelOf = (tokens) =>
  radiusSteps().find((level) => RADIUS_LEVELS[level]['radius-item'] === tokens['radius-item'])
  ?? 'medium'

export const shadowLevelOf = (tokens) =>
  shadowSteps().find((level) => SHADOW_LEVELS[level][1] === tokens['shadow-md']) ?? 'soft'

export const loaderShapeOf = (tokens) => (isLoaderShape(tokens.loader) ? tokens.loader : 'spinner')

export const loaderTokens = (shape) => ({ loader: isLoaderShape(shape) ? shape : 'spinner' })

export const shadowTokens = (level) => {
  const [small, medium, large] = SHADOW_LEVELS[level] ?? SHADOW_LEVELS.soft
  return { 'shadow-sm': small, 'shadow-md': medium, 'shadow-lg': large }
}

export const shadowColor = (mode) => SHADOW_COLORS[mode === 'dark' ? 'dark' : 'light']
