import { component, mount } from 'imp'
import { applyTheme, theme } from 'imp/theme'
import { lang } from 'imp/i18n'
import {
  accountMenu,
  appLogo,
  breadcrumbs,
  langSelect,
  orgSelect,
  themeSelect,
  userCard,
} from 'imp/std/shell'
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
  applyTheme({ name: 'inky', tokens: { 'color-scheme': 'dark' } })
  expect(image.getAttribute('src')).toEqual('/dark.svg')
  const warn = warnings()
  applyTheme({ name: 'unscoped', tokens: {} })
  expect(warned(warn, 'color-scheme')).toBeTruthy()
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

test('appLogo with image renders the whole logo as one picture named by the label', () => {
  const host = mounted(appLogo({ label: 'Acme', image: '/acme.svg', tagline: 'Ops' }))
  const picture = inner(host, 'img.whole')
  expect(picture.getAttribute('src')).toEqual('/acme.svg')
  expect(picture.getAttribute('alt')).toEqual('Acme')
  expect(inner(host, '.words')).toEqual(null)
  expect(inner(host, '.mark')).toEqual(null)
  expect(renderedText(host)).toEqual('')
})

test('appLogo with an image per scheme follows the active theme', () => {
  applyTheme('imp-light')
  const host = mounted(appLogo({ label: 'Acme', image: { light: '/l.svg', dark: '/d.svg' } }))
  expect(inner(host, 'img.whole').getAttribute('src')).toEqual('/l.svg')
  applyTheme('imp-dark')
  expect(inner(host, 'img.whole').getAttribute('src')).toEqual('/d.svg')
  applyTheme('imp-light')
})

test('appLogo with an image warns about the props it ignores and about a missing label', () => {
  const warn = warnings()
  mounted(appLogo({ image: '/acme.svg', src: '/mark.svg', tagline: 'Ops' }))
  expect(warned(warn, "'image' needs a 'label'")).toBeTruthy()
  expect(warned(warn, "'src' is ignored beside 'image'")).toBeTruthy()
  expect(warned(warn, "'tagline' is ignored beside 'image'")).toBeTruthy()
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
  expect(warned(warn, "needs a 'label', an 'src', an 'icon' or an 'image'")).toBeTruthy()
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
  const outer = mounted(
    stateHost((self) => {
      items = initState(self, 'test.crumbs', [{ id: 'home', label: 'Home' }])
      return breadcrumbs({ items })
    }),
  )
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
  const host = mounted(userCard({ name: 'Ada Lovelace', description: 'ada@example.com' }))
  expect(host.localName).toEqual('imp-user-card')
  const avatar = inner(host, '.avatar')
  expect(avatar.textContent).toEqual('AL')
  expect(avatar.getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(inner(host, '.name'))).toEqual('Ada Lovelace')
  expect(renderedText(inner(host, '.description'))).toEqual('ada@example.com')
})

test('userCard draws the picture when there is one', () => {
  const host = mounted(userCard({ name: 'Ada Lovelace', picture: '/ada.png' }))
  const image = inner(host, '.avatar img')
  expect(image.getAttribute('src')).toEqual('/ada.png')
  expect(image.getAttribute('alt')).toEqual('')
})

test('userCard with an href is a link to the account page', () => {
  const host = mounted(userCard({ name: 'Ada Lovelace', href: '/account' }))
  const card = inner(host, '.card')
  expect(card.localName).toEqual('a')
  expect(card.getAttribute('href')).toEqual('/account')
})

test('a live name keeps the initials in step', () => {
  let person
  const outer = mounted(
    stateHost((self) => {
      person = initState(self, 'test.person', 'Ada Lovelace')
      return userCard({ name: person })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-user-card')
  expect(inner(host, '.avatar').textContent).toEqual('AL')
  person.set('Grace Hopper')
  expect(inner(host, '.avatar').textContent).toEqual('GH')
  expect(renderedText(inner(host, '.name'))).toEqual('Grace Hopper')
})

test('userCard renders no button and no menu of its own', () => {
  const host = mounted(userCard({ name: 'Ada Lovelace', description: 'ada@example.com' }))
  expect(all(host, 'imp-button').length).toEqual(0)
  expect(all(host, 'button').length).toEqual(0)
  expect(inner(host, '.card').localName).toEqual('div')
})

test('userCard without a name warns', () => {
  const warn = warnings()
  mounted(userCard({}))
  expect(warned(warn, "needs a 'name'")).toBeTruthy()
})

test('the props of the old authentication story are reported and dropped', () => {
  const warn = warnings()
  const host = mounted(
    userCard({ name: 'Ada', signedIn: true, onSignIn: () => {}, onSignOut: () => {} }),
  )
  expect(warned(warn, "unknown prop 'signedIn'")).toBeTruthy()
  expect(warned(warn, "unknown prop 'onSignOut'")).toBeTruthy()
  expect(all(host, 'imp-button').length).toEqual(0)
})

const pickerOf = (host) => inner(host, 'imp-menu-button')

const choicesOf = (host) => [
  ...pickerOf(host).shadowRoot.querySelectorAll('[role="menuitemradio"]'),
]

const choiceLabels = (host) => choicesOf(host).map((option) => renderedText(option).trim())

const checkedOf = (host) =>
  choiceLabels(host)[choicesOf(host).findIndex((o) => o.getAttribute('aria-checked') === 'true')]

const triggerOf = (host) => inner(inner(pickerOf(host), 'imp-button'), 'button')

const pick = (host, label) => click(choicesOf(host)[choiceLabels(host).indexOf(label)])

test('themeSelect is a menu of system, light and dark, and names itself after the choice', () => {
  applyTheme('imp-light')
  const host = mounted(themeSelect({ remember: false }))
  expect(host.localName).toEqual('imp-theme-select')
  expect(choiceLabels(host)).toEqual(['System', 'Light', 'Dark'])
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Theme: Light')
  expect(triggerOf(host).getAttribute('aria-haspopup')).toEqual('menu')
  expect(checkedOf(host)).toEqual('Light')
  expect(renderedText(triggerOf(host)).trim()).toEqual('Light')
})

test('themeSelect applies the theme that is chosen and checks it', () => {
  const host = mounted(themeSelect({ remember: false }))
  pick(host, 'Dark')
  expect(theme.get().name).toEqual('imp-dark')
  expect(document.documentElement.style.getPropertyValue('color-scheme')).toEqual('dark')
  expect(checkedOf(host)).toEqual('Dark')
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Theme: Dark')
  applyTheme('imp-light')
  expect(checkedOf(host)).toEqual('Light')
})

test('themeSelect keeps System checked when the system theme replaces another theme', () => {
  const systemTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'imp-dark' : 'imp-light'
  applyTheme(systemTheme === 'imp-dark' ? 'imp-light' : 'imp-dark')
  const host = mounted(themeSelect({ remember: false }))
  pick(host, 'System')
  expect(theme.get().name).toEqual(systemTheme)
  expect(checkedOf(host)).toEqual('System')
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Theme: System')
  applyTheme('imp-light')
})

test('themeSelect remembers the choice and applies it on the next mount', () => {
  const first = mounted(themeSelect())
  pick(first, 'Dark')
  expect(localStorage.getItem('imp.theme')).toEqual('imp-dark')
  document.body.replaceChildren()
  const second = mounted(themeSelect())
  expect(checkedOf(second)).toEqual('Dark')
  expect(theme.get().name).toEqual('imp-dark')
  applyTheme('imp-light')
})

test('themeSelect stores nothing when it is told not to remember', () => {
  const host = mounted(themeSelect({ remember: false }))
  pick(host, 'Dark')
  expect(localStorage.getItem('imp.theme')).toEqual(null)
  applyTheme('imp-light')
})

test('themeSelect takes a theme object under theme and a name under value', () => {
  const brand = {
    name: 'brand',
    tokens: { 'color-primary': '#ff0000', 'color-surface': '#ffffff' },
  }
  const host = mounted(
    themeSelect({ remember: false, themes: [{ value: 'brand', label: 'Brand', theme: brand }] }),
  )
  expect(choiceLabels(host)).toEqual(['Brand'])
  pick(host, 'Brand')
  expect(theme.get().name).toEqual('brand')
  expect(document.documentElement.style.getPropertyValue('--imp-color-primary')).toEqual('#ff0000')
  applyTheme('imp-light')
})

test('langSelect is a menu that names each code in its own language', () => {
  const host = mounted(langSelect({ remember: false, languages: ['en', 'pl'] }))
  expect(host.localName).toEqual('imp-lang-select')
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Language: English')
  expect(choiceLabels(host)).toEqual(['English', 'polski'])
  expect(checkedOf(host)).toEqual('English')
})

test('langSelect switches the language and remembers it', async () => {
  const host = mounted(langSelect({ languages: ['en', 'pl'] }))
  pick(host, 'polski')
  await settle()
  expect(lang.get()).toEqual('pl')
  expect(document.documentElement.getAttribute('lang')).toEqual('pl')
  expect(localStorage.getItem('imp.lang')).toEqual('pl')
  expect(checkedOf(host)).toEqual('polski')
  expect(renderedText(triggerOf(host)).trim()).toEqual('polski')
  document.documentElement.setAttribute('lang', 'en')
})

test('langSelect shows the language already in force', () => {
  document.documentElement.setAttribute('lang', 'pl')
  const host = mounted(langSelect({ remember: false, languages: ['en', 'pl'] }))
  expect(checkedOf(host)).toEqual('polski')
  document.documentElement.setAttribute('lang', 'en')
})

test('langSelect without languages warns', () => {
  const warn = warnings()
  const host = mounted(langSelect({ remember: false }))
  expect(warned(warn, "needs a 'languages' array")).toBeTruthy()
  expect(choicesOf(host).length).toEqual(0)
})

const ORGS = [
  { id: 'acme', name: 'Acme Corporation', description: 'Owner', picture: '/acme.png' },
  { id: 'globex', name: 'Globex' },
]

const deep = (node, ...selectors) =>
  selectors.reduce(
    (found, selector) =>
      found?.shadowRoot?.querySelector(selector) ?? found?.querySelector(selector) ?? null,
    node,
  )

const orgNames = (host) =>
  choicesOf(host).map((option) => renderedText(deep(option, 'imp-flex', 'imp-stack', 'imp-text')))

const checkedOrg = (host) =>
  orgNames(host)[choicesOf(host).findIndex((o) => o.getAttribute('aria-checked') === 'true')]

const pickOrg = (host, name) => click(choicesOf(host)[orgNames(host).indexOf(name)])

const triggerName = (host) => renderedText(triggerOf(host).querySelector('imp-flex')).trim()

test('orgSelect is a menu of the organizations with the current one on the trigger', () => {
  const host = mounted(orgSelect({ orgs: ORGS, selected: 'globex' }))
  expect(host.localName).toEqual('imp-org-select')
  expect(orgNames(host)).toEqual(['Acme Corporation', 'Globex'])
  expect(renderedText(choicesOf(host)[0])).toContain('Owner')
  expect(checkedOrg(host)).toEqual('Globex')
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Organization: Globex')
  expect(triggerName(host)).toEqual('GGlobex')
  const picture = deep(choicesOf(host)[0], 'imp-flex', 'imp-avatar', 'img')
  expect(picture.getAttribute('src')).toEqual('/acme.png')
})

test('orgSelect defaults to the first organization', () => {
  const host = mounted(orgSelect({ orgs: ORGS }))
  expect(checkedOrg(host)).toEqual('Acme Corporation')
  expect(triggerName(host)).toEqual('ACAcme Corporation')
})

test('a compact orgSelect shows the avatar alone on the trigger, named by its label', () => {
  const host = mounted(orgSelect({ orgs: ORGS, compact: true }))
  expect(triggerOf(host).querySelector('imp-flex')).toEqual(null)
  expect(triggerOf(host).querySelector('imp-avatar')).toBeTruthy()
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Organization: Acme Corporation')
})

test('a choice reports select with the organization and writes the id back into the state', () => {
  let current
  const chosen = []
  const outer = mounted(
    stateHost((self) => {
      current = initState(self, 'test.org', 'acme')
      return orgSelect({
        orgs: ORGS,
        selected: current,
        events: { select: (event) => chosen.push([event.detail.id, event.detail.org.name]) },
      })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-org-select')
  pickOrg(host, 'Globex')
  expect(chosen).toEqual([['globex', 'Globex']])
  expect(current.get()).toEqual('globex')
  expect(checkedOrg(host)).toEqual('Globex')
  expect(triggerOf(host).getAttribute('aria-label')).toEqual('Organization: Globex')
  current.set('acme')
  expect(checkedOrg(host)).toEqual('Acme Corporation')
  pickOrg(host, 'Acme Corporation')
  expect(chosen.length).toEqual(1)
})

test('a cancelled select keeps the current organization', () => {
  const host = mounted(
    orgSelect({ orgs: ORGS, selected: 'acme', events: { select: (e) => e.preventDefault() } }),
  )
  pickOrg(host, 'Globex')
  expect(checkedOrg(host)).toEqual('Acme Corporation')
})

test('orgSelect follows a live list of organizations', () => {
  let orgs
  const outer = mounted(
    stateHost((self) => {
      orgs = initState(self, 'test.orgs', ORGS.slice(0, 1))
      return orgSelect({ orgs })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-org-select')
  expect(orgNames(host)).toEqual(['Acme Corporation'])
  orgs.set(ORGS)
  expect(orgNames(host)).toEqual(['Acme Corporation', 'Globex'])
})

test('orgSelect warns about an empty list and a bad entry', () => {
  const warn = warnings()
  mounted(orgSelect({ orgs: [] }))
  expect(warned(warn, "'orgs' holds no organization")).toBeTruthy()
  mounted(orgSelect({ orgs: [{ id: 'x' }] }))
  expect(warned(warn, "an organization is not an object with a 'name'")).toBeTruthy()
})

test('accountMenu is a named avatar button that toggles a panel with the person', () => {
  const signedOut = []
  const host = mounted(
    accountMenu({
      name: 'Ada Lovelace',
      description: 'ada@example.com',
      onSignOut: () => signedOut.push(true),
    }),
  )
  const trigger = inner(host, 'imp-button').shadowRoot.querySelector('button')
  expect(trigger.getAttribute('aria-label')).toEqual('Account and settings')
  const panel = inner(host, '.panel')
  expect(panel.getAttribute('popover')).toEqual('auto')
  expect(panel.getAttribute('aria-label')).toEqual('Account')
  expect(trigger.popoverTargetElement).toEqual(panel)
  const card = panel.querySelector('imp-user-card')
  expect(renderedText(card)).toContain('Ada Lovelace')
  const signOut = [...panel.querySelectorAll('imp-button')].at(-1)
  expect(renderedText(signOut)).toEqual('Sign out')
  signOut.shadowRoot.querySelector('button').click()
  expect(signedOut).toEqual([true])
})

test('accountMenu puts its children in the panel and shows no sign-out without onSignOut', () => {
  const host = mounted(accountMenu({ name: 'Grace Hopper' }, themeSelect()))
  const panel = inner(host, '.panel')
  expect(panel.querySelector('imp-theme-select')).not.toEqual(null)
  expect(panel.querySelectorAll('imp-button').length).toEqual(0)
})

test('accountMenu closes its panel when the focus leaves it', () => {
  const host = mounted(accountMenu({ name: 'Ada' }, themeSelect()))
  const panel = inner(host, '.panel')
  panel.showPopover()
  const outside = document.body.appendChild(document.createElement('button'))
  panel.dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside }))
  expect(panel.matches(':popover-open')).toEqual(false)
})
