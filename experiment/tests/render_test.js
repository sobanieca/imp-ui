import { fire, mount } from '../imp/testing.js'
import { assert, assertEquals } from 'jsr:@std/assert@^1'
import {
  button,
  css,
  div,
  el,
  html,
  input,
  label,
  li,
  mount as impMount,
  p,
  raw,
  signal,
  span,
  strong,
  svg,
  ul,
} from '../imp/imp.js'

Deno.test('dispatch: strings, numbers, nodes, arrays in any order', () => {
  const node = p({ class: 'x' }, ['Hello ', strong('world'), ' ', 42])
  assertEquals(node.className, 'x')
  assertEquals(node.textContent, 'Hello world 42')
  // order doesn't matter for props
  const node2 = p('text', { class: 'y' })
  assertEquals(node2.className, 'y')
  assertEquals(node2.textContent, 'text')
})

Deno.test('dispatch: null/undefined/false children are skipped', () => {
  const node = div(['a', null, undefined, false, 'b'])
  assertEquals(node.textContent, 'ab')
})

Deno.test('props: attribute names verbatim — class, for, data-*, aria-*', () => {
  const l = label({ for: 'email', 'data-id': '42', 'aria-label': 'E-mail' })
  assertEquals(l.getAttribute('for'), 'email')
  assertEquals(l.getAttribute('data-id'), '42')
  assertEquals(l.getAttribute('aria-label'), 'E-mail')
})

Deno.test('props: booleans and live form state go through properties', () => {
  const i = input({ disabled: true, value: 'abc' })
  assertEquals(i.disabled, true)
  assertEquals(i.value, 'abc')
  const i2 = input({ disabled: false })
  assertEquals(i2.disabled, false)
})

Deno.test('props: reactive prop updates surgically', () => {
  const locked = signal(false)
  const b = button({ disabled: locked }, 'Go')
  assertEquals(b.disabled, false)
  locked.set(true)
  assertEquals(b.disabled, true)
})

Deno.test('children: reactive function child becomes a live text node', () => {
  const count = signal(0)
  const node = div(['Count: ', () => count()])
  assertEquals(node.textContent, 'Count: 0')
  count.set(7)
  assertEquals(node.textContent, 'Count: 7')
})

Deno.test('class sugar: object form toggles reactively', () => {
  const active = signal(false)
  const node = div({ class: { card: true, active } })
  assert(node.classList.contains('card'))
  assert(!node.classList.contains('active'))
  active.set(true)
  assert(node.classList.contains('active'))
})

Deno.test('class sugar: array form joins statics', () => {
  const node = div({ class: ['a', null, 'b'] })
  assertEquals(node.getAttribute('class'), 'a b')
})

Deno.test('style: object, camelCase → kebab, reactive entry', () => {
  const fading = signal(false)
  const node = div({ style: { marginTop: '4px', opacity: () => fading() ? '0.5' : '1' } })
  assertEquals(node.style.getPropertyValue('margin-top'), '4px')
  assertEquals(node.style.getPropertyValue('opacity'), '1')
  fading.set(true)
  assertEquals(node.style.getPropertyValue('opacity'), '0.5')
})

Deno.test('events: native names, options tuple, dispatch', () => {
  let clicks = 0
  let onced = 0
  const b = button({ events: { click: [() => onced++, { once: true }] } }, 'x')
  const b2 = button({ events: { click: () => clicks++ } }, 'y')
  fire(b, 'click')
  fire(b, 'click')
  fire(b2, 'click')
  assertEquals(onced, 1)
  assertEquals(clicks, 1)
})

Deno.test('raw(): function prop assigned as-is, not treated as reactive', () => {
  const fn = () => 'hello'
  const node = div({ formatter: raw(fn) })
  assertEquals(node.formatter, fn)
})

Deno.test('svg: namespaced elements, attributes verbatim', () => {
  const c = svg.svg({ viewBox: '0 0 10 10' }, svg.circle({ r: 4 }))
  assertEquals(c.namespaceURI, 'http://www.w3.org/2000/svg')
  assertEquals(c.getAttribute('viewBox'), '0 0 10 10')
  assertEquals(c.firstChild.getAttribute('r'), '4')
})

Deno.test('html(): trusted markup → fragment', () => {
  const node = div(html('<em>hi</em> there'))
  assertEquals(node.innerHTML, '<em>hi</em> there')
})

Deno.test('mount: renders, unmount disposes effects and clears', () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const count = signal(0)
  let runs = 0
  const unmount = impMount(host, () =>
    div(() => {
      runs++
      return count()
    }))
  assertEquals(host.textContent, '0')
  count.set(1)
  assertEquals(host.textContent, '1')
  unmount()
  count.set(2)
  assertEquals(runs, 2) // effect disposed with the mount scope
  assertEquals(host.textContent, '')
  host.remove()
})

Deno.test('mount scope: events listeners detach on unmount', () => {
  let clicks = 0
  const view = mount(() => button({ events: { click: () => clicks++ } }, 'x'))
  const b = view.query('button')
  fire(b, 'click')
  assertEquals(clicks, 1)
  view.unmount()
  fire(b, 'click') // aborted listener
  assertEquals(clicks, 1)
})

Deno.test('css``: content-hashed class, deduped', () => {
  const a1 = css`
    color: red;
  `
  const a2 = css`
    color: red;
  `
  const b = css`
    color: blue;
  `
  assertEquals(a1, a2)
  assert(a1 !== b)
  assert(a1.startsWith('imp-'))
})

Deno.test('el: fallback for tags without a factory', () => {
  const node = el('custom-thing', { 'data-x': '1' }, 'inner')
  assertEquals(node.tagName.toLowerCase(), 'custom-thing')
  assertEquals(node.textContent, 'inner')
})
