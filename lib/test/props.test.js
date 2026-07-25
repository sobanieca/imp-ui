import { button, div, input } from 'imp/html'
import { expect, spy, test } from 'imp/test'

test('props that exist on the node are set as properties', () => {
  const field = input({ type: 'text', value: 'imp' })
  expect(field.value).toEqual('imp')
  expect(field.type).toEqual('text')
})

test('unknown props become attributes', () => {
  const node = div({ 'data-role': 'card', 'aria-label': 'Card' })
  expect(node.getAttribute('data-role')).toEqual('card')
  expect(node.getAttribute('aria-label')).toEqual('Card')
})

test('a true attribute value renders as an empty attribute', () => {
  expect(div({ 'data-active': true }).getAttribute('data-active')).toEqual('')
})

test('a nullish property value clears the property', () => {
  expect(input({ value: null }).value).toEqual('')
})

test('list and form are always set as attributes', () => {
  const field = input({ list: 'suggestions', form: 'checkout' })
  expect(field.getAttribute('list')).toEqual('suggestions')
  expect(field.getAttribute('form')).toEqual('checkout')
})

test('multiple props objects merge with later keys winning, and warn', () => {
  const warn = spy(console, 'warn', () => {})
  const node = div({ id: 'first', title: 'kept' }, { id: 'second' })
  expect(node.id).toEqual('second')
  expect(node.title).toEqual('kept')
  expect(warn.calls.length).toEqual(1)
  expect(warn.calls[0][0]).toContain('multiple props objects')
})

test('class accepts a string', () => {
  expect(div({ class: 'a b' }).className).toEqual('a b')
})

test('class accepts an array and drops non-string or empty entries', () => {
  expect(div({ class: ['a', '', null, undefined, 'b'] }).className).toEqual('a b')
})

test('class accepts an object of toggles', () => {
  const node = div({ class: { on: true, off: false, also: 1 } })
  expect(node.classList.contains('on')).toBeTruthy()
  expect(node.classList.contains('also')).toBeTruthy()
  expect(node.classList.contains('off')).not.toBeTruthy()
})

test('style accepts a string', () => {
  expect(div({ style: 'color: red' }).getAttribute('style')).toContain('color: red')
})

test('style accepts an object with camelCase and custom properties', () => {
  const node = div({ style: { backgroundColor: 'red', '--gap': '4px' } })
  expect(node.style.getPropertyValue('background-color')).toEqual('red')
  expect(node.style.getPropertyValue('--gap')).toEqual('4px')
})

test('events attach listeners', () => {
  const onClick = spy()
  const node = button({ events: { click: onClick } }, 'go')
  node.click()
  node.click()
  expect(onClick.calls.length).toEqual(2)
})

test('an [listener, options] entry passes listener options', () => {
  const onClick = spy()
  const node = button({ events: { click: [onClick, { once: true }] } }, 'go')
  node.click()
  node.click()
  expect(onClick.calls.length).toEqual(1)
})

test('a non-function listener is ignored', () => {
  const node = button({ events: { click: 'not a function' } }, 'go')
  expect(() => node.click()).not.toThrow()
})
