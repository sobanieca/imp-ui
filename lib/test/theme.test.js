import { component, mount } from 'imp'
import { applyTheme, theme } from 'imp/theme'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'

const root = document.documentElement

const readToken = (name) => root.style.getPropertyValue(`--imp-${name}`).trim()

const probe = component('theme-probe', { onMount: (_instance, run) => run() })

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

test('applyTheme sets color-scheme from colorScheme', () => {
  applyTheme({ name: 'd', colorScheme: 'dark', tokens: { 'color-primary': '#111' } })
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
})

test('applyTheme leaves color-scheme unset when colorScheme is absent', () => {
  applyTheme({ name: 'n', tokens: { 'color-primary': '#111' } })
  expect(root.style.getPropertyValue('color-scheme')).toEqual('')
})

test('swapping to a theme without a colorScheme clears the previous one', () => {
  applyTheme({ name: 'd', colorScheme: 'dark', tokens: { 'color-primary': '#111' } })
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
  expect(() => applyTheme('light')).toThrow('default-light')
  expect(() => applyTheme('dark')).toThrow('default-dark')
})

test('a suspicious token name is logged, not thrown', () => {
  const warn = spy(console, 'warn', () => {})
  applyTheme({ name: 's', tokens: { 'Color Primary': '#111' } })
  expect(warn.calls.some(([first]) => String(first).includes('suspicious'))).toBeTruthy()
})

test('an invalid colorScheme is logged and left unset', () => {
  const warn = spy(console, 'warn', () => {})
  applyTheme({ name: 'i', colorScheme: 'twilight', tokens: { 'color-primary': '#111' } })
  expect(warn.calls.some(([first]) => String(first).includes('colorScheme'))).toBeTruthy()
  expect(root.style.getPropertyValue('color-scheme')).toEqual('')
})

test("applyTheme('default-light') applies the built-in light tokens and color scheme", () => {
  applyTheme('default-light')
  expect(theme.get().name).toEqual('default-light')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('light')
  expect(readToken('color-primary')).toEqual('#2563eb')
  expect(readToken('color-secondary')).toEqual('#64748b')
})

test("applyTheme('default-dark') applies the built-in dark tokens and color scheme", () => {
  applyTheme('default-dark')
  expect(theme.get().name).toEqual('default-dark')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('dark')
  expect(readToken('color-primary')).toEqual('#7c9cff')
  expect(readToken('color-secondary')).toEqual('#94a3b8')
})

test('swapping between the built-in themes overwrites the previous tokens', () => {
  applyTheme('default-dark')
  applyTheme('default-light')
  expect(theme.get().name).toEqual('default-light')
  expect(root.style.getPropertyValue('color-scheme')).toEqual('light')
  expect(readToken('color-primary')).toEqual('#2563eb')
})

test('an applied theme is frozen, so a built-in cannot be edited through theme.get', () => {
  applyTheme('default-dark')
  const applied = theme.get()
  expect(() => {
    applied.name = 'hijacked'
  }).toThrow()
  expect(() => {
    applied.tokens['color-primary'] = '#000'
  }).toThrow()
  applyTheme('default-light')
  applyTheme('default-dark')
  expect(theme.get().name).toEqual('default-dark')
  expect(readToken('color-primary')).toEqual('#7c9cff')
})

test('the built-in themes carry the same token keys', () => {
  const light = Object.keys(applyTheme('default-light').tokens).sort()
  const dark = Object.keys(applyTheme('default-dark').tokens).sort()
  expect(light).toEqual(dark)
})

test('a built-in theme is readable through theme.get for seeding a custom theme', () => {
  applyTheme('default-dark')
  const custom = {
    name: 'custom',
    colorScheme: 'dark',
    tokens: { ...theme.get().tokens, 'color-primary': '#ff0000' },
  }
  applyTheme(custom)
  expect(readToken('color-primary')).toEqual('#ff0000')
  expect(readToken('color-secondary')).toEqual('#94a3b8')
})
