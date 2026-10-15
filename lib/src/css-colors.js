import { oklabToLinearSrgb } from './theme-colors.js'

const NAMED_COLORS = {
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '00ffff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000000',
  blanchedalmond: 'ffebcd',
  blue: '0000ff',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '00ffff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '778899',
  lightslategrey: '778899',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '00ff00',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'ff00ff',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  rebeccapurple: '663399',
  red: 'ff0000',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  transparent: '00000000',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'ffffff',
  whitesmoke: 'f5f5f5',
  yellow: 'ffff00',
  yellowgreen: '9acd32',
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const FUNCTION = /^([a-z-]+)\(([^()]*)\)$/i

const COMPONENT = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/i

const DEGREES_PER_UNIT = { deg: 1, rad: 57.29577951308232, grad: 0.9, turn: 360 }

const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
]

const XYZ_D65_TO_LINEAR_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
]

const D50_WHITE = [0.9642956764295677, 1, 0.8251046025104602]

const DISPLAY_P3_TO_XYZ_D65 = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
]

const A98_RGB_TO_XYZ_D65 = [
  [0.5766690429101305, 0.1855582379065463, 0.1882286462349947],
  [0.29734497525053605, 0.6273635662554661, 0.07529145849399788],
  [0.02703136138641234, 0.07068885253582723, 0.9913375368376388],
]

const REC2020_TO_XYZ_D65 = [
  [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0, 0.028072693049087428, 1.060985057710791],
]

const PROPHOTO_RGB_TO_XYZ_D50 = [
  [0.7977666449006423, 0.13518129740053308, 0.031347734128392285],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
]

const LAB_EPSILON = 0.008856451679035631

const LAB_KAPPA = 903.2962962962963

const REC2020_ALPHA = 1.09929682680944

const REC2020_BETA = 0.018053968510807

const multiply = (matrix, vector) =>
  matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2])

const signed = (value, transfer) => Math.sign(value) * transfer(Math.abs(value))

const srgbToLinear = (channel) =>
  signed(channel, (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))

const linearToSrgb = (channel) =>
  signed(channel, (value) =>
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055,
  )

const a98ToLinear = (channel) => signed(channel, (value) => value ** (563 / 256))

const prophotoToLinear = (channel) =>
  signed(channel, (value) => (value <= 16 / 512 ? value / 16 : value ** 1.8))

const rec2020ToLinear = (channel) =>
  signed(channel, (value) =>
    value < REC2020_BETA * 4.5
      ? value / 4.5
      : ((value + REC2020_ALPHA - 1) / REC2020_ALPHA) ** (1 / 0.45),
  )

const xyzD65ToLinearSrgb = (xyz) => multiply(XYZ_D65_TO_LINEAR_SRGB, xyz)

const xyzD50ToLinearSrgb = (xyz) => xyzD65ToLinearSrgb(multiply(D50_TO_D65, xyz))

const labToXyzD50 = ([lightness, greenRed, blueYellow]) => {
  const middle = (lightness + 16) / 116
  const first = greenRed / 500 + middle
  const last = middle - blueYellow / 200
  const axis = (value) => (value ** 3 > LAB_EPSILON ? value ** 3 : (116 * value - 16) / LAB_KAPPA)
  const luminance = lightness > LAB_KAPPA * LAB_EPSILON ? middle ** 3 : lightness / LAB_KAPPA
  return [axis(first) * D50_WHITE[0], luminance, axis(last) * D50_WHITE[2]]
}

const polar = ([lightness, chroma, hue]) => {
  const radians = (hue * Math.PI) / 180
  return [lightness, chroma * Math.cos(radians), chroma * Math.sin(radians)]
}

const hslToSrgb = (hue, saturation, lightness) => {
  const turn = ((hue % 360) + 360) % 360
  const amount = saturation * Math.min(lightness, 1 - lightness)
  const channel = (offset) => {
    const step = (offset + turn / 30) % 12
    return lightness - amount * Math.max(-1, Math.min(step - 3, 9 - step, 1))
  }
  return [channel(0), channel(8), channel(4)]
}

const hwbToSrgb = (hue, whiteness, blackness) => {
  if (whiteness + blackness >= 1) {
    const gray = whiteness / (whiteness + blackness)
    return [gray, gray, gray]
  }
  return hslToSrgb(hue, 1, 0.5).map((channel) => channel * (1 - whiteness - blackness) + whiteness)
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

const readComponent = (text) => {
  if (text.toLowerCase() === 'none') return { none: true, value: 0, unit: '' }
  const match = text.match(COMPONENT)
  if (!match) return null
  return { none: false, value: Number(match[1]), unit: (match[2] ?? '').toLowerCase() }
}

const numberOrPercent = (component, percentScale) => {
  if (component.unit === '') return component.value
  if (component.unit === '%') return (component.value / 100) * percentScale
  return null
}

const hueOf = (component) => {
  if (component.unit === '%') return null
  return component.value * (DEGREES_PER_UNIT[component.unit] ?? 1)
}

const alphaOf = (component) => {
  if (component === undefined) return 1
  const alpha = numberOrPercent(component, 1)
  return alpha === null ? null : clamp(alpha, 0, 1)
}

const splitArguments = (body) => {
  if (body.includes(',')) {
    const parts = body.split(',').map((part) => part.trim())
    if (parts.length < 3 || parts.length > 4 || parts.some((part) => /\s|^$/.test(part))) {
      return null
    }
    return { legacy: true, channels: parts.slice(0, 3), alpha: parts[3] }
  }
  const [channelText, alphaText, ...rest] = body.split('/')
  if (rest.length > 0) return null
  const channels = channelText.trim().split(/\s+/).filter(Boolean)
  const alpha = alphaText?.trim()
  if (alphaText !== undefined && (alpha === '' || /\s/.test(alpha))) return null
  return { legacy: false, channels, alpha }
}

const readRgb = ([red, green, blue], legacy) => {
  if (legacy) {
    const units = new Set([red, green, blue].map(({ unit }) => unit))
    if (units.size > 1) return null
  }
  const channels = [red, green, blue].map((channel) => numberOrPercent(channel, 255))
  if (channels.includes(null)) return null
  return { space: 'srgb', values: channels.map((channel) => clamp(channel / 255, 0, 1)) }
}

const readHsl = ([hue, saturation, lightness], legacy, hwb) => {
  const degrees = hueOf(hue)
  if (legacy && (saturation.unit !== '%' || lightness.unit !== '%')) return null
  const second = numberOrPercent(saturation, 100)
  const third = numberOrPercent(lightness, 100)
  if (degrees === null || second === null || third === null) return null
  if (hwb) {
    const whiteness = clamp(second / 100, 0, 1)
    const blackness = clamp(third / 100, 0, 1)
    return { space: 'srgb', values: hwbToSrgb(degrees, whiteness, blackness) }
  }
  const values = hslToSrgb(degrees, Math.max(second / 100, 0), clamp(third / 100, 0, 1))
  return { space: 'srgb', values }
}

const readLab = ([lightness, first, second], { lightnessScale, axisScale, polarForm }) => {
  const level = numberOrPercent(lightness, lightnessScale)
  const axis = numberOrPercent(first, axisScale)
  if (level === null || axis === null) return null
  const clampedLevel = clamp(level, 0, lightnessScale)
  if (polarForm) {
    const hue = hueOf(second)
    if (hue === null) return null
    return polar([clampedLevel, Math.max(axis, 0), hue])
  }
  const other = numberOrPercent(second, axisScale)
  return other === null ? null : [clampedLevel, axis, other]
}

const PREDEFINED_SPACES = {
  srgb: (values) => values.map(srgbToLinear),
  'srgb-linear': (values) => values,
  'display-p3': (values) =>
    xyzD65ToLinearSrgb(multiply(DISPLAY_P3_TO_XYZ_D65, values.map(srgbToLinear))),
  'a98-rgb': (values) => xyzD65ToLinearSrgb(multiply(A98_RGB_TO_XYZ_D65, values.map(a98ToLinear))),
  'prophoto-rgb': (values) =>
    xyzD50ToLinearSrgb(multiply(PROPHOTO_RGB_TO_XYZ_D50, values.map(prophotoToLinear))),
  rec2020: (values) =>
    xyzD65ToLinearSrgb(multiply(REC2020_TO_XYZ_D65, values.map(rec2020ToLinear))),
  xyz: xyzD65ToLinearSrgb,
  'xyz-d65': xyzD65ToLinearSrgb,
  'xyz-d50': xyzD50ToLinearSrgb,
}

const readPredefined = (channels) => {
  const [spaceText, ...components] = channels
  const toLinear = PREDEFINED_SPACES[spaceText?.toLowerCase()]
  if (!toLinear || components.length !== 3) return null
  const parsed = components.map(readComponent)
  if (parsed.includes(null)) return null
  const values = parsed.map((component) => numberOrPercent(component, 1))
  if (values.includes(null)) return null
  return { space: 'linear', values: toLinear(values) }
}

const LAB_FORMS = {
  lab: { lightnessScale: 100, axisScale: 125, polarForm: false },
  lch: { lightnessScale: 100, axisScale: 150, polarForm: true },
  oklab: { lightnessScale: 1, axisScale: 0.4, polarForm: false },
  oklch: { lightnessScale: 1, axisScale: 0.4, polarForm: true },
}

const readFunction = (name, args) => {
  if (name === 'color') return args.legacy ? null : readPredefined(args.channels)
  if (args.channels.length !== 3) return null
  const legacyAllowed = ['rgb', 'rgba', 'hsl', 'hsla'].includes(name)
  if (args.legacy && !legacyAllowed) return null
  const channels = args.channels.map(readComponent)
  if (channels.includes(null)) return null
  if (args.legacy && channels.some((channel) => channel.none)) return null
  if (name === 'rgb' || name === 'rgba') return readRgb(channels, args.legacy)
  if (name === 'hsl' || name === 'hsla') return readHsl(channels, args.legacy, false)
  if (name === 'hwb') return readHsl(channels, false, true)
  const form = LAB_FORMS[name]
  if (!form) return null
  const lab = readLab(channels, form)
  if (lab === null) return null
  const linear = name.startsWith('ok')
    ? oklabToLinearSrgb(lab)
    : xyzD50ToLinearSrgb(labToXyzD50(lab))
  return { space: 'linear', values: linear }
}

const fromHex = (digits) => {
  const expanded = digits.length <= 4 ? digits.replace(/./g, (digit) => digit + digit) : digits
  const channels = expanded.match(/../g).map((pair) => parseInt(pair, 16) / 255)
  return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 }
}

const clipped = ({ space, values }) =>
  (space === 'linear' ? values.map(linearToSrgb) : values).map((channel) =>
    clamp(Number.isNaN(channel) ? 0 : channel, 0, 1),
  )

export const parseCssColor = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const hex = text.match(HEX)
  if (hex) return fromHex(hex[1])
  const named = NAMED_COLORS[text.toLowerCase()]
  if (named !== undefined) return fromHex(named)
  const call = text.match(FUNCTION)
  if (!call) return null
  const name = call[1].toLowerCase()
  const args = splitArguments(call[2].trim())
  if (args === null) return null
  const alphaComponent = args.alpha === undefined ? undefined : readComponent(args.alpha)
  if (alphaComponent === null || (args.legacy && alphaComponent?.none)) return null
  const alpha = alphaOf(alphaComponent)
  const color = readFunction(name, args)
  if (color === null || alpha === null) return null
  return { rgb: clipped(color), alpha }
}
