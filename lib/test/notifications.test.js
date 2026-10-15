import { init, mount } from 'imp'
import { div } from 'imp/html'
import { setLang } from 'imp/i18n'
import { dismiss, notify, toast } from 'imp/std/feedback'
import { notifications } from 'imp/std/shell'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'

const raised = []

const raise = (data) => {
  raised.push(data.id)
  return notify(data)
}

const settled = async () => {
  for (let tick = 0; tick < 5; tick += 1) await Promise.resolve()
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const mounted = (host, ...around) => {
  mount(document.body, div(host, ...around))
  return host
}

const bellOf = (host) =>
  host.shadowRoot.querySelector('imp-button').shadowRoot.querySelector('button')

const countOf = (host) =>
  host.shadowRoot.querySelector('.count imp-tag')?.shadowRoot.textContent.trim() ?? null

const drawerOf = (host) => host.shadowRoot.querySelector('imp-drawer')

const panelOf = (host) => drawerOf(host).shadowRoot.querySelector('.panel')

const listOf = (host) => drawerOf(host).shadowRoot.querySelector('imp-notification-list').shadowRoot

const rowsOf = (host) => [...listOf(host).querySelectorAll('.item')]

const titlesOf = (host) => rowsOf(host).map((row) => row.querySelector('.title').textContent)

const controlsOf = (node) => {
  const found = []
  const walk = (parent) => {
    for (const child of parent.children) {
      if (child.matches('button, a[href]')) found.push(child)
      if (child.shadowRoot) walk(child.shadowRoot)
      walk(child)
    }
  }
  walk(node)
  return found
}

const nameOf = (control) => control.getAttribute('aria-label') ?? control.textContent.trim()

const controlNamed = (node, name) => controlsOf(node).find((control) => nameOf(control) === name)

const click = (node) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

const escape = (node) => {
  node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))
}

const styleText = (host) =>
  [...host.shadowRoot.adoptedStyleSheets]
    .map((sheet) => [...sheet.cssRules].map((rule) => rule.cssText).join('\n'))
    .join('\n')

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const invoice = () => ({
  id: 'invoice',
  kind: 'warning',
  title: 'Invoice 1042 is overdue',
  description: 'The payment was due three days ago.',
  link: { href: '/invoices/1042', label: 'Open the invoice' },
  actions: [
    { id: 'remind', label: 'Send a reminder' },
    { id: 'ignore', label: 'Ignore' },
  ],
})

beforeEach(async () => {
  document.documentElement.dir = 'ltr'
  document.documentElement.style.overflow = ''
  document.body.replaceChildren()
  await settled()
})

afterEach(async () => {
  for (const id of raised.splice(0)) dismiss(id)
  await settled()
})

for (const direction of ['ltr', 'rtl']) {
  test(`${direction}: the bell is a real button whose name carries the unread count`, () => {
    document.documentElement.dir = direction
    const host = mounted(notifications())
    const bell = bellOf(host)
    expect(host.localName).toEqual('imp-notifications')
    expect(bell.localName).toEqual('button')
    expect(bell.getAttribute('aria-label')).toEqual('Notifications')
    expect(bell.getAttribute('aria-expanded')).toEqual('false')
    expect(bell.querySelector('imp-icon')).toBeTruthy()
    expect(countOf(host)).toEqual(null)
    raise({ id: 'one', title: 'One' })
    raise({ id: 'two', title: 'Two' })
    raise({ id: 'plain', title: 'A plain toast', ttl: 0 })
    expect(bellOf(host)).toEqual(bell)
    expect(bell.getAttribute('aria-label')).toEqual('Notifications, 2 unread')
    expect(bell.hasAttribute('aria-live')).toEqual(false)
    expect(countOf(host)).toEqual('2')
    expect(host.shadowRoot.querySelector('.count').getAttribute('aria-hidden')).toEqual('true')
  })

  test(`${direction}: a press opens a modal drawer of the entries and marks them as read`, async () => {
    document.documentElement.dir = direction
    const host = mounted(notifications())
    raise({ id: 'one', title: 'One' })
    raise({ id: 'two', title: 'Two' })
    raise({ id: 'plain', title: 'A plain toast', ttl: 0 })
    const panel = panelOf(host)
    expect(panel.localName).toEqual('dialog')
    expect(panel.open).toEqual(false)
    click(bellOf(host))
    expect(panel.open).toEqual(true)
    expect(panel.hasAttribute('data-modal')).toBeTruthy()
    const title = drawerOf(host).shadowRoot.getElementById(panel.getAttribute('aria-labelledby'))
    expect(title.textContent).toEqual('Notifications')
    expect(bellOf(host).getAttribute('aria-expanded')).toEqual('true')
    expect(titlesOf(host)).toEqual(['Two', 'One'])
    expect(bellOf(host).getAttribute('aria-label')).toEqual('Notifications')
    expect(countOf(host)).toEqual(null)
    escape(panel)
    await settled()
    expect(panel.open).toEqual(false)
    expect(bellOf(host).getAttribute('aria-expanded')).toEqual('false')
  })
}

test('the count sits at the block-start inline-end corner of the bell in logical terms', () => {
  const css = styleText(mounted(notifications()))
  expect(css).toContain('inset-block-start')
  expect(css).toContain('inset-inline-end')
  expect(css).not.toMatch(/(^|[^-])(left|right|top|bottom):/)
})

test('an empty list renders the empty state and no foot', () => {
  const host = mounted(notifications())
  click(bellOf(host))
  const empty = listOf(host).querySelector('imp-empty-state')
  expect(empty.hidden).toEqual(false)
  expect(empty.shadowRoot.querySelector('.title').textContent).toEqual('No notifications')
  expect(listOf(host).querySelector('.foot').hidden).toEqual(true)
  raise({ id: 'one', title: 'One' })
  expect(empty.hidden).toEqual(true)
  expect(listOf(host).querySelector('.foot').hidden).toEqual(false)
})

test(
  'a row shows the content of the popup, its controls, and a relative time that stays current',
  async ({ clock }) => {
    const host = mounted(notifications())
    raise(invoice())
    await clock.tick(20)
    const [row] = rowsOf(host)
    expect(row.querySelector('.row').getAttribute('aria-label')).toEqual('Invoice 1042 is overdue')
    expect(row.querySelector('.description').textContent).toEqual(
      'The payment was due three days ago.',
    )
    expect(controlsOf(row).map(nameOf)).toEqual([
      'Open the invoice',
      'Send a reminder',
      'Ignore',
      'Dismiss',
    ])
    expect(row.querySelector('.time').textContent).toEqual('now')
    click(bellOf(host))
    await clock.tick(3 * 60_000)
    expect(row.querySelector('.time').textContent).toEqual('3 minutes ago')
    click(controlNamed(drawerOf(host).shadowRoot, 'Close'))
    await clock.tick(2 * 3_600_000)
    expect(row.querySelector('.time').textContent).toEqual('3 minutes ago')
    click(bellOf(host))
    expect(row.querySelector('.time').textContent).toEqual('2 hours ago')
  },
  { fakeTimers: { now: new Date('2026-09-21T10:00:00Z') } },
)

test('an action of a row resolves the promise and leaves the chosen label in place of the buttons', async () => {
  const host = mounted(notifications())
  const answer = raise(invoice())
  click(bellOf(host))
  click(controlNamed(rowsOf(host)[0], 'Ignore'))
  expect(await answer).toEqual('ignore')
  const [row] = rowsOf(host)
  expect(row.querySelector('.choice').textContent).toEqual('Ignore')
  expect(controlsOf(row).map(nameOf)).toEqual(['Open the invoice', 'Dismiss'])
})

test('the dismiss button of a row removes the entry and resolves the promise with null', async () => {
  const host = mounted(notifications())
  raise({ id: 'keep', title: 'Keep' })
  const answer = raise({ id: 'drop', title: 'Drop' })
  click(bellOf(host))
  click(controlNamed(rowsOf(host)[0], 'Dismiss'))
  expect(await answer).toEqual(null)
  expect(titlesOf(host)).toEqual(['Keep'])
})

test('the link of a row closes the drawer', async () => {
  const host = mounted(notifications())
  raise(invoice())
  click(bellOf(host))
  const link = controlNamed(rowsOf(host)[0], 'Open the invoice')
  link.addEventListener('click', (event) => event.preventDefault())
  click(link)
  await settled()
  expect(panelOf(host).open).toEqual(false)
})

test('a late arrival is read in the open list, and the foot clears the list', async () => {
  const host = mounted(notifications())
  raise({ id: 'early', title: 'Early' })
  click(bellOf(host))
  const late = raise({ id: 'late', title: 'Late' })
  expect(countOf(host)).toEqual(null)
  expect(titlesOf(host)).toEqual(['Late', 'Early'])
  expect(rowsOf(host)[0].querySelector('.row').classList.contains('unread')).toEqual(false)
  expect(controlsOf(listOf(host).querySelector('.foot')).map(nameOf)).toEqual(['Clear all'])
  click(controlNamed(listOf(host), 'Clear all'))
  expect(await late).toEqual(null)
  expect(titlesOf(host)).toEqual([])
  expect(listOf(host).querySelector('imp-empty-state').hidden).toEqual(false)
})

test(
  'the list follows the store: the limit of the region, an update in place, and the ttl',
  async ({ clock }) => {
    const region = toast({ limit: 3, ttl: 60_000 })
    const host = notifications()
    mount(document.body, div(region, host))
    await clock.tick(20)
    for (const id of ['a', 'b', 'c', 'd']) raise({ id, title: id.toUpperCase(), duration: 100 })
    expect(titlesOf(host)).toEqual(['D', 'C', 'B'])
    raise({ id: 'c', title: 'C again', duration: 100 })
    expect(titlesOf(host)).toEqual(['D', 'C again', 'B'])
    await clock.tick(1000)
    raise({ id: 'b', title: 'B again', duration: 100 })
    expect(titlesOf(host)).toEqual(['B again', 'D', 'C again'])
    expect(countOf(host)).toEqual('3')
    await clock.tick(59_000)
    expect(titlesOf(host)).toEqual(['B again'])
    await clock.tick(1000)
    expect(titlesOf(host)).toEqual([])
  },
  { fakeTimers: true },
)

test('the open list takes its entries out of the corner, and a plain toast stays', async () => {
  const region = toast()
  const host = notifications()
  mount(document.body, div(region, host))
  await nextFrame()
  const popups = () =>
    [...region.shadowRoot.querySelectorAll('.popup:not([data-closing]) .title')].map(
      (title) => title.textContent,
    )
  raise({ id: 'listed', title: 'Listed', duration: 0 })
  raise({ id: 'plain', title: 'Plain', ttl: 0, duration: 0 })
  expect(popups()).toEqual(['Plain', 'Listed'])
  click(bellOf(host))
  await settled()
  expect(popups()).toEqual(['Plain'])
  raise({ id: 'late', title: 'Late', duration: 0 })
  expect(popups()).toEqual(['Plain'])
  expect(titlesOf(host)).toEqual(['Late', 'Listed'])
  expect(countOf(host)).toEqual(null)
  click(controlNamed(drawerOf(host).shadowRoot, 'Close'))
  await settled()
  raise({ id: 'after', title: 'After', duration: 0 })
  expect(popups()).toEqual(['After', 'Plain'])
})

test('the focus moves to the next row when the focused row goes', () => {
  const host = mounted(notifications())
  raise({ id: 'older', title: 'Older' })
  raise({ id: 'newer', title: 'Newer' })
  click(bellOf(host))
  const dismissNewer = controlNamed(rowsOf(host)[0], 'Dismiss')
  dismissNewer.focus()
  dismissNewer.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }))
  click(dismissNewer)
  expect(titlesOf(host)).toEqual(['Older'])
  const focused = listOf(host).activeElement
  expect(rowsOf(host)[0].contains(focused)).toBeTruthy()
})

test('a label of the app replaces the name, and bad props are reported', () => {
  const warn = warnings()
  const host = mounted(notifications({ label: 'Alerts', variant: 'loud', tone: 'red' }))
  expect(bellOf(host).getAttribute('aria-label')).toEqual('Alerts')
  expect(warned(warn, "notifications: 'variant' must be one of")).toBeTruthy()
  expect(warned(warn, "notifications: unknown prop 'tone'")).toBeTruthy()
})

test('variant, size and events reach the button and the root', () => {
  const onClick = spy()
  const host = mounted(notifications({ variant: 'ghost', size: 'sm', events: { click: onClick } }))
  expect(bellOf(host).classList.contains('variant-ghost')).toBeTruthy()
  expect(bellOf(host).classList.contains('size-sm')).toBeTruthy()
  click(bellOf(host))
  expect(onClick.calls.length).toEqual(1)
})

test('every word follows the active language', async () => {
  const polish = {
    imp: {
      toast: { dismiss: 'Zamknij' },
      notifications: {
        label: 'Powiadomienia',
        labelUnread: 'Powiadomienia, nieprzeczytane: {count}',
        empty: 'Brak powiadomien',
        clearAll: 'Wyczysc wszystko',
      },
    },
  }
  await init({
    translations: {
      en: () => Promise.resolve({ default: {} }),
      pl: () => Promise.resolve({ default: polish }),
    },
  })
  const host = mounted(notifications())
  await setLang('pl')
  expect(bellOf(host).getAttribute('aria-label')).toEqual('Powiadomienia')
  expect(
    listOf(host).querySelector('imp-empty-state').shadowRoot.querySelector('.title').textContent,
  ).toEqual('Brak powiadomien')
  raise({ id: 'one', title: 'One' })
  expect(bellOf(host).getAttribute('aria-label')).toEqual('Powiadomienia, nieprzeczytane: 1')
  await nextFrame()
  expect(controlsOf(listOf(host)).map(nameOf)).toEqual(['Zamknij', 'Wyczysc wszystko'])
  expect(rowsOf(host)[0].querySelector('.time').textContent).toEqual('teraz')
  await setLang('en')
})
