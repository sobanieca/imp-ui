import { mount } from 'imp'
import { skeleton } from 'imp/std/feedback'
import { beforeEach, expect, spy, test } from 'imp/test'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const bones = (host) => host.shadowRoot.querySelectorAll('.bone')

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('skeleton renders one decorative line of text by default', () => {
  const host = mounted(skeleton())
  expect(host.localName).toEqual('imp-skeleton')
  const root = inner(host, '.root')
  expect(root.getAttribute('aria-hidden')).toEqual('true')
  expect(root.getAttribute('class')).toContain('shape-text')
  expect(bones(host).length).toEqual(1)
})

test('skeleton renders one bone per line', () => {
  expect(bones(mounted(skeleton({ lines: 3 }))).length).toEqual(3)
})

test('skeleton takes a circle and a block shape', () => {
  const circle = mounted(skeleton({ shape: 'circle' }))
  const block = mounted(skeleton({ shape: 'block' }))
  expect(inner(circle, '.root').getAttribute('class')).toContain('shape-circle')
  expect(inner(block, '.root').getAttribute('class')).toContain('shape-block')
  expect(bones(circle).length).toEqual(1)
  expect(bones(block).length).toEqual(1)
})

test('skeleton holds nothing that takes the focus or a name', () => {
  const host = mounted(skeleton({ lines: 2 }))
  expect(
    host.shadowRoot.querySelectorAll('[tabindex], button, a, [role], [aria-label]').length,
  ).toEqual(0)
})

test('skeleton warns about a bad prop and continues with the default', () => {
  const warn = warnings()
  const host = mounted(skeleton({ shape: 'avatar', lines: 0, width: '10rem' }, 'Loading'))
  expect(inner(host, '.root').getAttribute('class')).toContain('shape-text')
  expect(bones(host).length).toEqual(1)
  expect(warned(warn, "'shape' must be one of")).toBeTruthy()
  expect(warned(warn, "'lines' must be a whole number")).toBeTruthy()
  expect(warned(warn, "unknown prop 'width'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
})

test('skeleton warns about lines on a shape that has none', () => {
  const warn = warnings()
  expect(bones(mounted(skeleton({ shape: 'block', lines: 4 }))).length).toEqual(1)
  expect(warned(warn, "'lines' applies to the 'text' shape only")).toBeTruthy()
})
