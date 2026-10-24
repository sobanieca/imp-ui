import { component, mount } from 'imp'
import { avatar } from 'imp/std/display'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState } from 'imp/state'

const stateHost = component('avatar-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('avatar draws the initials and names itself as an image', () => {
  const host = mounted(avatar({ name: 'Ada Lovelace' }))
  expect(host.localName).toEqual('imp-avatar')
  const circle = inner(host, '.avatar')
  expect(circle.getAttribute('role')).toEqual('img')
  expect(circle.getAttribute('aria-label')).toEqual('Ada Lovelace')
  expect(circle.hasAttribute('aria-hidden')).toEqual(false)
  expect(inner(host, '.initials').textContent).toEqual('AL')
  expect(inner(host, 'img')).toEqual(null)
})

test('avatar takes one letter from a single word', () => {
  const host = mounted(avatar({ name: 'linus' }))
  expect(inner(host, '.initials').textContent).toEqual('L')
})

test('avatar defaults to the md size and the primary color', () => {
  const circle = inner(mounted(avatar({ name: 'Ada Lovelace' })), '.avatar')
  expect(circle.classList.contains('size-md')).toBeTruthy()
  expect(circle.classList.contains('color-primary')).toBeTruthy()
})

test('avatar takes a size and a palette color', () => {
  const circle = inner(
    mounted(avatar({ name: 'Platform Team', size: 'lg', color: 'violet' })),
    '.avatar',
  )
  expect(circle.classList.contains('size-lg')).toBeTruthy()
  expect(circle.classList.contains('color-violet')).toBeTruthy()
})

test('a decorative avatar is hidden from a screen reader', () => {
  const circle = inner(mounted(avatar({ name: 'Ada Lovelace', decorative: true })), '.avatar')
  expect(circle.getAttribute('aria-hidden')).toEqual('true')
  expect(circle.hasAttribute('role')).toEqual(false)
  expect(circle.hasAttribute('aria-label')).toEqual(false)
})

test('avatar shows the picture and hides the initials', () => {
  const host = mounted(avatar({ name: 'Ada Lovelace', picture: '/ada.jpg' }))
  const image = inner(host, 'img')
  expect(image.getAttribute('src')).toEqual('/ada.jpg')
  expect(image.getAttribute('alt')).toEqual('')
  expect(image.hidden).toEqual(false)
  expect(inner(host, '.initials').hidden).toEqual(true)
  expect(inner(host, '.avatar').getAttribute('aria-label')).toEqual('Ada Lovelace')
})

test('a picture that fails to load falls back to the initials', () => {
  const host = mounted(avatar({ name: 'Ada Lovelace', picture: '/missing.jpg' }))
  const image = inner(host, 'img')
  image.dispatchEvent(new Event('error'))
  expect(image.hidden).toEqual(true)
  expect(inner(host, '.initials').hidden).toEqual(false)
  expect(inner(host, '.initials').textContent).toEqual('AL')
})

test('a live name and a live picture update in place', () => {
  let person
  let portrait
  const outer = mounted(
    stateHost((self) => {
      person = initState(self, 'avatar.person', 'Ada Lovelace')
      portrait = initState(self, 'avatar.portrait', '/ada.jpg')
      return avatar({ name: person, picture: portrait })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-avatar')
  const circle = inner(host, '.avatar')
  const image = inner(host, 'img')
  person.set('Grace Hopper')
  expect(circle.getAttribute('aria-label')).toEqual('Grace Hopper')
  expect(inner(host, '.initials').textContent).toEqual('GH')
  image.dispatchEvent(new Event('error'))
  expect(image.hidden).toEqual(true)
  portrait.set('/grace.jpg')
  expect(image.getAttribute('src')).toEqual('/grace.jpg')
  expect(image.hidden).toEqual(false)
  portrait.set(null)
  expect(image.hidden).toEqual(true)
  expect(image.hasAttribute('src')).toEqual(false)
  expect(inner(host, '.initials').hidden).toEqual(false)
})

test('avatar warns about a bad size, a bad color, a missing name and content', () => {
  const warn = warnings()
  const circle = inner(mounted(avatar({ size: 'xl', color: '#ff0000' }, 'AL')), '.avatar')
  expect(warned(warn, "'size' must be one of")).toBeTruthy()
  expect(warned(warn, "'color' must be one of")).toBeTruthy()
  expect(warned(warn, "needs a 'name'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
  expect(circle.classList.contains('size-md')).toBeTruthy()
  expect(circle.classList.contains('color-primary')).toBeTruthy()
})

test('avatar warns about an unknown prop', () => {
  const warn = warnings()
  mounted(avatar({ name: 'Ada Lovelace', shape: 'square' }))
  expect(warned(warn, "unknown prop 'shape'")).toBeTruthy()
})

test("color 'auto' picks one palette color per name, and follows a live name", () => {
  const colorClass = (host) =>
    [...inner(host, '.avatar').classList].find((name) => name.startsWith('color-'))
  const first = mounted(avatar({ name: 'Ada Lovelace', color: 'auto' }))
  const again = mounted(avatar({ name: 'Ada Lovelace', color: 'auto' }))
  expect(colorClass(first)).toEqual(colorClass(again))
  expect(['color-gray', 'color-brown', 'color-primary'].includes(colorClass(first))).toEqual(false)
  const names = ['Ada', 'Grace', 'Alan', 'Linus', 'Barbara', 'Edsger']
  const picked = new Set(names.map((name) => colorClass(mounted(avatar({ name, color: 'auto' })))))
  expect(picked.size > 1).toEqual(true)
  let name
  const live = mounted(
    stateHost((self) => {
      name = initState(self, 'avatar.autoName', 'Ada')
      return avatar({ name, color: 'auto' })
    }),
  )
  const host = live.shadowRoot.querySelector('imp-avatar')
  name.set('Grace')
  const classes = [...inner(host, '.avatar').classList].filter((c) => c.startsWith('color-'))
  expect(classes).toEqual([colorClass(mounted(avatar({ name: 'Grace', color: 'auto' })))])
})
