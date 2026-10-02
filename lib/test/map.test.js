import { component, mount } from 'imp'
import { div } from 'imp/html'
import { map } from 'imp/std/data'
import { initState } from 'imp/state'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'
import { nextFrame } from './shadow.js'

const stateHost = component('map-state-host', { setup: (self, render) => render(self) })

const BOX = { width: 800, height: 400, left: 0, top: 0 }

const originalRect = Element.prototype.getBoundingClientRect

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const mounted = async (host) => {
  mount(document.body, host)
  await nextFrame()
  return host
}

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const pointer = (node, type, extra) =>
  node.dispatchEvent(
    new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0, ...extra }),
  )

const drag = (viewport, from, to) => {
  pointer(viewport, 'pointerdown', { clientX: from.x, clientY: from.y })
  pointer(viewport, 'pointermove', { clientX: to.x, clientY: to.y })
  pointer(viewport, 'pointerup', { clientX: to.x, clientY: to.y })
}

const translation = (node) => {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(node.style.transform)
  return { x: Number(match[1]), y: Number(match[2]) }
}

const offset = (node) => ({
  x: Number.parseFloat(node.style.getPropertyValue('--x')),
  y: Number.parseFloat(node.style.getPropertyValue('--y')),
})

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const warsaw = () => ({ id: 'warsaw', lat: 52.23, lng: 21.01, label: 'Warsaw office' })

beforeEach(() => {
  document.body.replaceChildren()
  Element.prototype.getBoundingClientRect = () => ({ ...BOX })
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect
})

test('map names the viewport, draws the world and fits it to the box', async () => {
  const host = await mounted(map({ label: 'Offices' }))
  expect(host.localName).toEqual('imp-map')
  const viewport = shadow(host, '.viewport')
  expect(viewport.getAttribute('role')).toEqual('application')
  expect(viewport.getAttribute('aria-label')).toEqual('Offices')
  expect(viewport.tabIndex).toEqual(0)
  expect(all(host, '.land').length).toEqual(177)
  expect(all(host, '.lake').length).toEqual(24)
  const world = shadow(host, '.world')
  expect(world.style.inlineSize).toEqual('800px')
  expect(translation(world)).toEqual({ x: 0, y: -200 })
  const numbers = all(host, '.land').flatMap((path) =>
    path.getAttribute('d').match(/-?\d+/g).map(Number)
  )
  expect(numbers.length).toBeGreaterThan(20000)
  expect(Math.min(...numbers)).toEqual(0)
  expect(Math.max(...numbers)).toEqual(65535)
})

test('map draws a finer world at medium detail, and roads on top at high detail', async () => {
  const medium = await mounted(map({ label: 'World', detail: 'medium' }))
  expect(all(medium, '.land').length).toEqual(242)
  expect(all(medium, '.lake').length).toEqual(412)
  expect(all(medium, '.place').length).toEqual(1251)
  expect(all(medium, '.road').length).toEqual(0)

  const high = await mounted(map({ label: 'World', detail: 'high' }))
  expect(all(high, '.land').length).toEqual(242)
  const roads = all(high, '.road')
  expect(roads.length).toBeGreaterThan(10)
  expect(roads.length).toBeLessThan(20)
  expect(all(high, '.road.major').length).toBeGreaterThan(0)
  expect(all(high, '.road.secondary').length).toBeGreaterThan(0)
  expect(roads[0].getAttribute('d').startsWith('M')).toEqual(true)
  expect(roads[0].getAttribute('d').includes('Z')).toEqual(false)
  expect(all(high, '.road:not([hidden])').length).toEqual(0)

  const near = await mounted(map({ label: 'World', detail: 'high', zoom: 3 }))
  expect(all(near, '.road.major:not([hidden])').length).toBeGreaterThan(0)
  expect(all(near, '.road[hidden]').length).toBeGreaterThan(0)
  const far = await mounted(map({ label: 'World', detail: 'high', zoom: 6 }))
  expect(all(far, '.road[hidden]').length).toEqual(0)
}, { timeout: 20_000 })

test('map warns about an unknown detail and draws the low one', async () => {
  const warn = warnings()
  const host = await mounted(map({ label: 'World', detail: 'ultra' }))
  expect(warned(warn, "'detail'")).toEqual(true)
  expect(all(host, '.land').length).toEqual(177)
})

test('map shows the largest cities first and more of them at a closer zoom', async () => {
  const far = await mounted(map({ label: 'World' }))
  const shown = (host) => all(host, '.place:not([hidden])').map((node) => node.textContent)
  expect(shown(far)).toContain('London')
  expect(shown(far)).toContain('Tokyo')
  expect(shown(far).length).toEqual(26)
  const near = await mounted(map({ label: 'World', zoom: 3 }))
  expect(shown(near).length).toBeGreaterThan(100)
  expect(shown(near)).toContain('Warsaw')
})

test('map takes a city off the page when a zoom out hides it', async () => {
  const host = await mounted(map({ label: 'World', zoom: 3 }))
  const city = (name) => all(host, '.place').find((node) => node.textContent === name)
  expect(getComputedStyle(city('Caracas')).display).toEqual('flex')
  press(shadow(host, '.viewport'), 'Home')
  press(shadow(host, '.viewport'), '-')
  press(shadow(host, '.viewport'), '-')
  press(shadow(host, '.viewport'), '-')
  expect(city('Caracas').hidden).toEqual(true)
  expect(getComputedStyle(city('Caracas')).display).toEqual('none')
  expect(getComputedStyle(city('London')).display).toEqual('flex')
})

test('map centers the view on a coordinate and places a pin on it', async () => {
  const host = await mounted(map({
    label: 'Offices',
    center: [52.23, 21.01],
    zoom: 2,
    pins: [
      warsaw(),
    ],
  }))
  const world = shadow(host, '.world')
  expect(world.style.inlineSize).toEqual('3200px')
  const pin = shadow(host, '.pin')
  const pinAt = offset(pin)
  const shift = translation(world)
  expect(Math.round(pinAt.x + shift.x)).toEqual(400)
  expect(Math.round(pinAt.y + shift.y)).toEqual(200)
  const marker = shadow(host, '.marker')
  expect(marker.localName).toEqual('button')
  expect(marker.getAttribute('aria-label')).toEqual('Warsaw office')
})

test('map stops a pan at the edge of the world', async () => {
  const host = await mounted(map({ label: 'World', center: [80, -170] }))
  expect(translation(shadow(host, '.world'))).toEqual({ x: 0, y: 0 })
})

test('map reports a move after a drag and after a wheel', async () => {
  const move = spy()
  const host = await mounted(
    map({ label: 'World', zoom: 1, events: { move } }),
  )
  const viewport = shadow(host, '.viewport')
  const before = translation(shadow(host, '.world'))
  drag(viewport, { x: 400, y: 200 }, { x: 300, y: 250 })
  const after = translation(shadow(host, '.world'))
  expect(after.x - before.x).toEqual(-100)
  expect(after.y - before.y).toEqual(50)
  expect(move.calls.length).toEqual(1)
  const [event] = move.calls[0]
  expect(event.detail.zoom).toEqual(1)
  expect(event.detail.center[1]).toBeGreaterThan(0)
  viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 400, clientY: 200 }))
  expect(move.calls.length).toEqual(2)
  expect(move.calls[1][0].detail.zoom).toEqual(1.5)
})

test('map does not start a drag from a pin, so the pin keeps its click', async () => {
  const click = spy()
  const content = div({ events: { click } }, 'Here')
  const host = await mounted(
    map({ label: 'World', pins: [{ id: 'here', lat: 0, lng: 0, content }] }),
  )
  const before = translation(shadow(host, '.world'))
  drag(content, { x: 400, y: 200 }, { x: 300, y: 200 })
  expect(translation(shadow(host, '.world'))).toEqual(before)
  content.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(click.calls.length).toEqual(1)
})

test('map pans and zooms from the keyboard and returns home', async () => {
  const host = await mounted(map({ label: 'World', zoom: 1 }))
  const viewport = shadow(host, '.viewport')
  const world = shadow(host, '.world')
  const start = translation(world)
  press(viewport, 'ArrowRight')
  expect(translation(world).x).toEqual(start.x - 200)
  press(viewport, '+')
  expect(world.style.inlineSize).toEqual('3200px')
  press(viewport, '-')
  expect(world.style.inlineSize).toEqual('1600px')
  press(viewport, 'Home')
  expect(translation(world)).toEqual(start)
})

test('map follows a bound state and writes the view back', async () => {
  let center
  let zoom
  const host = stateHost((self) => {
    center = initState(self, 'map.center', [0, 0])
    zoom = initState(self, 'map.zoom', 1)
    return map({ label: 'World', center, zoom })
  })
  mount(document.body, host)
  await nextFrame()
  const view = host.shadowRoot.querySelector('imp-map')
  const world = shadow(view, '.world')
  zoom.set(2)
  expect(world.style.inlineSize).toEqual('3200px')
  center.set([52.23, 21.01])
  const centered = translation(world)
  expect(centered.x).toBeLessThan(-1000)
  press(shadow(view, '.viewport'), 'ArrowLeft')
  expect(zoom.get()).toEqual(2)
  expect(center.get()[1]).toBeLessThan(21.01)
  expect(center.get()[0]).toEqual(52.23)
})

test('map selects a marker and warns about a bad pin', async () => {
  const warn = warnings()
  const select = spy()
  const host = await mounted(
    map({
      label: 'Offices',
      pins: [warsaw(), { id: 'nowhere', lat: 'north' }, { id: 'raw', lat: 0, lng: 0, content: 1 }],
      events: { select },
    }),
  )
  expect(all(host, '.pin').length).toEqual(2)
  shadow(host, '.marker').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(select.calls[0][0].detail.id).toEqual('warsaw')
  expect(warned(warn, "pin 1 needs a numeric 'lat' and 'lng'")).toBeTruthy()
  expect(warned(warn, "'content' of pin 'raw' must be a node")).toBeTruthy()
})

test('map warns about a missing label and a child', async () => {
  const warn = warnings()
  await mounted(map(div('inside')))
  expect(warned(warn, "pass a 'label'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
})
