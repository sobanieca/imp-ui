import { applyTheme, colorSchemeOf, appliedTheme } from 'imp/theme'
import { expect, test } from 'imp/test'
import { auroraDark as dark, auroraLight as light, themes } from '../src/theme.js'

test('the menu offers system, and the light and the dark aurora theme', () => {
  expect(themes).toEqual(['system', light, dark])
  expect([light.label, dark.label]).toEqual(['Aurora light', 'Aurora dark'])
})

test('both themes set the same tokens, so a swap leaves nothing behind', () => {
  expect(Object.keys(dark.tokens).sort()).toEqual(Object.keys(light.tokens).sort())
})

test('each theme takes its color-scheme from its base', () => {
  expect(colorSchemeOf(applyTheme(light).tokens)).toEqual('light')
  expect(colorSchemeOf(applyTheme(dark).tokens)).toEqual('dark')
})

test('a theme applies its tokens on top of the built-in base', () => {
  applyTheme(dark)
  expect(appliedTheme.get().name).toEqual('aurora-dark')
  expect(appliedTheme.get().tokens['color-primary']).toEqual('#a18dff')
  expect(appliedTheme.get().tokens['space-3']).toBeTruthy()
  expect(document.documentElement.style.getPropertyValue('--imp-color-primary')).toEqual('#a18dff')
  expect(document.documentElement.style.getPropertyValue('color-scheme')).toEqual('dark')
})
