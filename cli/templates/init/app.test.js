import { mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'
import { root } from '../src/app.js'

const find = (node, selector) => {
  const scope = node.shadowRoot ?? node
  const direct = scope.querySelector(selector)
  if (direct) return direct
  for (const child of scope.querySelectorAll('*')) {
    const found = child.shadowRoot ? find(child, selector) : null
    if (found) return found
  }
  return null
}

const render = () => {
  mount(document.body, root())
  return document.querySelector('app-root')
}

beforeEach(() => {
  document.body.replaceChildren()
  history.replaceState(null, '', '/')
})

test('starts at zero clicks', () => {
  expect(find(render(), '#clicks').textContent).toEqual('Clicks: 0')
})

test('counts every click', () => {
  const page = render()
  const control = find(find(page, 'imp-button'), 'button')
  control.click()
  control.click()
  expect(find(page, '#clicks').textContent).toEqual('Clicks: 2')
})

test('the nav links every node of the map', () => {
  const page = render()
  expect(find(page, 'imp-shell')).toBeTruthy()
  expect(find(page, 'nav a[href="/about"]')).toBeTruthy()
})
