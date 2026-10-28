import { appMap, component, init, mount } from 'imp'
import { div } from 'imp/html'
import { computed } from 'imp/state'
import { appliedTheme } from 'imp/theme'
import { area, navigate, router } from 'imp/router'
import { shell } from 'imp/std/shell'
import { defaultMessages, dir, lang, missingMessages, t } from 'imp/i18n'
import { beforeAll, beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'

const root = document.documentElement

const probe = component('i18n-probe', { setup: (self, run) => run(self) })

const rejection = async (run) => {
  try {
    await run()
    return ''
  } catch (error) {
    return error.message
  }
}

const loaded = []

const loadsOf = (prefix) => loaded.filter((name) => name.startsWith(prefix))

const loader = (name, messages) => () => {
  loaded.push(name)
  return Promise.resolve({ default: messages })
}

beforeAll(async () => {
  await init({
    translations: {
      en: loader('root/en', {
        todo: { title: 'Todos', greeting: 'Hi, {name}', total: 'Total: {amount}' },
        appMap: { i18nSite: { home: { label: 'Start' } } },
      }),
      pl: loader('root/pl', {
        todo: { title: 'Zadania' },
        appMap: {
          label: 'Strona glowna',
          i18nSite: {
            home: { label: 'Start', description: 'Pierwsza strona' },
            manage: { label: 'Zarzadzanie', i18nAdmin: { label: 'Administracja' } },
          },
        },
      }),
      'en-GB': loader('root/en-GB', { todo: { title: 'Tasks' } }),
    },
  })
})

beforeEach(async () => {
  document.body.replaceChildren()
  await lang.set('en')
})

test('t looks a dotted key up in the current language', async () => {
  expect(t('todo.title')).toEqual('Todos')
  await lang.set('pl')
  expect(t('todo.title')).toEqual('Zadania')
})

test('lang.set writes the language onto <html lang>', async () => {
  await lang.set('pl')
  expect(root.getAttribute('lang')).toEqual('pl')
  expect(lang.get()).toEqual('pl')
})

test('writing <html lang> directly changes the language lang reports', () => {
  root.setAttribute('lang', 'pl')
  expect(lang.get()).toEqual('pl')
})

test('the text direction follows the language onto <html dir>', async () => {
  await lang.set('ar')
  expect(root.getAttribute('dir')).toEqual('rtl')
  expect(dir.get()).toEqual('rtl')
  await lang.set('en')
  expect(root.getAttribute('dir')).toEqual('ltr')
  expect(dir.get()).toEqual('ltr')
})

test('the direction comes from the script, not from the language alone', async () => {
  await lang.set('az-Arab')
  expect(dir.get()).toEqual('rtl')
  await lang.set('az-Latn')
  expect(dir.get()).toEqual('ltr')
  await lang.set('fa-IR')
  expect(dir.get()).toEqual('rtl')
})

test('writing <html lang> directly moves the direction with it', async () => {
  root.setAttribute('lang', 'he')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(root.getAttribute('dir')).toEqual('rtl')
  expect(dir.get()).toEqual('rtl')
})

test('writing <html dir> directly is kept until the language changes', async () => {
  root.setAttribute('dir', 'rtl')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(dir.get()).toEqual('rtl')
  await lang.set('pl')
  expect(root.getAttribute('dir')).toEqual('ltr')
})

test('dir.text re-renders its text node when the direction changes', async () => {
  mount(
    document.body,
    probe(() => div(dir.text())),
  )
  const rendered = document.querySelector('i18n-probe').shadowRoot.querySelector('div')
  expect(rendered.textContent).toEqual('ltr')
  await lang.set('ar')
  expect(rendered.textContent).toEqual('rtl')
})

test('a plain object interpolates {name} placeholders', () => {
  expect(t('todo.greeting', { name: 'Ada' })).toEqual('Hi, Ada')
})

test('an unknown placeholder is left in place', () => {
  expect(t('todo.greeting', { other: 'Ada' })).toEqual('Hi, {name}')
})

test('an interpolated value is stringified as-is', () => {
  expect(t('todo.total', { amount: 1234.5 })).toEqual('Total: 1234.5')
})

test('a regional language falls back to its base language', async () => {
  await lang.set('en-GB')
  expect(t('todo.title')).toEqual('Tasks')
  expect(t('todo.greeting', { name: 'Ada' })).toEqual('Hi, Ada')
})

test('an unregistered language falls back to the first registered one', async () => {
  await lang.set('de')
  expect(t('todo.title')).toEqual('Todos')
})

test('a missing key is warned about once and shown as the key', () => {
  const warn = spy(console, 'warn', () => {})
  expect(t('todo.missing')).toEqual('todo.missing')
  expect(t('todo.missing')).toEqual('todo.missing')
  expect(warn.calls.filter(([first]) => String(first).includes('todo.missing')).length).toEqual(1)
})

test('naming a group of messages is warned about, not thrown', () => {
  const warn = spy(console, 'warn', () => {})
  expect(t('todo')).toEqual('todo')
  expect(warn.calls.some(([first]) => String(first).includes('group of messages'))).toBeTruthy()
})

test('malformed arguments throw at the call site', async () => {
  expect(() => t(42)).toThrow('message key')
  expect(() => t('todo.title', 'Ada')).toThrow('placeholder values')
  expect(() => t('todo.title', 3)).toThrow('placeholder values')
  expect(await rejection(() => lang.set(''))).toContain('lang.set')
})

test('lang.text re-localizes its text node when the language changes', async () => {
  mount(
    document.body,
    probe(() => div(lang.text(() => t('todo.title')))),
  )
  const rendered = document.querySelector('i18n-probe').shadowRoot.querySelector('div')
  expect(rendered.textContent).toEqual('Todos')
  await lang.set('pl')
  expect(rendered.textContent).toEqual('Zadania')
})

test('a translated prop stays live through computed', async () => {
  mount(
    document.body,
    probe(() => div({ title: computed([lang], () => t('todo.title')) })),
  )
  const rendered = document.querySelector('i18n-probe').shadowRoot.querySelector('div')
  expect(rendered.getAttribute('title')).toEqual('Todos')
  await lang.set('pl')
  expect(rendered.getAttribute('title')).toEqual('Zadania')
})

test('writing <html lang> directly reaches watchers once the observer runs', async () => {
  const seen = []
  mount(
    document.body,
    probe(() => void lang.watch((current) => seen.push(current))),
  )
  root.setAttribute('lang', 'pl')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(seen).toEqual(['en', 'pl'])
})

const i18nMap = () => appMap({ i18nAdmin: {}, i18nHome: {}, i18nShadow: {}, i18nPlain: {} })

const adminArea = (app) => () =>
  Promise.resolve({
    default: area({
      screens: { [app.i18nAdmin]: () => div(lang.text(() => t('admin.title'))) },
      translations: {
        en: loader('admin/en', { admin: { title: 'Admin' } }),
        pl: loader('admin/pl', { admin: { title: 'Administracja' } }),
      },
    }),
  })

const areaApp = () => {
  const app = i18nMap()
  return div(
    router({
      map: app,
      screens: {
        [app.i18nAdmin]: area(adminArea(app)),
        [app.i18nHome]: () => div(t('todo.title')),
      },
    }),
  )
}

const navApp = () =>
  appMap({
    i18nSite: {
      home: 'The first page',
      manage: { i18nAdmin: {}, i18nShadow: {} },
      i18nPlain: {},
    },
  })

const shellLabels = (host, selector) =>
  [...host.shadowRoot.querySelectorAll(selector)].map((node) => node.textContent.trim())

test('a message under appMap.<id> names a node, its description, a group heading, and appMap.label names the root', async () => {
  const app = navApp()
  navigate('/i18n-site/home')
  const host = shell(
    { map: app, nav: { [app.i18nSite.manage]: { group: true } } },
    router({ map: app, screens: {} }),
  )
  mount(document.body, host)
  await settled()
  const screen = () => renderedText(host.shadowRoot.querySelector('.main imp-router'))
  expect(shellLabels(host, '.sidebar-body li a')).toEqual([
    'Start',
    'I18n admin',
    'I18n shadow',
    'I18n plain',
  ])
  expect(shellLabels(host, '.sidebar-body .group-title')).toEqual(['Manage'])
  const crumbs = () =>
    [
      ...host.shadowRoot
        .querySelector('.trail imp-breadcrumbs')
        .shadowRoot.querySelectorAll('.crumb'),
    ].map((node) => node.textContent.trim())
  expect(screen()).toEqual('StartThe first page')
  expect(crumbs()[0]).toEqual('Home')
  await lang.set('pl')
  await settled()
  expect(shellLabels(host, '.sidebar-body li a')).toEqual([
    'Start',
    'Administracja',
    'I18n shadow',
    'I18n plain',
  ])
  expect(shellLabels(host, '.sidebar-body .group-title')).toEqual(['Zarzadzanie'])
  expect(screen()).toEqual('StartPierwsza strona')
  expect(crumbs()[0]).toEqual('Strona glowna')
  expect(app.i18nSite.home.spec.label).toEqual('Home')
})

test('an area loads only the translations for the current language', async () => {
  loaded.length = 0
  navigate('/i18n-admin')
  mount(document.body, areaApp())
  await settled()
  expect(renderedText(document.body)).toEqual('Admin')
  expect(loadsOf('admin/')).toEqual(['admin/en'])
})

test("switching language loads the area's translations for it and drops the previous ones", async () => {
  loaded.length = 0
  navigate('/i18n-admin')
  mount(document.body, areaApp())
  await settled()
  await lang.set('pl')
  expect(renderedText(document.body)).toEqual('Administracja')
  expect(loadsOf('admin/')).toEqual(['admin/en', 'admin/pl'])
  await lang.set('en')
  expect(renderedText(document.body)).toEqual('Admin')
})

test('leaving an area releases its messages, and re-entering loads them again', async () => {
  const warn = spy(console, 'warn', () => {})
  loaded.length = 0
  navigate('/i18n-admin')
  mount(document.body, areaApp())
  await settled()
  expect(renderedText(document.body)).toEqual('Admin')

  navigate('/i18n-home')
  await settled()
  expect(renderedText(document.body)).toEqual('Todos')
  expect(t('admin.title')).toEqual('admin.title')
  expect(warn.calls.some(([first]) => String(first).includes('admin.title'))).toBeTruthy()

  navigate('/i18n-admin')
  await settled()
  expect(renderedText(document.body)).toEqual('Admin')
  expect(loadsOf('admin/')).toEqual(['admin/en', 'admin/en'])
})

test("an area's messages shadow the root's, and leaving restores them", async () => {
  const app = i18nMap()
  navigate('/i18n-shadow')
  mount(
    document.body,
    div(
      router({
        map: app,
        screens: {
          [app.i18nShadow]: area(() =>
            Promise.resolve({
              default: area({
                screens: { [app.i18nShadow]: () => div('shadow area') },
                translations: { en: loader('shadow/en', { todo: { title: 'Shadowed' } }) },
              }),
            }),
          ),
          [app.i18nHome]: () => div('home'),
        },
      }),
    ),
  )
  await settled()
  expect(t('todo.title')).toEqual('Shadowed')
  navigate('/i18n-home')
  await settled()
  expect(t('todo.title')).toEqual('Todos')
})

test('an area without translations still renders', async () => {
  const app = i18nMap()
  navigate('/i18n-plain')
  mount(
    document.body,
    div(
      router({
        map: app,
        screens: {
          [app.i18nPlain]: area(() =>
            Promise.resolve({
              default: area({ screens: { [app.i18nPlain]: () => div('plain area') } }),
            }),
          ),
        },
      }),
    ),
  )
  await settled()
  expect(renderedText(document.body)).toEqual('plain area')
})

test('init applies a theme and loads the translations for the starting language', async () => {
  loaded.length = 0
  await init({
    theme: 'imp-light',
    lang: 'pl',
    translations: {
      en: loader('second/en', { rootScreen: { title: 'Root' } }),
      pl: loader('second/pl', { rootScreen: { title: 'Korzeń' } }),
    },
  })
  expect(loadsOf('second/')).toEqual(['second/pl'])
  expect(lang.get()).toEqual('pl')
  expect(t('rootScreen.title')).toEqual('Korzeń')
  expect(appliedTheme.get().name).toEqual('imp-light')
  await lang.set('en')
  expect(t('rootScreen.title')).toEqual('Root')
  expect(loadsOf('second/')).toEqual(['second/pl', 'second/en'])
})

test('writing <html lang> directly loads that language too', async () => {
  loaded.length = 0
  await init({
    translations: {
      en: loader('adopt/en', { adopted: 'Adopted' }),
      pl: loader('adopt/pl', { adopted: 'Przyjęte' }),
    },
  })
  expect(t('adopted')).toEqual('Adopted')
  root.setAttribute('lang', 'pl')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(lang.get()).toEqual('pl')
  expect(t('adopted')).toEqual('Przyjęte')
  expect(loadsOf('adopt/')).toEqual(['adopt/en', 'adopt/pl'])
})

test('init rejects unknown options and malformed loaders', async () => {
  expect(await rejection(() => init({ nope: 1 }))).toContain('unknown option')
  expect(await rejection(() => init({ translations: { en: 'no' } }))).toContain('must import them')
  expect(await rejection(() => init({ translations: {} }))).toContain('object of loaders')
  expect(await rejection(() => init({ dir: 'sideways' }))).toContain('init({ dir })')
})

test('a default message is shown, and interpolated, when nothing translates its key', () => {
  const warn = spy(console, 'warn', () => {})
  defaultMessages({
    'imp.state.empty': 'Nothing here yet',
    'imp.table.page': 'Page {page} of {pages}',
  })
  expect(t('imp.state.empty')).toEqual('Nothing here yet')
  expect(t('imp.table.page', { page: 2, pages: 7 })).toEqual('Page 2 of 7')
  expect(warn.calls.some(([first]) => String(first).includes('imp.state.empty'))).toEqual(false)
})

test('defaultMessages rejects anything that is not a key-to-wording object', () => {
  expect(() => defaultMessages('Nothing here yet')).toThrow('defaultMessages')
  expect(() => defaultMessages({ 'imp state empty!': 'Nothing' })).toThrow('message key')
  expect(() => defaultMessages({ 'imp.state.empty': 3 })).toThrow('not a string')
})

test("an app's translation shadows the default wording, per language", async () => {
  defaultMessages({ 'imp.action.close': 'Close' })
  await init({
    translations: {
      en: loader('close/en', { imp: { action: { close: 'Dismiss' } } }),
      pl: loader('close/pl', {}),
    },
  })
  expect(t('imp.action.close')).toEqual('Dismiss')
  await lang.set('pl')
  expect(t('imp.action.close')).toEqual('Close')
})

test('missingMessages lists the default-backed keys the app has not translated', async () => {
  defaultMessages({ 'imp.state.saving': 'Saving...', 'imp.action.retry': 'Retry' })
  expect(missingMessages().includes('imp.state.saving')).toBeTruthy()
  expect(missingMessages().includes('imp.action.retry')).toBeTruthy()

  await init({
    translations: {
      en: loader('saving/en', { imp: { state: { saving: 'Storing...' } } }),
    },
  })
  expect(t('imp.state.saving')).toEqual('Storing...')
  expect(missingMessages().includes('imp.state.saving')).toEqual(false)
  expect(missingMessages().includes('imp.action.retry')).toBeTruthy()
})

test('init writes the direction even when it is given no language', async () => {
  root.removeAttribute('dir')
  await init({ theme: 'imp-light' })
  expect(root.getAttribute('dir')).toEqual('ltr')
})

test('init({ dir }) pins the direction against the language', async () => {
  await init({ dir: 'ltr' })
  await lang.set('ar')
  expect(root.getAttribute('dir')).toEqual('ltr')
  expect(dir.get()).toEqual('ltr')
})
