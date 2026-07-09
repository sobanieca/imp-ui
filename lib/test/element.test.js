import * as imp from 'imp'
import { div, el, li, span, TAGS, ul } from 'imp'
import { expect, test } from 'imp/test'

test('el creates an element of the given tag', () => {
  const node = el('section', 'hello')
  expect(node.tagName).toEqual('SECTION')
  expect(node.textContent).toEqual('hello')
})

test('every tag in TAGS is exported as a helper', () => {
  for (const tag of TAGS) {
    expect(typeof imp[tag]).toEqual('function')
    expect(imp[tag]().tagName).toEqual(tag.toUpperCase())
  }
})

test('string, number, and bigint children become text', () => {
  expect(div('a', 1, 2n).textContent).toEqual('a12')
})

test('nested arrays of children are flattened', () => {
  const list = ul([li('a'), [li('b'), [li('c')]]])
  expect(list.children.length).toEqual(3)
  expect(list.textContent).toEqual('abc')
})

test('null, undefined, and booleans are skipped as children', () => {
  const node = div('a', null, undefined, false, true, 'b')
  expect(node.childNodes.length).toEqual(2)
  expect(node.textContent).toEqual('ab')
})

test('existing nodes are appended as-is', () => {
  const child = span('x')
  const parent = div(child)
  expect(parent.firstChild).toEqual(child)
})

test('children keep their call order around a props object', () => {
  const node = div('a', { id: 'box' }, span('b'), 'c')
  expect(node.id).toEqual('box')
  expect(node.textContent).toEqual('abc')
  expect(node.childNodes.length).toEqual(3)
})
