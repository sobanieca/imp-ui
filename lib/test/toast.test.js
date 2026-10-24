import { component, init, mount } from 'imp'
import { button as nativeButton, div } from 'imp/html'
import { initHttpClient } from 'imp/http'
import { setLang } from 'imp/i18n'
import { luRocket } from 'imp/icons'
import { dismiss, notify, toast } from 'imp/std/feedback'
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

const nextTask = () => new Promise((resolve) => setTimeout(resolve))

const mountedRegion = async (props, ...around) => {
  const host = toast(props)
  mount(document.body, div(host, ...around))
  await nextFrame()
  return host
}

const regionOf = (host) => host.shadowRoot.querySelector('.region')

const popupsOf = (host) => [...host.shadowRoot.querySelectorAll('.popup:not([data-closing])')]

const titlesOf = (host) => popupsOf(host).map((popup) => popup.querySelector('.title').textContent)

const liveText = (host, role) =>
  [...host.shadowRoot.querySelector(`[role="${role}"]`).querySelectorAll('p')].map(
    (line) => line.textContent,
  )

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

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const focusMoves = (node, type, relatedTarget = null) =>
  node.dispatchEvent(new FocusEvent(type, { bubbles: true, composed: true, relatedTarget }))

const FLUID_THEME_SCALE = /clamp\([^)]*\)/g

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
  duration: 0,
})

beforeEach(async () => {
  document.documentElement.dir = 'ltr'
  document.body.replaceChildren()
  await settled()
})

afterEach(async () => {
  for (const id of raised.splice(0)) dismiss(id)
  await settled()
})

for (const direction of ['ltr', 'rtl']) {
  test(`${direction}: the region is a named manual popover that shows only while a popup is up`, async () => {
    document.documentElement.dir = direction
    const host = await mountedRegion()
    const region = regionOf(host)
    expect(host.localName).toEqual('imp-toast')
    expect(region.getAttribute('popover')).toEqual('manual')
    expect(region.getAttribute('aria-label')).toEqual('Notifications')
    const toggles = []
    region.addEventListener('toggle', (event) => toggles.push(event.newState))
    raise({ id: 'sent', kind: 'success', title: 'Report sent' })
    await nextTask()
    expect(toggles).toEqual(['open'])
    expect(titlesOf(host)).toEqual(['Report sent'])
    dismiss('sent')
    await settled()
    await nextTask()
    expect(toggles).toEqual(['open', 'closed'])
    expect(host.shadowRoot.querySelectorAll('.popup').length).toEqual(0)
  })

  test(`${direction}: a popup is a named group of real controls in reading order`, async () => {
    document.documentElement.dir = direction
    const host = await mountedRegion()
    raise(invoice())
    const [popup] = popupsOf(host)
    const row = popup.querySelector('.row')
    expect(row.getAttribute('role')).toEqual('group')
    expect(row.getAttribute('aria-label')).toEqual('Invoice 1042 is overdue')
    expect(row.classList.contains('kind-warning')).toBeTruthy()
    const controls = controlsOf(popup)
    expect(controls.map(nameOf)).toEqual([
      'Open the invoice',
      'Send a reminder',
      'Ignore',
      'Dismiss',
    ])
    expect(controls.map((control) => control.localName)).toEqual([
      'a',
      'button',
      'button',
      'button',
    ])
    expect(controls.some((control) => control.hasAttribute('tabindex'))).toEqual(false)
    expect(controls[0].getAttribute('href')).toEqual('/invoices/1042')
  })

  test(`${direction}: escape closes the popup that holds the focus and gives the focus back`, async () => {
    document.documentElement.dir = direction
    const before = nativeButton('Before')
    const host = await mountedRegion({}, before)
    raise({ id: 'first', title: 'First', duration: 0 })
    raise({ id: 'second', title: 'Second', duration: 0 })
    before.focus()
    const [second] = popupsOf(host)
    const dismissButton = controlNamed(second, 'Dismiss')
    focusMoves(dismissButton, 'focusin', before)
    press(dismissButton, 'Escape')
    await settled()
    expect(titlesOf(host)).toEqual(['First'])
    expect(document.activeElement).toEqual(before)
  })
}

test('the stylesheet pins the region to the block-start inline-end corner in logical terms', async () => {
  const css = styleText(await mountedRegion())
  const regionRules = css
    .split('\n')
    .filter((line) => line.includes('.region'))
    .join('\n')
    .replaceAll(FLUID_THEME_SCALE, '')
  expect(css).toContain('inset-block-start: 0')
  expect(css).toContain('inset-inline-end: 0')
  expect(css).toContain('100dvi')
  expect(css).toContain('--overlay-offset: 100% 0')
  expect(css).toContain('.popup:dir(rtl)')
  expect(css).toContain('--overlay-offset: -100% 0')
  expect(css).toContain('prefers-reduced-motion: reduce')
  expect(regionRules).not.toMatch(/[^-]width:|[^-]left:|[^-]right:|[^-]top:|\d(vw|vh|dvh)\b/)
})

test('the newest popup is nearest to the corner and the rest wait for a slot', async () => {
  const host = await mountedRegion({ visible: 2 })
  for (const id of ['one', 'two', 'three']) raise({ id, title: id, duration: 0 })
  expect(titlesOf(host)).toEqual(['two', 'one'])
  click(controlNamed(popupsOf(host)[1], 'Dismiss'))
  await settled()
  expect(titlesOf(host)).toEqual(['three', 'two'])
})

test('the text lands in the status region or the alert region as notify runs', async () => {
  const host = await mountedRegion()
  const status = host.shadowRoot.querySelector('[role="status"]')
  const alert = host.shadowRoot.querySelector('[role="alert"]')
  expect(status.getAttribute('aria-atomic')).toEqual('false')
  expect(alert.getAttribute('aria-atomic')).toEqual('false')
  expect(regionOf(host).contains(status) || regionOf(host).contains(alert)).toEqual(false)
  raise({ id: 'info', title: 'Sync started' })
  raise({ id: 'done', kind: 'success', title: 'Report sent', description: 'To 4 people.' })
  raise({ id: 'late', kind: 'warning', title: 'Invoice overdue' })
  raise({ id: 'down', kind: 'error', title: 'Server unreachable' })
  expect(liveText(host, 'status')).toEqual(['Sync started', 'Report sent', 'To 4 people.'])
  expect(liveText(host, 'alert')).toEqual(['Invoice overdue', 'Server unreachable'])
  expect(
    host.shadowRoot.querySelectorAll('.popup [role="status"], .popup [role="alert"]').length,
  ).toEqual(0)
  dismiss('done')
  expect(liveText(host, 'status')).toEqual(['Sync started'])
})

test(
  'a popup leaves after its duration, and the timer waits while it holds the focus or the pointer',
  async ({ clock }) => {
    const host = toast({ duration: 1000 })
    mount(document.body, host)
    await clock.tick(20)
    raise({ id: 'short', title: 'Short' })
    raise({ id: 'own', title: 'Own time', duration: 3000 })
    raise({ id: 'sticky', title: 'Sticky', duration: 0 })
    await clock.tick(999)
    expect(titlesOf(host)).toEqual(['Sticky', 'Own time', 'Short'])
    await clock.tick(1)
    expect(titlesOf(host)).toEqual(['Sticky', 'Own time'])

    const own = popupsOf(host)[1]
    const dismissButton = controlNamed(own, 'Dismiss')
    focusMoves(dismissButton, 'focusin')
    await clock.tick(5000)
    expect(titlesOf(host)).toEqual(['Sticky', 'Own time'])
    own.dispatchEvent(new PointerEvent('pointerenter'))
    focusMoves(dismissButton, 'focusout')
    await clock.tick(5000)
    expect(titlesOf(host)).toEqual(['Sticky', 'Own time'])
    own.dispatchEvent(new PointerEvent('pointerleave'))
    await clock.tick(1999)
    expect(titlesOf(host)).toEqual(['Sticky', 'Own time'])
    await clock.tick(1)
    expect(titlesOf(host)).toEqual(['Sticky'])
  },
  { fakeTimers: true },
)

test('an action resolves the promise with its id and closes the popup', async () => {
  const host = await mountedRegion()
  const answer = raise(invoice())
  click(controlNamed(popupsOf(host)[0], 'Send a reminder'))
  expect(await answer).toEqual('remind')
  await settled()
  expect(titlesOf(host)).toEqual([])
})

test(
  'dismiss resolves the promise with null, and so does a plain toast that leaves the corner',
  async ({ clock }) => {
    const host = toast()
    mount(document.body, host)
    await clock.tick(20)
    const dismissed = raise({ id: 'gone', title: 'Gone', duration: 0 })
    dismiss('gone')
    expect(await dismissed).toEqual(null)
    const plain = raise({ id: 'plain', title: 'Saved', ttl: 0, duration: 500 })
    await clock.tick(500)
    expect(await plain).toEqual(null)
    expect(titlesOf(host)).toEqual([])
  },
  { fakeTimers: true },
)

test(
  'an entry expires after its ttl and resolves the promise with null',
  async ({ clock }) => {
    const host = toast({ ttl: 60_000 })
    mount(document.body, host)
    await clock.tick(20)
    let answer = 'pending'
    raise({ id: 'brief', title: 'Brief', duration: 0 }).then((value) => {
      answer = value
    })
    await clock.tick(59_999)
    expect(answer).toEqual('pending')
    expect(titlesOf(host)).toEqual(['Brief'])
    await clock.tick(1)
    expect(answer).toEqual(null)
    expect(titlesOf(host)).toEqual([])
  },
  { fakeTimers: true },
)

test('the store drops the oldest entry beyond the limit and resolves it with null', async () => {
  const host = await mountedRegion({ limit: 2, visible: 5 })
  const oldest = raise({ id: 'a', title: 'A', duration: 0 })
  raise({ id: 'b', title: 'B', duration: 0 })
  raise({ id: 'c', title: 'C', duration: 0 })
  expect(await oldest).toEqual(null)
  await settled()
  expect(titlesOf(host)).toEqual(['C', 'B'])
})

test(
  'a call with a listed id updates the popup in place, and shows it again once it has left',
  async ({ clock }) => {
    const host = toast({ duration: 1000 })
    mount(document.body, host)
    await clock.tick(20)
    raise({ id: 'job', title: 'Uploading', description: '10%' })
    raise({ id: 'other', title: 'Other', duration: 0 })
    const popup = popupsOf(host)[1]
    await clock.tick(900)
    raise({ id: 'job', title: 'Uploading', description: '60%' })
    expect(popupsOf(host)[1]).toEqual(popup)
    expect(popup.querySelector('.description').textContent).toEqual('60%')
    expect(liveText(host, 'status')).toEqual(['Uploading', '60%', 'Other'])
    await clock.tick(999)
    expect(titlesOf(host)).toEqual(['Other', 'Uploading'])
    await clock.tick(1)
    expect(titlesOf(host)).toEqual(['Other'])
    raise({ id: 'job', kind: 'success', title: 'Uploaded' })
    expect(titlesOf(host)).toEqual(['Uploaded', 'Other'])
  },
  { fakeTimers: true },
)

test('a popup draws the icon of its kind, an icon of its own, or an image', async () => {
  const host = await mountedRegion({ visible: 5 })
  raise({ id: 'kind', kind: 'error', title: 'Kind', duration: 0 })
  raise({ id: 'icon', title: 'Icon', icon: luRocket, duration: 0 })
  raise({ id: 'image', title: 'Image', image: '/ada.png', duration: 0 })
  const [image, icon, kind] = popupsOf(host)
  expect(image.querySelector('img').getAttribute('src')).toEqual('/ada.png')
  expect(image.querySelector('img').getAttribute('alt')).toEqual('')
  expect(image.querySelector('.mark imp-icon')).toEqual(null)
  expect(
    icon.querySelector('.mark imp-icon').shadowRoot.querySelectorAll('path').length,
  ).toBeGreaterThan(0)
  expect(
    kind
      .querySelector('.mark imp-icon')
      .shadowRoot.querySelector('svg')
      .classList.contains('color-danger'),
  ).toBeTruthy()
})

test('notify before the region mounts still shows the popup', async () => {
  raise({ id: 'early', title: 'Early', duration: 0 })
  const host = await mountedRegion()
  expect(titlesOf(host)).toEqual(['Early'])
  expect(liveText(host, 'status')).toEqual(['Early'])
})

test('notify in the task that removes the region raises no popover on a detached node', async () => {
  const host = await mountedRegion()
  const shown = spy(regionOf(host), 'showPopover')
  host.parentNode.remove()
  raise({ id: 'late', title: 'Late', duration: 0 })
  await settled()
  expect(shown.calls.length).toEqual(0)
})

test('a second region warns and renders nothing', async () => {
  const warn = warnings()
  const first = toast()
  const second = toast()
  mount(document.body, div(first, second))
  await nextFrame()
  expect(warned(warn, 'toast: a region is already mounted')).toBeTruthy()
  expect(second.shadowRoot.childNodes.length).toEqual(0)
  raise({ id: 'one', title: 'One', duration: 0 })
  expect(titlesOf(first)).toEqual(['One'])
})

test('bad data is reported and never thrown', async () => {
  const warn = warnings()
  await mountedRegion({ duration: -1, colour: 'red' })
  expect(warned(warn, "toast: 'duration' must be a number of 0 or more")).toBeTruthy()
  expect(warned(warn, "toast: unknown prop 'colour'")).toBeTruthy()
  expect(await notify({ description: 'No title' })).toEqual(null)
  expect(warned(warn, "notify: needs a 'title'")).toBeTruthy()
  raise({
    id: 'bad',
    title: 'Bad',
    kind: 'fatal',
    colour: 'red',
    link: { href: '/x' },
    actions: [1, 2, 3, 4].map((id) => ({ id: `a${id}`, label: `Action ${id}` })),
    duration: 0,
  })
  expect(warned(warn, "notify: 'kind' must be one of")).toBeTruthy()
  expect(warned(warn, "notify: unknown key 'colour'")).toBeTruthy()
  expect(warned(warn, "notify: 'link' must be { href, label, external? }")).toBeTruthy()
  expect(warned(warn, 'notify: takes up to 3 actions')).toBeTruthy()
})

test('the region and the dismiss button take their names from the active language', async () => {
  const polish = {
    imp: { toast: { dismiss: 'Zamknij' }, notifications: { label: 'Powiadomienia' } },
  }
  await init({
    translations: {
      en: () => Promise.resolve({ default: {} }),
      pl: () => Promise.resolve({ default: polish }),
    },
  })
  const host = await mountedRegion()
  raise({ id: 'named', title: 'Named', duration: 0 })
  expect(controlsOf(popupsOf(host)[0]).map(nameOf)).toEqual(['Dismiss'])
  await setLang('pl')
  expect(controlsOf(popupsOf(host)[0]).map(nameOf)).toEqual(['Zamknij'])
  expect(regionOf(host).getAttribute('aria-label')).toEqual('Powiadomienia')
  await setLang('en')
})

const apiHost = component('toast-api-host', {
  setup: (self, render) =>
    render(initHttpClient(self, 'acme.api', { baseUrl: 'https://acme.test' })),
})

test('a client failure becomes one error notification, worded by the client', async () => {
  spy(globalThis, 'fetch', () => Promise.resolve(new Response('', { status: 503 })))
  let api = null
  let host = null
  mount(
    document.body,
    apiHost((client) => {
      api = client
      host = toast({ client: 'acme.api' })
      return host
    }),
  )
  await nextFrame()
  await api.post('/reports').catch(() => {})
  await api.post('/reports').catch(() => {})
  raised.push('imp.http.acme.api.POST https://acme.test/reports')
  expect(titlesOf(host)).toEqual(['imp: http - POST https://acme.test/reports answered 503'])
  expect(popupsOf(host)[0].querySelector('.row').classList.contains('kind-error')).toBeTruthy()
  expect(liveText(host, 'alert')).toEqual([
    'imp: http - POST https://acme.test/reports answered 503',
  ])
})

test('message words a client failure from the error data', async () => {
  spy(globalThis, 'fetch', (url, init) =>
    Promise.resolve(
      init.method === 'POST'
        ? Response.json({ error: 'That team is full' }, { status: 422 })
        : new Response('', { status: 503 }),
    ),
  )
  let api = null
  let host = null
  mount(
    document.body,
    apiHost((client) => {
      api = client
      host = toast({ client: 'acme.api', message: (error) => error.body?.error })
      return host
    }),
  )
  await nextFrame()
  await api.post('/teams').catch(() => {})
  await api.get('/teams').catch(() => {})
  raised.push('imp.http.acme.api.POST https://acme.test/teams')
  raised.push('imp.http.acme.api.GET https://acme.test/teams')
  expect(titlesOf(host)).toEqual([
    'imp: http - GET https://acme.test/teams answered 503',
    'That team is full',
  ])
})
