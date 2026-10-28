import { init, mount } from 'imp'
import { lang } from 'imp/i18n'
import { appliedTheme, theme } from 'imp/theme'
import { langSelect, themeSelect } from 'imp/std/shell'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const root = document.documentElement

const deviceScheme = () =>
  matchMedia('(prefers-color-scheme: dark)').matches ? 'brand-dark' : 'brand-light'

const brandLight = {
  name: 'brand-light',
  label: 'Light',
  base: 'imp-light',
  tokens: { 'color-primary': '#c2410c' },
}

const brandDark = {
  name: 'brand-dark',
  label: 'Dark',
  base: 'imp-dark',
  tokens: { 'color-primary': '#ff9455' },
}

const translations = {
  en: () => Promise.resolve({ default: { greeting: 'Hello' } }),
  pl: () => Promise.resolve({ default: { greeting: 'Cześć' } }),
}

const rejection = async (run) => {
  try {
    await run()
    return ''
  } catch (error) {
    return error.message
  }
}

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const menuOf = (host) => host.shadowRoot.querySelector('imp-menu-button')

const choiceLabels = (host) =>
  [...menuOf(host).shadowRoot.querySelectorAll('[role="menuitemradio"]')].map((option) =>
    renderedText(option).trim(),
  )

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
  root.setAttribute('lang', 'en')
})

test('init applies the starting theme of the listed themes', async () => {
  await init({ themes: ['system', brandDark, brandLight], theme: 'brand-dark' })
  expect(theme.get()).toEqual('brand-dark')
  expect(appliedTheme.get().name).toEqual('brand-dark')
  expect(root.style.getPropertyValue('--imp-color-primary')).toEqual('#ff9455')
})

test('init starts in the first listed theme when it is given no theme', async () => {
  await init({ themes: [brandLight, brandDark] })
  expect(theme.get()).toEqual('brand-light')
})

test('init takes the starting theme as the theme object too', async () => {
  await init({ themes: [brandLight, brandDark], theme: brandDark })
  expect(theme.get()).toEqual('brand-dark')
})

test('system applies the listed theme with the color-scheme of the device', async () => {
  await init({ themes: ['system', brandDark, brandLight], theme: 'system' })
  expect(theme.get()).toEqual('system')
  expect(appliedTheme.get().name).toEqual(deviceScheme())
})

test('theme.set applies a listed theme and warns about any other name', async () => {
  await init({ themes: ['system', brandDark, brandLight], theme: 'system' })
  theme.set('brand-light')
  expect(appliedTheme.get().name).toEqual('brand-light')
  const warn = spy(console, 'warn', () => {})
  theme.set('imp-dark')
  expect(appliedTheme.get().name).toEqual('brand-light')
  expect(warn.calls.some(([first]) => String(first).includes("'imp-dark' is not a theme"))).toEqual(
    true,
  )
})

test('themeSelect offers the themes of init with their labels', async () => {
  await init({ themes: ['system', brandDark, brandLight], theme: 'system' })
  const host = mounted(themeSelect())
  expect(choiceLabels(host)).toEqual(['System', 'Dark', 'Light'])
})

test('init with persist stores a choice and starts in it the next time', async () => {
  await init({ themes: ['system', brandDark, brandLight], theme: 'system', persist: true })
  expect(localStorage.getItem('imp.theme')).toEqual(null)
  theme.set('brand-dark')
  expect(localStorage.getItem('imp.theme')).toEqual('brand-dark')
  await init({ themes: ['system', brandDark, brandLight], theme: 'system', persist: true })
  expect(theme.get()).toEqual('brand-dark')
  expect(appliedTheme.get().name).toEqual('brand-dark')
})

test('init ignores a stored theme that the list does not have', async () => {
  localStorage.setItem('imp.theme', 'ocean')
  await init({ themes: [brandLight, brandDark], theme: 'brand-dark', persist: true })
  expect(theme.get()).toEqual('brand-dark')
})

test('init without persist ignores a stored theme and stores nothing', async () => {
  localStorage.setItem('imp.theme', 'brand-dark')
  await init({ themes: [brandLight, brandDark], theme: 'brand-light' })
  expect(theme.get()).toEqual('brand-light')
  localStorage.removeItem('imp.theme')
  theme.set('brand-dark')
  expect(localStorage.getItem('imp.theme')).toEqual(null)
})

test('init with one theme and no list makes that theme the only choice', async () => {
  await init({ theme: brandDark })
  expect(theme.get()).toEqual('brand-dark')
  expect(choiceLabels(mounted(themeSelect()))).toEqual(['Dark'])
})

test('init rejects a list that cannot follow the device, a duplicate and an unlisted theme', async () => {
  expect(await rejection(() => init({ themes: ['system', brandDark] }))).toContain(
    "needs a theme with 'color-scheme' 'light'",
  )
  expect(await rejection(() => init({ themes: [brandDark, brandDark] }))).toContain('twice')
  expect(await rejection(() => init({ themes: [brandDark], theme: 'brand-light' }))).toContain(
    'does not list',
  )
  expect(await rejection(() => init({ themes: [] }))).toContain('non-empty array')
  expect(await rejection(() => init({ persist: 'yes' }))).toContain('init({ persist })')
  expect(await rejection(() => init({ persist: { theme: true, font: true } }))).toContain(
    'init({ persist })',
  )
})

test('init with persist starts in the stored language', async () => {
  localStorage.setItem('imp.lang', 'pl')
  await init({ translations, lang: 'en', persist: true })
  expect(lang.get()).toEqual('pl')
})

test('lang.set stores the language when init asks to persist it', async () => {
  await init({ translations, lang: 'en', persist: { lang: true } })
  expect(localStorage.getItem('imp.lang')).toEqual(null)
  await lang.set('pl')
  expect(localStorage.getItem('imp.lang')).toEqual('pl')
  await init({ translations, lang: 'en', persist: { lang: false } })
  expect(lang.get()).toEqual('en')
})

test('init ignores a stored language that the translations do not offer', async () => {
  localStorage.setItem('imp.lang', 'de')
  await init({ translations, lang: 'en', persist: true })
  expect(lang.get()).toEqual('en')
})

test('langSelect offers the languages of init when it is given none', async () => {
  await init({ translations, lang: 'en' })
  const host = mounted(langSelect())
  expect(choiceLabels(host)).toEqual(['English', 'polski'])
  await settle()
})
