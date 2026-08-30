import { mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'
import { app } from '../src/app.js'

const shellRoot = (root) => root.shadowRoot.querySelector('imp-shell').shadowRoot

const region = (root, selector) => shellRoot(root).querySelector(selector)

const menu = (root, label) =>
  [...shellRoot(root).querySelectorAll('imp-nav-menu')].find((host) =>
    host.shadowRoot.querySelector('nav')?.getAttribute('aria-label') === label
  )

const collectDeep = (node, tag) => {
  const root = node.shadowRoot ?? node
  const found = [...root.querySelectorAll(tag)]
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) found.push(...collectDeep(child, tag))
  }
  return found
}

const links = (root, label) => [...menu(root, label).shadowRoot.querySelectorAll('a')]

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

test('the shell frames the screen with a header, a sidebar and a bottom bar', () => {
  const root = render()
  expect(region(root, '.header')).toEqual(expect.anything())
  expect(region(root, '.sidebar')).toEqual(expect.anything())
  expect(region(root, '.bottom')).toEqual(expect.anything())
  expect(region(root, '.main')).toEqual(expect.anything())
})

test('the sidebar and the bottom bar are fed by the same sections', () => {
  const root = render()
  expect(hrefs(root, 'Sections')).toEqual(['/', '/active', '/done', '/settings'])
  expect(hrefs(root, 'Sections, compact')).toEqual(hrefs(root, 'Sections'))
})

test('the section for the current path is the marked one', () => {
  const root = render()
  const current = links(root, 'Sections')
    .filter((anchor) => anchor.getAttribute('aria-current') === 'page')
    .map((anchor) => anchor.getAttribute('href'))
  expect(current).toEqual(['/'])
})

test('the screen lists the seeded tasks', () => {
  const root = render()
  expect(collectDeep(region(root, '.main'), 'todo-row').length).toEqual(4)
})
