import { component, mount } from 'imp'
import { applyTheme, colorSchemeOf, theme } from 'imp/theme'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'

const root = document.documentElement

const readToken = (name) => root.style.getPropertyValue(`--imp-${name}`).trim()

const probe = component('theme-probe', { setup: (self, run) => run(self) })

const resetRoot = () => root.removeAttribute('style')

beforeEach(() => {
  document.body.replaceChildren()
  resetRoot()
})

afterEach(resetRoot)

test('applyTheme writes tokens as --imp-* custom properties on :root', () => {
  applyTheme({ name: 't', tokens: { 'color-primary': '#111', 'color-secondary': '#222' } })
  expect(readToken('color-primary')).toEqual('#111')
  expect(readToken('color-secondary')).toEqual('#222')
})

test('applyTheme reads color-scheme from the lightness of color-surface', () => {
  applyTheme({ name: 'd', tokens: { 'color-surface': '#1f2028' } })
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
  applyTheme({ name: 'l', tokens: { 'color-surface': '#fdf7ff' } })
  expect(root.style.getPropertyValue('color-scheme')).toEqual('light')
})

test('colorSchemeOf tells a dark surface from a light one, and nothing from a non-hex one', () => {
  expect(colorSchemeOf({ 'color-surface': '#000' })).toEqual('dark')
  expect(colorSchemeOf({ 'color-surface': '#fff' })).toEqual('light')
  expect(colorSchemeOf({ 'color-surface': '#5a5a5a' })).toEqual('dark')
  expect(colorSchemeOf({ 'color-surface': '#8a8a8a' })).toEqual('light')
  expect(colorSchemeOf({ 'color-surface': 'oklch(0.2 0 0)' })).toEqual(undefined)
  expect(colorSchemeOf({})).toEqual(undefined)
  expect(colorSchemeOf(undefined)).toEqual(undefined)
})

test('applyTheme warns and leaves color-scheme unset when color-surface is absent', () => {
  const warn = spy(console, 'warn', () => {})
  applyTheme({ name: 'n', tokens: { 'color-primary': '#111' } })
  expect(warn.calls.some(([first]) => String(first).includes('color-surface'))).toBeTruthy()
  expect(root.style.getPropertyValue('color-scheme')).toEqual('')
})

test('swapping to a theme without a color-surface clears the previous color-scheme', () => {
  applyTheme({ name: 'd', tokens: { 'color-surface': '#1f2028' } })
  applyTheme({ name: 'n', tokens: { 'color-primary': '#222' } })
  expect(root.style.getPropertyValue('color-scheme')).toEqual('')
})

test('theme.get returns the applied theme', () => {
  const applied = { name: 'g', tokens: { 'color-primary': '#111' } }
  applyTheme(applied)
  expect(theme.get()).toEqual(applied)
})

test('swapping a theme overwrites its token values', () => {
  applyTheme({ name: 'a', tokens: { 'color-primary': '#111', 'color-secondary': '#222' } })
  applyTheme({ name: 'b', tokens: { 'color-primary': '#333', 'color-secondary': '#444' } })
  expect(readToken('color-primary')).toEqual('#333')
  expect(readToken('color-secondary')).toEqual('#444')
})

test('theme.watch fires with the active theme on mount and on every swap', () => {
  applyTheme({ name: 'first', tokens: { 'color-primary': '#111' } })
  const seen = []
  mount(document.body, probe(() => void theme.watch((current) => seen.push(current?.name))))
  applyTheme({ name: 'second', tokens: { 'color-primary': '#222' } })
  expect(seen).toEqual(['first', 'second'])
})

test('applyTheme returns the theme it applied', () => {
  const applied = { name: 'r', tokens: { 'color-primary': '#111' } }
  expect(applyTheme(applied)).toEqual(applied)
})

test('a malformed theme throws at the call site', () => {
  expect(() => applyTheme(null)).toThrow('applyTheme')
  expect(() => applyTheme([])).toThrow('applyTheme')
  expect(() => applyTheme({ name: 'x' })).toThrow('tokens')
  expect(() => applyTheme({ name: 'x', tokens: [] })).toThrow('tokens')
})

test('an unknown built-in theme name throws at the call site', () => {
  expect(() => applyTheme('twilight')).toThrow('twilight')
  expect(() => applyTheme('constructor')).toThrow('built-in theme')
})

test('the plain names light and dark are not built-ins', () => {
  expect(() => applyTheme('light')).toThrow('imp-light')
  expect(() => applyTheme('dark')).toThrow('imp-dark')
})

test('a suspicious token name is logged, not thrown', () => {
  const warn = spy(console, 'warn', () => {})
  applyTheme({ name: 's', tokens: { 'Color Primary': '#111' } })
  expect(warn.calls.some(([first]) => String(first).includes('suspicious'))).toBeTruthy()
})

test('a color-surface that is not a hex colour is logged and color-scheme is left unset', () => {
  const warn = spy(console, 'warn', () => {})
  applyTheme({ name: 'i', tokens: { 'color-surface': 'oklch(0.2 0 0)' } })
  expect(warn.calls.some(([first]) => String(first).includes('oklch(0.2 0 0)'))).toBeTruthy()
  expect(root.style.getPropertyValue('color-scheme')).toEqual('')
})

test("applyTheme('imp-light') applies the built-in light tokens and color scheme", () => {
  applyTheme('imp-light')
  expect(theme.get().name).toEqual('imp-light')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('light')
  expect(readToken('color-primary')).toEqual('#2563eb')
  expect(readToken('color-secondary')).toEqual('#64748b')
})

test("applyTheme('imp-dark') applies the built-in dark tokens and color scheme", () => {
  applyTheme('imp-dark')
  expect(theme.get().name).toEqual('imp-dark')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
  expect(readToken('color-primary')).toEqual('#7c9cff')
  expect(readToken('color-secondary')).toEqual('#94a3b8')
})

test("applyTheme('imp-high-contrast-light') applies the built-in high-contrast light tokens", () => {
  applyTheme('imp-high-contrast-light')
  expect(theme.get().name).toEqual('imp-high-contrast-light')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('light')
  expect(readToken('color-text')).toEqual('#000000')
  expect(readToken('color-surface')).toEqual('#ffffff')
  expect(readToken('color-border')).toEqual('#000000')
})

test("applyTheme('imp-high-contrast-dark') applies the built-in high-contrast dark tokens", () => {
  applyTheme('imp-high-contrast-dark')
  expect(theme.get().name).toEqual('imp-high-contrast-dark')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
  expect(readToken('color-text')).toEqual('#ffffff')
  expect(readToken('color-surface')).toEqual('#000000')
  expect(readToken('color-border')).toEqual('#ffffff')
})

test('the high-contrast themes strengthen borders and the focus ring', () => {
  applyTheme('imp-light')
  expect(readToken('border-width')).toEqual('1px')
  expect(readToken('focus-ring-width')).toEqual('2px')
  for (const name of ['imp-high-contrast-light', 'imp-high-contrast-dark']) {
    applyTheme(name)
    expect(readToken('border-width')).toEqual('2px')
    expect(readToken('focus-ring-width')).toEqual('3px')
  }
})

test('every built-in theme defines the same token set', () => {
  const keysOf = (name) => Object.keys(applyTheme(name).tokens).sort()
  const expected = keysOf('imp-light')
  for (const name of ['imp-dark', 'imp-high-contrast-light', 'imp-high-contrast-dark']) {
    expect(keysOf(name)).toEqual(expected)
  }
})

test('swapping between the built-in themes overwrites the previous tokens', () => {
  applyTheme('imp-dark')
  applyTheme('imp-light')
  expect(theme.get().name).toEqual('imp-light')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('light')
  expect(readToken('color-primary')).toEqual('#2563eb')
})

test('an applied theme is frozen, so a built-in cannot be edited through theme.get', () => {
  applyTheme('imp-dark')
  const applied = theme.get()
  expect(() => {
    applied.name = 'hijacked'
  }).toThrow()
  expect(() => {
    applied.tokens['color-primary'] = '#000'
  }).toThrow()
  applyTheme('imp-light')
  applyTheme('imp-dark')
  expect(theme.get().name).toEqual('imp-dark')
  expect(readToken('color-primary')).toEqual('#7c9cff')
})

test('the built-in themes carry the same token keys', () => {
  const light = Object.keys(applyTheme('imp-light').tokens).sort()
  const dark = Object.keys(applyTheme('imp-dark').tokens).sort()
  expect(light).toEqual(dark)
})

test('a built-in theme is readable through theme.get for seeding a custom theme', () => {
  applyTheme('imp-dark')
  const custom = {
    name: 'custom',
    tokens: { ...theme.get().tokens, 'color-primary': '#ff0000' },
  }
  applyTheme(custom)
  expect(readToken('color-primary')).toEqual('#ff0000')
  expect(readToken('color-secondary')).toEqual('#94a3b8')
})

test('a theme with a base starts from a built-in theme and overrides the named tokens', () => {
  const applied = applyTheme({
    base: 'imp-dark',
    tokens: { 'font-family': "'Inter', system-ui, sans-serif" },
  })
  expect(applied.name).toEqual('imp-dark')
  expect(applied.base).toEqual(undefined)
  expect(readToken('font-family')).toEqual("'Inter', system-ui, sans-serif")
  expect(readToken('color-primary')).toEqual('#7c9cff')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
  expect(theme.get()).toEqual(applied)
})

test('a theme with a base keeps its own name, and its own surface sets the color-scheme', () => {
  applyTheme({ base: 'imp-light', name: 'brand', tokens: { 'color-surface': '#101010' } })
  expect(theme.get().name).toEqual('brand')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
})

test('a base that is not a built-in theme name throws at the call site', () => {
  expect(() => applyTheme({ base: 'light', tokens: {} })).toThrow('imp-light')
  expect(() => applyTheme({ base: { tokens: {} }, tokens: {} })).toThrow('base')
})

test('the built-in themes ship two font weights, normal and bold', () => {
  applyTheme('imp-light')
  const { tokens } = theme.get()
  expect(tokens['font-weight-normal']).toEqual('400')
  expect(tokens['font-weight-bold']).toEqual('600')
  expect(Object.keys(tokens).filter((name) => name.startsWith('font-weight-'))).toEqual([
    'font-weight-normal',
    'font-weight-bold',
  ])
})

const applied = (name) => {
  applyTheme(name)
  return theme.get().tokens
}

test('a built-in theme carries the whole named palette', () => {
  const tokens = applied('imp-light')
  for (const name of ['color-gray', 'color-red', 'color-green', 'color-amber', 'color-sky']) {
    expect(/^#[0-9a-f]{6}$/.test(tokens[name])).toBeTruthy()
  }
})

test('the semantic colors alias palette entries rather than repeating them', () => {
  const tokens = applied('imp-light')
  expect(tokens['color-success']).toEqual(tokens['color-green'])
  expect(tokens['color-warning']).toEqual(tokens['color-amber'])
  expect(tokens['color-info']).toEqual(tokens['color-blue'])
  expect(tokens['color-danger']).toEqual(tokens['color-red'])
})

test('both built-in palettes carry the same named colors, so one block serves either', () => {
  const light = applied('imp-light')
  const dark = applied('imp-dark')
  expect(dark['color-green']).toEqual(light['color-green'])
  expect(dark['color-sky']).toEqual(light['color-sky'])
})

test('the primary ramp steps darker in a light theme and lighter in a dark one', () => {
  const light = applied('imp-light')
  const dark = applied('imp-dark')
  expect(light['color-primary-hover'] < light['color-primary']).toBeTruthy()
  expect(dark['color-primary-hover'] > dark['color-primary']).toBeTruthy()
  expect(light['color-primary-active']).not.toEqual(light['color-primary-hover'])
})

test('a derived theme picks a readable colour to sit on its primary', () => {
  expect(applied('imp-light')['color-on-primary']).toEqual('#ffffff')
  expect(applied('imp-dark')['color-on-primary']).not.toEqual('#ffffff')
})

test('surfaces are derived per mode, with the sunken page behind the panel', () => {
  const light = applied('imp-light')
  const dark = applied('imp-dark')
  expect(light['color-surface'] > light['color-surface-sunken']).toBeTruthy()
  expect(dark['color-surface'] > dark['color-surface-sunken']).toBeTruthy()
  expect(dark['color-surface'] < light['color-surface']).toBeTruthy()
})

test('links and the focus ring follow the primary', () => {
  const tokens = applied('imp-light')
  expect(tokens['color-link']).toEqual(tokens['color-primary'])
  expect(tokens['color-focus-ring']).toEqual(tokens['color-primary'])
})

test('one radius step sets the item and the container radius, and radius-full stays a pill', () => {
  const tokens = applied('imp-light')
  expect(tokens['radius-item']).toEqual('6px')
  expect(tokens['radius-container']).toEqual('10px')
  expect(tokens['radius-full']).toEqual('9999px')
})

test('the high-contrast themes drop every shadow and widen the affordances', () => {
  const tokens = applied('imp-high-contrast-dark')
  expect(tokens['shadow-sm']).toEqual('none')
  expect(tokens['shadow-lg']).toEqual('none')
  expect(tokens['border-width']).toEqual('2px')
  expect(tokens['focus-ring-width']).toEqual('3px')
  expect(tokens['color-surface']).toEqual('#000000')
})
