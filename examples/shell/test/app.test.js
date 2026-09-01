import { mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'
import { app } from '../src/app.js'

const shellRoot = (root) => root.shadowRoot.querySelector('imp-shell').shadowRoot

const region = (root, selector) => shellRoot(root).querySelector(selector)

const collectDeep = (node, tag) => {
  const root = node.shadowRoot ?? node
  const found = [...root.querySelectorAll(tag)]
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) found.push(...collectDeep(child, tag))
  }
  return found
}

const menu = (root, label) => shellRoot(root).querySelector(`nav[aria-label="${label}"]`)

const links = (root, label) => [...menu(root, label).querySelectorAll('a')]

const hrefs = (root, label) => links(root, label).map((anchor) => anchor.getAttribute('href'))

const render = () => {
  mount(document.body, app())
  return document.querySelector('app-root')
}

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
  history.replaceState(null, '', '/')
})

test('the shell frames the screen with a navbar, a sidebar and the account chrome', () => {
  const root = render()
  expect(region(root, '.topbar')).toEqual(expect.anything())
  expect(region(root, '.sidebar')).toEqual(expect.anything())
  expect(region(root, '.main')).toEqual(expect.anything())
  expect(region(root, '.bar-logo imp-app-logo')).toEqual(expect.anything())
  expect(region(root, '.tools imp-user-card')).toEqual(expect.anything())
})

test('the navbar carries the top level and the sidebar the filters under it', () => {
  const root = render()
  expect(hrefs(root, 'Sections')).toEqual(['/', '/settings'])
  expect(hrefs(root, 'Filters')).toEqual(['/', '/active', '/done'])
})

test('the section and the filter for the current path are the marked ones', () => {
  const root = render()
  const marked = (label) =>
    links(root, label)
      .filter((anchor) => anchor.getAttribute('aria-current') === 'page')
      .map((anchor) => anchor.getAttribute('href'))
  expect(marked('Sections')).toEqual(['/'])
  expect(marked('Filters')).toEqual(['/'])
})

test('the screen lists the seeded tasks', () => {
  const root = render()
  expect(collectDeep(region(root, '.main'), 'todo-row').length).toEqual(4)
})
