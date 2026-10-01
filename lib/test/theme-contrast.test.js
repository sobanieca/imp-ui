import { applyTheme, theme } from 'imp/theme'
import { expect, test } from 'imp/test'
import { contrastProblems } from '../src/theme-contrast.js'

const applied = (name) => {
  applyTheme(name)
  return theme.get().tokens
}

test('the contrast check follows color-heading to the text colour, and reads a set hex', () => {
  const tokens = applyTheme('imp-light').tokens
  expect(contrastProblems(tokens).some(({ text }) => text === 'color-heading')).toEqual(false)
  const faint = contrastProblems({ ...tokens, 'color-heading': '#dddddd' })
  expect(faint.map(({ text, background }) => `${text} on ${background}`)).toEqual([
    'color-heading on color-surface',
    'color-heading on color-surface-sunken',
    'color-heading on background-app',
  ])
})

test('every text pair of every built-in theme reaches the WCAG AA contrast', () => {
  for (
    const name of ['imp-light', 'imp-dark', 'imp-high-contrast-light', 'imp-high-contrast-dark']
  ) {
    expect({ name, problems: contrastProblems(applied(name)) }).toEqual({ name, problems: [] })
  }
})

test('the contrast check names each pair below 4.5:1, with its ratio', () => {
  const tokens = {
    ...applied('imp-light'),
    'color-primary': '#ffd400',
    'color-secondary': '#aaaaaa',
  }
  const pairs = contrastProblems(tokens).map(({ text, background }) => `${text}/${background}`)
  expect(pairs).toContain('color-primary/color-surface')
  expect(pairs).toContain('color-secondary/color-surface')
  expect(pairs).toContain('color-secondary/color-surface-sunken')
  const primary = contrastProblems(tokens).find(({ text }) => text === 'color-primary')
  expect(primary.ratio).toEqual(1.4)
})

test('the contrast check follows a token reference, and reports a value it cannot read', () => {
  const tokens = {
    'color-text': 'var(--imp-color-gray)',
    'color-gray': '#f0f0f0',
    'color-surface': '#ffffff',
    'background-app': 'linear-gradient(#fff, #000)',
  }
  expect(contrastProblems(tokens)).toEqual([
    { text: 'color-text', background: 'color-surface', ratio: expect.any(Number) },
    {
      text: 'color-text',
      background: 'background-app',
      ratio: null,
      reason:
        "cannot check contrast - background-app is 'linear-gradient(#fff, #000)', not a colour",
    },
  ])
})

const ratioOn = (text, surface = '#ffffff') =>
  contrastProblems({ 'color-text': text, 'color-surface': surface })[0]?.ratio ?? 'passes'

test('the contrast check reads every CSS colour form, not only hex', () => {
  const pale = {
    '#cccccc': 1.6,
    'rgb(204 204 204)': 1.6,
    'rgba(204, 204, 204, 1)': 1.6,
    'hsl(0 0% 80%)': 1.6,
    'hwb(0 80% 20%)': 1.6,
    'color(srgb 0.8 0.8 0.8)': 1.6,
    'oklch(0.85 0 0)': expect.any(Number),
    'oklab(0.85 0 0)': expect.any(Number),
    'lab(80 0 0)': expect.any(Number),
    'lch(80 0 0)': expect.any(Number),
    'color(display-p3 0.8 0.8 0.8)': 1.6,
    'color(xyz-d65 0.6 0.6 0.6)': expect.any(Number),
    'silver': expect.any(Number),
  }
  for (const [value, ratio] of Object.entries(pale)) {
    expect({ value, ratio: ratioOn(value) }).toEqual({ value, ratio })
  }
  const dark = [
    'rgb(20, 20, 20)',
    'hsl(220 30% 15%)',
    'hwb(0 5% 90%)',
    'oklch(0.25 0.05 260)',
    'oklab(0.2 0.01 -0.02)',
    'lab(15 5 -10)',
    'lch(15 10 300)',
    'color(srgb 0.1 0.1 0.1)',
    'color(display-p3 0.1 0.1 0.12)',
    'color(xyz-d50 0.01 0.01 0.01)',
    'navy',
    '#123',
    '#112233ff',
  ]
  for (const value of dark) {
    expect({ value, ratio: ratioOn(value) }).toEqual({ value, ratio: 'passes' })
  }
})

test('the contrast check puts translucent text over its background', () => {
  expect(ratioOn('rgb(0 0 0 / 20%)')).toEqual(ratioOn('#cccccc'))
  expect(ratioOn('#00000033')).toEqual(ratioOn('#cccccc'))
  expect(ratioOn('rgb(255 255 255 / 20%)', '#000000')).toEqual(ratioOn('#333333', '#000000'))
  expect(ratioOn('transparent')).toEqual(1)
})

test('the contrast check cannot check a pair on a translucent background, and says so', () => {
  expect(contrastProblems({ 'color-text': '#000', 'color-surface': 'rgb(255 255 255 / 50%)' }))
    .toEqual([{
      text: 'color-text',
      background: 'color-surface',
      ratio: null,
      reason:
        "cannot check contrast - color-surface is 'rgb(255 255 255 / 50%)', a translucent colour",
    }])
})

test('the contrast check reports a value it cannot read, and never passes it', () => {
  const unreadable = [
    'color-mix(in srgb, red, blue)',
    'currentColor',
    'var(--brand-text)',
    'var(--imp-color-gray)',
    'rgb(from white r g b)',
  ]
  for (const value of unreadable) {
    expect(contrastProblems({ 'color-text': value, 'color-surface': '#fff' })).toEqual([{
      text: 'color-text',
      background: 'color-surface',
      ratio: null,
      reason: `cannot check contrast - color-text is '${value}', not a colour`,
    }])
  }
})

test('the contrast check skips a pair whose token the theme does not have', () => {
  expect(contrastProblems({ 'color-text': '#000000' })).toEqual([])
})
