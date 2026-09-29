import { expect, test } from 'imp/test'
import { parseCssColor } from '../src/css-colors.js'

const bytes = (value) => {
  const color = parseCssColor(value)
  if (color === null) return null
  return [...color.rgb.map((channel) => Math.round(channel * 255)), Math.round(color.alpha * 255)]
}

const CHROME_RENDERS = {
  '#abc': [170, 187, 204, 255],
  '#abcd': [170, 187, 204, 221],
  '#a1b2c3': [161, 178, 195, 255],
  '#A1B2C380': [161, 178, 195, 128],
  'rebeccapurple': [102, 51, 153, 255],
  'ReBeccaPurple': [102, 51, 153, 255],
  'transparent': [0, 0, 0, 0],
  'rgb(10, 20, 30)': [10, 20, 30, 255],
  'rgba(10,20,30,0.5)': [10, 20, 30, 128],
  'rgb(10% 20% 30%)': [26, 51, 77, 255],
  'rgb(10 20 30 / 40%)': [10, 20, 30, 102],
  'rgb(300 -5 20)': [255, 0, 20, 255],
  'rgb(none 20 30)': [0, 20, 30, 255],
  'RGB(1e2 20 30)': [100, 20, 30, 255],
  'rgb(.5 20.7 30)': [1, 21, 30, 255],
  'hsl(120, 50%, 40%)': [51, 153, 51, 255],
  'hsla(200deg 60% 30% / 0.2)': [31, 92, 122, 51],
  'hsl(0.5turn 40 70)': [148, 209, 209, 255],
  'hsl(3rad 80% 20%)': [10, 92, 81, 255],
  'hsl(100grad 50% 50%)': [128, 191, 64, 255],
  'hsl(-120 50% 50%)': [64, 64, 191, 255],
  'hwb(200 20% 30%)': [51, 136, 179, 255],
  'hwb(50 70% 60%)': [137, 137, 137, 255],
  'hwb(0.25turn 10 5 / 50%)': [134, 242, 26, 128],
  'lab(50 20 -30)': [133, 108, 170, 255],
  'lab(29.2345% 39.3825 20.0664)': [125, 35, 41, 255],
  'lab(90 -10 60)': [235, 230, 106, 255],
  'lch(60 40 120)': [125, 154, 81, 255],
  'lch(52.2345% 72.2 56.2)': [198, 93, 6, 255],
  'lch(70% 50% 250deg)': [0, 189, 255, 255],
  'oklab(0.6 0.05 -0.1)': [135, 113, 187, 255],
  'oklab(40% 0.1 0.05)': [121, 41, 37, 255],
  'oklab(0.8 -25% 10%)': [126, 211, 163, 255],
  'oklch(0.6 0.1 200)': [13, 146, 152, 255],
  'oklch(62.8% 0.2577 29.23)': [255, 0, 0, 255],
  'oklch(0.9 0.05 90 / 0.3)': [235, 221, 185, 77],
  'oklch(0.5 50% 300)': [119, 58, 193, 255],
  'color(srgb 0.2 0.4 0.6)': [51, 102, 153, 255],
  'color(srgb 20% 40% 60% / 0.5)': [51, 102, 153, 128],
  'color(srgb-linear 0.2 0.4 0.6)': [124, 170, 203, 255],
  'color(display-p3 0.3 0.5 0.4)': [57, 129, 100, 255],
  'color(a98-rgb 0.3 0.5 0.4)': [29, 129, 101, 255],
  'color(prophoto-rgb 0.3 0.5 0.4)': [0, 155, 117, 255],
  'color(rec2020 0.3 0.5 0.4)': [25, 144, 113, 255],
  'color(xyz 0.2 0.3 0.4)': [0, 167, 164, 255],
  'color(xyz-d65 0.2 0.3 0.4)': [0, 167, 164, 255],
  'color(xyz-d50 0.2 0.3 0.4)': [0, 168, 189, 255],
}

test('every CSS colour form reads as the sRGB colour that Chrome paints', () => {
  for (const [value, expected] of Object.entries(CHROME_RENDERS)) {
    expect({ value, bytes: bytes(value) }).toEqual({ value, bytes: expected })
  }
})

test('a colour outside sRGB is clipped to the sRGB range after the conversion', () => {
  expect(bytes('oklch(0.7 0.4 150)')).toEqual([0, 214, 0, 255])
  expect(bytes('lab(50 120 -90)')).toEqual([240, 0, 255, 255])
  expect(bytes('color(display-p3 1 0 0)')).toEqual([255, 0, 0, 255])
})

test('a value that is not a plain colour reads as null', () => {
  for (
    const value of [
      'var(--imp-color-text)',
      'color-mix(in srgb, red, blue)',
      'currentColor',
      'rgb(from red r g b)',
      'linear-gradient(#fff, #000)',
      'Canvas',
      '#abcde',
      'rgb(10, 20%, 30)',
      'hsl(120, 50, 40)',
      'hwb(10, 20%, 30%)',
      'rgb(1 2)',
      'rgb(1 2 3 4)',
      'rgb(none, 2, 3)',
      'lab(50 20 -30 / 0.5 / 1)',
      'color(unknown 0.1 0.2 0.3)',
      '',
      undefined,
    ]
  ) {
    expect({ value, color: parseCssColor(value) }).toEqual({ value, color: null })
  }
})
