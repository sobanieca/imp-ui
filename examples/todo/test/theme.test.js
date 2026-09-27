import { applyTheme, colorSchemeOf, theme } from 'imp/theme'
import { expect, test } from 'imp/test'
import { auroraLight, THEME_CHOICES } from '../src/theme.js'

const [light, dark] = THEME_CHOICES.map((choice) => choice.theme)

test('the menu offers the light and the dark aurora theme', () => {
  expect(THEME_CHOICES.map((choice) => choice.value)).toEqual(['aurora-light', 'aurora-dark'])
  expect(light).toEqual(auroraLight)
})

test('both themes set the same tokens, so a swap leaves nothing behind', () => {
  expect(Object.keys(dark.tokens).sort()).toEqual(Object.keys(light.tokens).sort())
})

test('the surface colour tells imp which scheme each theme is', () => {
  expect(colorSchemeOf(light.tokens)).toEqual('light')
  expect(colorSchemeOf(dark.tokens)).toEqual('dark')
})

test('a theme applies its tokens on top of the built-in base', () => {
  applyTheme(dark)
  expect(theme.get().name).toEqual('aurora-dark')
  expect(theme.get().tokens['color-primary']).toEqual('#a18dff')
  expect(theme.get().tokens['space-3']).toBeTruthy()
  expect(document.documentElement.style.getPropertyValue('--imp-color-primary')).toEqual('#a18dff')
  expect(document.documentElement.style.getPropertyValue('color-scheme')).toEqual('dark')
})
