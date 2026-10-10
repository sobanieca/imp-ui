import { mount } from 'imp'
import { link } from 'imp/std'
import { card } from 'imp/std/display'
import { list, timeline } from 'imp/std/data'
import { appLogo, breadcrumbs, userCard } from 'imp/std/shell'
import { beforeEach, expect, spy, test } from 'imp/test'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const anchors = (host) => {
  const found = []
  const walk = (root) => {
    for (const node of root.querySelectorAll('*')) {
      if (node.localName === 'a') found.push(node)
      if (node.shadowRoot) walk(node.shadowRoot)
    }
  }
  walk(host.shadowRoot)
  return found
}

const hrefs = (host) => anchors(host).map((node) => node.getAttribute('href'))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const UNSAFE = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  ' javascript:alert(1)',
  'java\tscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
]

const SAFE = [
  'https://example.com/a',
  'http://example.com/a',
  'mailto:ada@example.com',
  'tel:+48123456789',
  '/orders/8f3a',
  'orders/8f3a',
  '../up',
  '?tab=2',
  '#section',
  '//example.com/a',
]

beforeEach(() => {
  document.body.replaceChildren()
})

test('link renders every safe href as given', () => {
  for (const href of SAFE) {
    const host = mounted(link({ href, external: href.startsWith('http') }, 'Go'))
    expect(hrefs(host)).toEqual([href])
  }
})

test('link drops an href with an unsafe scheme and says which scheme', () => {
  const warn = warnings()
  for (const href of UNSAFE) {
    const host = mounted(link({ href }, 'Go'))
    const anchor = host.shadowRoot.querySelector('a')
    expect(anchor.hasAttribute('href')).toEqual(false)
  }
  expect(warned(warn, "link: an 'href' with the scheme 'javascript:' is not followed")).toBeTruthy()
  expect(warned(warn, "the scheme 'data:'")).toBeTruthy()
  expect(warned(warn, "the scheme 'vbscript:'")).toBeTruthy()
})

test('card with an unsafe href renders as a plain card, not a link', () => {
  warnings()
  const host = mounted(card({ href: 'javascript:alert(1)' }, 'Body'))
  expect(anchors(host)).toEqual([])
  expect(host.shadowRoot.querySelector('.card').localName).toEqual('div')
})

test('userCard and appLogo with an unsafe href render no link', () => {
  const warn = warnings()
  const user = mounted(userCard({ name: 'Ada Lovelace', href: 'javascript:alert(1)' }))
  const logo = mounted(appLogo({ label: 'Acme', href: 'data:text/html,x' }))
  expect(anchors(user)).toEqual([])
  expect(anchors(logo)).toEqual([])
  expect(warned(warn, 'userCard:')).toBeTruthy()
  expect(warned(warn, 'appLogo:')).toBeTruthy()
})

test('breadcrumbs, list and timeline drop an unsafe item href and keep the safe ones', () => {
  warnings()
  const crumbs = mounted(breadcrumbs({
    items: [
      { id: 'home', label: 'Home', href: '/' },
      { id: 'bad', label: 'Bad', href: 'javascript:alert(1)' },
      { id: 'here', label: 'Here' },
    ],
  }))
  expect(hrefs(crumbs)).toEqual(['/'])
  const rows = mounted(list({
    label: 'Rows',
    items: [
      { id: 'good', title: 'Good', href: '/good' },
      { id: 'bad', title: 'Bad', href: 'javascript:alert(1)' },
    ],
  }))
  expect(hrefs(rows)).toEqual(['/good'])
  const events = mounted(timeline({
    label: 'Events',
    items: [
      { id: 'good', time: '2026-09-21', title: 'Good', href: 'https://example.com' },
      { id: 'bad', time: '2026-09-22', title: 'Bad', href: 'vbscript:msgbox(1)' },
    ],
  }))
  expect(hrefs(events)).toEqual(['https://example.com'])
})
