import { component, mount } from 'imp'
import { applyTheme, theme } from 'imp/theme'
import { lang } from 'imp/i18n'
import { appLogo, breadcrumbs, langSelect, themeSelect, userCard } from 'imp/std/shell'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'
import { initState } from 'imp/state'

const stateHost = component('shell-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const change = (node) => node.dispatchEvent(new Event('change', { bubbles: true }))

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

test('appLogo renders a link home carrying the app name', () => {
  const host = mounted(appLogo({ label: 'Acme', tagline: 'Operations' }))
  expect(host.localName).toEqual('imp-app-logo')
  const root = inner(host, '.root')
  expect(root.localName).toEqual('a')
  expect(root.getAttribute('href')).toEqual('/')
  expect(renderedText(inner(host, '.label'))).toEqual('Acme')
  expect(renderedText(inner(host, '.tagline'))).toEqual('Operations')
})

test('appLogo draws an image mark with empty alt beside the name', () => {
  const host = mounted(appLogo({ label: 'Acme', src: '/logo.svg' }))
  const image = inner(host, '.mark img')
  expect(image.getAttribute('src')).toEqual('/logo.svg')
  expect(image.getAttribute('alt')).toEqual('')
})

test('appLogo picks the mark for the colour scheme of the active theme', () => {
  applyTheme('imp-light')
  const host = mounted(appLogo({ label: 'Acme', src: { light: '/light.svg', dark: '/dark.svg' } }))
  const image = inner(host, '.mark img')
  expect(image.getAttribute('src')).toEqual('/light.svg')
  applyTheme('imp-dark')
  expect(image.getAttribute('src')).toEqual('/dark.svg')
  applyTheme({ name: 'inky', tokens: { 'color-surface': '#101010' } })
  expect(image.getAttribute('src')).toEqual('/dark.svg')
  const warn = warnings()
  applyTheme({ name: 'unscoped', tokens: {} })
  expect(warned(warn, 'color-surface')).toBeTruthy()
  expect(image.getAttribute('src')).toEqual('/light.svg')
})

test('appLogo with one scheme entry uses it for both schemes', () => {
  applyTheme('imp-dark')
  const host = mounted(appLogo({ label: 'Acme', src: { light: '/light.svg' } }))
  expect(inner(host, '.mark img').getAttribute('src')).toEqual('/light.svg')
})

test('appLogo with an empty src object warns and draws no mark', () => {
  const warn = warnings()
  const host = mounted(appLogo({ label: 'Acme', src: {} }))
  expect(inner(host, '.mark')).toEqual(null)
  expect(warned(warn, "needs a 'light' or a 'dark' entry")).toBeTruthy()
})

test('appLogo without an href is a plain box, not a link', () => {
  const host = mounted(appLogo({ label: 'Acme', href: null }))
  expect(inner(host, '.root').localName).toEqual('div')
})

test('a compact appLogo keeps the name for a screen reader', () => {
  const host = mounted(appLogo({ label: 'Acme', compact: true }))
  expect(inner(host, '.root').classList.contains('compact')).toBeTruthy()
  expect(renderedText(inner(host, '.label'))).toEqual('Acme')
})

test('appLogo with nothing to show warns', () => {
  const warn = warnings()
  mounted(appLogo({}))
  expect(warned(warn, "needs a 'label', an 'src' or an 'icon'")).toBeTruthy()
})

const trail = () => [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'orders', label: 'Orders', href: '/orders' },
  { id: 'order', label: 'Order 8f3a', href: '/orders/8f3a' },
]

test('breadcrumbs renders a named nav of an ordered list', () => {
  const host = mounted(breadcrumbs({ items: trail() }))
  expect(host.localName).toEqual('imp-breadcrumbs')
  expect(inner(host, 'nav').getAttribute('aria-label')).toEqual('Breadcrumb')
  expect(all(host, 'li').length).toEqual(3)
})

test('breadcrumbs makes only the last crumb the current page', () => {
  const host = mounted(breadcrumbs({ items: trail() }))
  const crumbs = all(host, '.crumb')
  expect(crumbs.map((crumb) => crumb.localName)).toEqual(['a', 'a', 'span'])
  expect(crumbs.map((crumb) => crumb.getAttribute('aria-current'))).toEqual([null, null, 'page'])
  expect(renderedText(crumbs[2])).toEqual('Order 8f3a')
})

test('breadcrumbs hides its separators from assistive tech', () => {
  const host = mounted(breadcrumbs({ items: trail(), separator: '>' }))
  const separators = all(host, '.separator')
  expect(separators.length).toEqual(2)
  expect(separators[0].getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(separators[0])).toEqual('>')
})

test('breadcrumbs reports a click as a cancelable select event before onClick', () => {
  const seen = []
  const host = mounted(
    breadcrumbs({
      items: [
        { id: 'orders', label: 'Orders', href: '/orders', onClick: () => seen.push('click') },
        { id: 'order', label: 'Order' },
      ],
      events: {
        select: (event) => {
          event.preventDefault()
          seen.push(event.detail.id)
        },
      },
    }),
  )
  click(all(host, '.crumb')[0])
  expect(seen).toEqual(['orders'])
})

test('breadcrumbs calls a crumb onClick when nothing cancels it', () => {
  const seen = []
  const host = mounted(
    breadcrumbs({
      items: [
        { id: 'orders', label: 'Orders', onClick: ({ id }) => seen.push(id) },
        { id: 'order', label: 'Order' },
      ],
    }),
  )
  const crumb = all(host, '.crumb')[0]
  expect(crumb.localName).toEqual('button')
  click(crumb)
  expect(seen).toEqual(['orders'])
})

test('a state-shaped items prop rebuilds the trail in place', () => {
  let items
  const outer = mounted(stateHost((self) => {
    items = initState(self, 'test.crumbs', [{ id: 'home', label: 'Home' }])
    return breadcrumbs({ items })
  }))
  const host = outer.shadowRoot.querySelector('imp-breadcrumbs')
  expect(all(host, '.crumb').length).toEqual(1)
  items.set(trail())
  expect(all(host, '.crumb').length).toEqual(3)
})

test('a crumb with options gets a picker that lists them as links', () => {
  const host = mounted(
    breadcrumbs({
      items: [
        { id: 'home', label: 'Home', href: '/' },
        {
          id: 'repo',
          label: 'imp-ui',
          href: '/repos/imp-ui',
          options: [
            { id: 'imp-ui', label: 'imp-ui', href: '/repos/imp-ui' },
            { id: 'imp-site', label: 'imp-site', href: '/repos/imp-site' },
          ],
        },
        { id: 'file', label: 'README' },
      ],
    }),
  )
  const picker = inner(host, '.picker')
  expect(picker.localName).toEqual('button')
  expect(picker.getAttribute('aria-label')).toEqual('Change imp-ui')
  expect(picker.getAttribute('aria-expanded')).toEqual('false')
  expect(picker.getAttribute('popovertarget')).toEqual(inner(host, '.panel').id)
  expect(inner(host, '.panel').getAttribute('role')).toEqual('menu')
  const options = all(host, '.option')
  expect(options.map((option) => option.localName)).toEqual(['a', 'a'])
  expect(options.map((option) => option.getAttribute('href'))).toEqual([
    '/repos/imp-ui',
    '/repos/imp-site',
  ])
  expect(all(host, '.crumb').length).toEqual(3)
})

test('a picked option reports select with the crumb it belongs to', () => {
  const seen = []
  const host = mounted(
    breadcrumbs({
      items: [
        {
          id: 'repo',
          label: 'imp-ui',
          options: [{ id: 'imp-site', label: 'imp-site', onClick: ({ id }) => seen.push(id) }],
        },
        { id: 'file', label: 'README' },
      ],
      events: { select: (event) => seen.push(`${event.detail.id}@${event.detail.crumb?.id}`) },
    }),
  )
  click(inner(host, '.option'))
  expect(seen).toEqual(['imp-site@repo', 'imp-site'])
})

test('breadcrumbs warns about a crumb without a label', () => {
  const warn = warnings()
  const host = mounted(breadcrumbs({ items: [{ id: 'a' }, { id: 'b', label: 'B' }] }))
  expect(warned(warn, "a crumb is not an object with a 'label'")).toBeTruthy()
  expect(all(host, '.crumb').length).toEqual(1)
})

test('userCard falls back to initials taken from the name', () => {
  const host = mounted(
    userCard({ signedIn: true, name: 'Ada Lovelace', description: 'ada@example.com' }),
  )
  expect(host.localName).toEqual('imp-user-card')
  const avatar = inner(host, '.avatar')
  expect(avatar.textContent).toEqual('AL')
  expect(avatar.getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(inner(host, '.name'))).toEqual('Ada Lovelace')
  expect(renderedText(inner(host, '.description'))).toEqual('ada@example.com')
})

test('userCard draws the picture when there is one', () => {
  const host = mounted(userCard({ signedIn: true, name: 'Ada Lovelace', picture: '/ada.png' }))
  const image = inner(host, '.avatar img')
  expect(image.getAttribute('src')).toEqual('/ada.png')
  expect(image.getAttribute('alt')).toEqual('')
})

test('userCard with an href is a link to the account page', () => {
  const host = mounted(userCard({ signedIn: true, name: 'Ada Lovelace', href: '/account' }))
  const card = inner(host, '.card')
  expect(card.localName).toEqual('a')
  expect(card.getAttribute('href')).toEqual('/account')
})

test('a live name keeps the initials in step', () => {
  let person
  const outer = mounted(stateHost((self) => {
    person = initState(self, 'test.person', 'Ada Lovelace')
    return userCard({ signedIn: true, name: person })
  }))
  const host = outer.shadowRoot.querySelector('imp-user-card')
  expect(inner(host, '.avatar').textContent).toEqual('AL')
  person.set('Grace Hopper')
  expect(inner(host, '.avatar').textContent).toEqual('GH')
  expect(renderedText(inner(host, '.name'))).toEqual('Grace Hopper')
})

const buttonsOf = (host) =>
  all(host, 'imp-button').map((control) => control.shadowRoot.querySelector('button'))

const signInOf = (host) => buttonsOf(host)[0]

const signOutOf = (host) => buttonsOf(host)[1]

test('userCard shows a sign-in button while signed out and the person while signed in', () => {
  let session
  const outer = mounted(stateHost((self) => {
    session = initState(self, 'test.session', false)
    return userCard({
      signedIn: session,
      name: 'Ada Lovelace',
      onSignIn: () => session.set(true),
      onSignOut: () => session.set(false),
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-user-card')
  expect(inner(host, 'imp-button').hidden).toEqual(false)
  expect(inner(host, '.account').hidden).toEqual(true)
  expect(renderedText(signInOf(host))).toEqual('Sign in')
  click(signInOf(host))
  expect(session.get()).toEqual(true)
  expect(inner(host, 'imp-button').hidden).toEqual(true)
  expect(inner(host, '.account').hidden).toEqual(false)
  expect(renderedText(signOutOf(host))).toEqual('Sign out')
  expect(renderedText(inner(host, '.name'))).toEqual('Ada Lovelace')
  click(signOutOf(host))
  expect(session.get()).toEqual(false)
  expect(inner(host, '.account').hidden).toEqual(true)
})

test('userCard shows a spinner until an async handler settles', async () => {
  let release = null
  const host = mounted(
    userCard({ onSignIn: () => new Promise((resolve) => (release = resolve)) }),
  )
  click(signInOf(host))
  expect(signInOf(host).getAttribute('aria-busy')).toEqual('true')
  release()
  await settle()
  expect(signInOf(host).getAttribute('aria-busy')).toEqual('false')
})

test('userCard logs a rejected handler and stops being busy', async () => {
  const errors = spy(console, 'error', () => {})
  const host = mounted(userCard({ onSignIn: () => Promise.reject(new Error('offline')) }))
  click(signInOf(host))
  await settle()
  expect(errors.calls.length).toBeGreaterThan(0)
  expect(signInOf(host).getAttribute('aria-busy')).toEqual('false')
})

test('userCard without the handler it needs warns', () => {
  const warn = warnings()
  const host = mounted(userCard({}))
  click(signInOf(host))
  expect(warned(warn, "no 'onSignIn' function")).toBeTruthy()
})

test('userCard signed in without an onSignOut renders the card alone', () => {
  const host = mounted(userCard({ signedIn: true, name: 'Ada Lovelace' }))
  const account = inner(host, '.account')
  expect(account.hidden).toEqual(false)
  expect(account.querySelector('imp-button')).toEqual(null)
  expect(renderedText(inner(host, '.name'))).toEqual('Ada Lovelace')
})

test('userCard signed in without a name warns', () => {
  const warn = warnings()
  mounted(userCard({ signedIn: true }))
  expect(warned(warn, "needs a 'name'")).toBeTruthy()
})

test('themeSelect offers system, light and dark and names itself', () => {
  const host = mounted(themeSelect({ remember: false }))
  expect(host.localName).toEqual('imp-theme-select')
  const control = inner(host, 'select')
  expect(control.getAttribute('aria-label')).toEqual('Theme')
  expect([...control.options].map((option) => option.value)).toEqual([
    'system',
    'imp-light',
    'imp-dark',
  ])
  expect([...control.options].map((option) => option.text)).toEqual(['System', 'Light', 'Dark'])
})

test('themeSelect applies the theme that is chosen', () => {
  const host = mounted(themeSelect({ remember: false }))
  const control = inner(host, 'select')
  control.value = 'imp-dark'
  change(control)
  expect(theme.get().name).toEqual('imp-dark')
  expect(document.documentElement.style.getPropertyValue('color-scheme')).toEqual('dark')
})

test('themeSelect remembers the choice and applies it on the next mount', () => {
  const first = mounted(themeSelect())
  const control = inner(first, 'select')
  control.value = 'imp-dark'
  change(control)
  expect(localStorage.getItem('imp.theme')).toEqual('imp-dark')
  document.body.replaceChildren()
  const second = mounted(themeSelect())
  expect(inner(second, 'select').value).toEqual('imp-dark')
  expect(theme.get().name).toEqual('imp-dark')
})

test('themeSelect stores nothing when it is told not to remember', () => {
  const host = mounted(themeSelect({ remember: false }))
  const control = inner(host, 'select')
  control.value = 'imp-dark'
  change(control)
  expect(localStorage.getItem('imp.theme')).toEqual(null)
})

test('themeSelect takes a theme object under theme and a name under value', () => {
  const brand = {
    name: 'brand',
    tokens: { 'color-primary': '#ff0000', 'color-surface': '#ffffff' },
  }
  const host = mounted(
    themeSelect({ remember: false, themes: [{ value: 'brand', label: 'Brand', theme: brand }] }),
  )
  const control = inner(host, 'select')
  expect([...control.options].map((option) => option.text)).toEqual(['Brand'])
  control.value = 'brand'
  change(control)
  expect(theme.get().name).toEqual('brand')
  expect(document.documentElement.style.getPropertyValue('--imp-color-primary')).toEqual('#ff0000')
})

test('langSelect names each code in its own language', () => {
  const host = mounted(langSelect({ remember: false, languages: ['en', 'pl'] }))
  expect(host.localName).toEqual('imp-lang-select')
  const control = inner(host, 'select')
  expect(control.getAttribute('aria-label')).toEqual('Language')
  expect([...control.options].map((option) => option.value)).toEqual(['en', 'pl'])
  expect([...control.options].map((option) => option.text)).toEqual(['English', 'polski'])
})

test('langSelect switches the language and remembers it', async () => {
  const host = mounted(langSelect({ languages: ['en', 'pl'] }))
  const control = inner(host, 'select')
  control.value = 'pl'
  change(control)
  await settle()
  expect(lang.get()).toEqual('pl')
  expect(document.documentElement.getAttribute('lang')).toEqual('pl')
  expect(localStorage.getItem('imp.lang')).toEqual('pl')
  document.documentElement.setAttribute('lang', 'en')
})

test('langSelect shows the language already in force', () => {
  document.documentElement.setAttribute('lang', 'pl')
  const host = mounted(langSelect({ remember: false, languages: ['en', 'pl'] }))
  expect(inner(host, 'select').value).toEqual('pl')
  document.documentElement.setAttribute('lang', 'en')
})

test('langSelect without languages warns', () => {
  const warn = warnings()
  const host = mounted(langSelect({ remember: false }))
  expect(warned(warn, "needs a 'languages' array")).toBeTruthy()
  expect([...inner(host, 'select').options].length).toEqual(0)
})
